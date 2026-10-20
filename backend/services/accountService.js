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

module.exports = {
  banUser,
  unbanUser,
  revokeSessions,
  deleteAuthUser,
  getAuthUser,
};
