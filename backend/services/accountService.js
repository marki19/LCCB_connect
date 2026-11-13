const db = require("../db");
const {
  AdminAuthUnavailableError,
  getSupabaseAdmin,
} = require("./supabaseAdmin");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function futureDate(until) {
  if (until === undefined || until === null || until === "") return null;
  const date = new Date(until);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    const error = new Error("Suspension end date must be in the future");
    error.status = 400;
    throw error;
  }
  return date;
}

function banDuration(until) {
  const date = futureDate(until);
  if (!date) return "876000h"; // 100 years = indefinite for this deployment
  const hours = Math.max(1, Math.ceil((date.getTime() - Date.now()) / 3_600_000));
  return `${hours}h`;
}

async function banUser(userId, until = null) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: banDuration(until),
  });
  if (error) {
    const err = new Error(error.message || "Could not suspend the auth user");
    err.status = 502;
    err.cause = error;
    throw err;
  }
}

async function unbanUser(userId) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });
  if (error) {
    const err = new Error(error.message || "Could not restore the auth user");
    err.status = 502;
    err.cause = error;
    throw err;
  }
}

/**
 * Revokes refresh sessions. Access tokens already issued may remain valid
 * until their normal expiry; suspension is the hard block.
 */
async function revokeSessions(userId) {
  let sessions = 0;

  // `auth.refresh_tokens.user_id` is text; `auth.sessions.user_id` is uuid.
  const refresh = await db.query(
    "DELETE FROM auth.refresh_tokens WHERE user_id = $1",
    [userId]
  );

  if (UUID_RE.test(userId)) {
    const result = await db.query(
      "DELETE FROM auth.sessions WHERE user_id = $1::uuid RETURNING id",
      [userId]
    );
    sessions = result.rowCount || 0;
  }

  return { sessions, refresh_tokens: refresh.rowCount || 0 };
}

/**
 * Limits concurrent active sessions per user account.
 * When the count exceeds maxSessions, the oldest sessions are evicted (FIFO).
 */
async function enforceSessionCap(userId, { maxSessions, role } = {}) {
  if (!UUID_RE.test(userId)) {
    return { evicted: 0, sessionIds: [] };
  }

  // Determine cap: env override or role-based default (3 for admin/superadmin, 5 for others)
  let cap = maxSessions;
  if (!cap) {
    const isPrivileged = role === "admin" || role === "superadmin";
    const envCap = parseInt(process.env.MAX_CONCURRENT_SESSIONS, 10);
    cap = Number.isInteger(envCap) && envCap > 0
      ? envCap
      : (isPrivileged ? 3 : 5);
  }

  try {
    // Find all sessions for user ordered by newest first
    const res = await db.query(
      `SELECT id FROM auth.sessions 
       WHERE user_id = $1::uuid 
       ORDER BY created_at DESC 
       OFFSET $2`,
      [userId, cap]
    );

    if (!res.rows || res.rows.length === 0) {
      return { evicted: 0, sessionIds: [] };
    }

    const excessIds = res.rows.map((r) => r.id);

    // Delete corresponding refresh tokens
    await db.query(
      `DELETE FROM auth.refresh_tokens WHERE session_id = ANY($1::uuid[])`,
      [excessIds]
    );

    // Delete excess sessions
    const deleted = await db.query(
      `DELETE FROM auth.sessions WHERE id = ANY($1::uuid[]) RETURNING id`,
      [excessIds]
    );

    // Audit force_signout in session_events
    try {
      await db.query(
        `INSERT INTO public.session_events (user_id, event_type, metadata)
         VALUES ($1::uuid, 'force_signout', $2::jsonb)`,
        [
          userId,
          JSON.stringify({
            reason: "session_cap_exceeded",
            cap,
            evicted_count: deleted.rowCount || 0,
            evicted_session_ids: excessIds,
          }),
        ]
      );
    } catch {
      // non-critical audit log
    }

    return {
      evicted: deleted.rowCount || 0,
      sessionIds: excessIds,
    };
  } catch (err) {
    // Do not fail login if session cap query encounters an error
    console.error("[account] Failed to enforce session cap:", err.message);
    return { evicted: 0, sessionIds: [] };
  }
}

async function deleteAuthUser(userId) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (!error) return true;

  // A retry after a partial delete must be able to finish profile cleanup.
  if (
    error.status === 404 ||
    error.code === "user_not_found" ||
    /not\s*found/i.test(error.message || "")
  ) {
    return false;
  }

  const err = new Error(error.message || "Could not delete the auth user");
  err.status = 502;
  err.cause = error;
  throw err;
}

async function getAuthUser(userId) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data?.user) return null;
    const user = data.user;
    return {
      id: user.id,
      email: user.email || null,
      created_at: user.created_at || null,
      last_sign_in_at: user.last_sign_in_at || null,
    };
  } catch (err) {
    if (err instanceof AdminAuthUnavailableError) return null;
    console.error("[admin-auth] Could not read auth user:", err.message);
    return null;
  }
}

/**
 * Generates an impersonation link for a target user.
 * Only superadmins can use this. Returns a magic link that signs in as the target user.
 */
async function generateImpersonationLink(userId) {
  const supabase = getSupabaseAdmin();

  // Get the target user's email
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !userData?.user?.email) {
    const err = new Error("Target user not found or has no email");
    err.status = 404;
    throw err;
  }

  // Generate a magic link (recovery type) for the target user
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: userData.user.email,
  });

  if (error || !data?.properties?.action_link) {
    console.error("[admin-auth] Failed to generate impersonation link:", error?.message);
    const err = new Error("Could not generate impersonation link");
    err.status = 502;
    throw err;
  }

  return {
    link: data.properties.action_link,
    email: userData.user.email,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // Magic links typically expire in 30 min
  };
}

module.exports = {
  banUser,
  unbanUser,
  revokeSessions,
  enforceSessionCap,
  deleteAuthUser,
  getAuthUser,
  generateImpersonationLink,
};
