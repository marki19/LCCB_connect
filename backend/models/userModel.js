const db = require("../db");
const { DEFAULT_LIMIT } = require("./pagination");
const { escapeLike } = require("../utils/queryFilters");

// RAW SQL QUERIES ONLY (NO ORM METHODS)

// Keyset pagination on the (text) primary key. `cursor` is the last `id` seen.
const getAllUsers = async ({
  limit = DEFAULT_LIMIT,
  cursor = null,
  q = null,
  departmentId = null,
  yearLevel = null,
} = {}) => {
  const params = [];
  const conditions = [];

  if (cursor) {
    params.push(cursor);
    conditions.push(`p.id > $${params.length}`);
  }

  if (q) {
    params.push(`%${escapeLike(q)}%`);
    conditions.push(`(
      p.username ILIKE $${params.length} ESCAPE '!'
      OR p.full_name ILIKE $${params.length} ESCAPE '!'
      OR d.name ILIKE $${params.length} ESCAPE '!'
    )`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`p.department_id = $${params.length}::uuid`);
  }

  if (yearLevel) {
    params.push(yearLevel);
    conditions.push(`p.year_level = $${params.length}`);
  }

  params.push(limit);
  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  // Joins the catalog so callers can display department/course names without a
  // second round-trip. The ids remain the authorization source of truth.
  const sql = `
    SELECT p.*, d.name AS department_name, c.name AS course_name
    FROM profiles p
    LEFT JOIN public.departments d ON d.id = p.department_id
    LEFT JOIN public.courses c ON c.id = p.course_id
    ${whereClause}
    ORDER BY p.id ASC
    LIMIT $${params.length};
  `;
  const result = await db.query(sql, params);
    return result.rows;
  };

  /**
   * Authenticated peer directory for the messaging picker (Messaging_plan.md §4).
   * Returns raw relationship/policy flags only — the controller maps them through
   * `messageModel.resolveDecision` so the decision table stays in one place.
   *
   * Blocked pairs are filtered out in both directions: a block is never surfaced.
   */
  const getDirectory = async (userId, { limit = 50, q = null, scope = "network" } = {}) => {
    const params = [userId];
    const conditions = ["p.id <> $1"];

    if (q) {
      params.push(`%${escapeLike(q)}%`);
      conditions.push(`(
        p.username ILIKE $${params.length} ESCAPE '!'
        OR p.full_name ILIKE $${params.length} ESCAPE '!'
        OR d.name ILIKE $${params.length} ESCAPE '!'
      )`);
    }

    if (scope === "network") {
      conditions.push(`(
        p.department_id = (SELECT department_id FROM me)
        OR f.id IS NOT NULL
      )`);
    }

    conditions.push(`NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = $1 AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = $1)
    )`);

    params.push(limit);

    const sql = `
      WITH me AS (SELECT department_id FROM public.profiles WHERE id = $1)
      SELECT
        p.id, p.username, p.full_name, p.avatar_url, p.year_level,
        p.department_id, d.name AS department_name, p.message_policy,
        f.status AS friendship_status,
        (f.requester_id = $1) AS friendship_outgoing,
        (SELECT department_id FROM me) AS sender_department_id,
        EXISTS (
          SELECT 1 FROM public.message_policy_departments mp
          WHERE mp.user_id = p.id AND mp.department_id = (SELECT department_id FROM me)
        ) AS sender_department_allowed
      FROM public.profiles p
      LEFT JOIN public.departments d ON d.id = p.department_id
      LEFT JOIN public.friendships f
        ON (f.requester_id = $1 AND f.addressee_id = p.id)
        OR (f.addressee_id = $1 AND f.requester_id = p.id)
      WHERE ${conditions.join(" AND ")}
      ORDER BY p.full_name ASC NULLS LAST
      LIMIT $${params.length};
    `;

    const { rows } = await db.query(sql, params);
    return rows;
  };

  const getUserById = async (id) => {
  // Joins the catalog so callers can display department/course names without a
  // second round-trip. The ids remain the authorization source of truth.
  const sql = `
    SELECT p.*, d.name AS department_name, c.name AS course_name
    FROM profiles p
    LEFT JOIN public.departments d ON d.id = p.department_id
    LEFT JOIN public.courses c ON c.id = p.course_id
    WHERE p.id = $1;
  `;
  const result = await db.query(sql, [id]);
  return result.rows[0];
};

const getPublicProfile = async (targetId, viewerId = null) => {
  if (!targetId) return null;

  // 1. Block check: if blocked in either direction, profile is hidden
  if (viewerId) {
    const blockCheck = await db.query(
      `SELECT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = $1 AND b.blocked_id = $2)
           OR (b.blocker_id = $2 AND b.blocked_id = $1)
      ) AS is_blocked`,
      [viewerId, targetId]
    );
    if (blockCheck.rows[0]?.is_blocked) {
      return null;
    }
  }

  // 2. Fetch sanitized public profile + stats
  const sql = `
    SELECT
      p.id,
      p.username,
      p.full_name,
      p.avatar_url,
      p.bio,
      p.year_level,
      p.role,
      p.skills,
      p.department_id,
      p.course_id,
      p.created_at,
      p.verified_status,
      d.name AS department_name,
      c.name AS course_name,
      (
        SELECT f.status FROM public.friendships f
        WHERE (f.requester_id = $2 AND f.addressee_id = p.id)
           OR (f.addressee_id = $2 AND f.requester_id = p.id)
        LIMIT 1
      ) AS friendship_status,
      (
        SELECT f.requester_id = $2 FROM public.friendships f
        WHERE (f.requester_id = $2 AND f.addressee_id = p.id)
           OR (f.addressee_id = $2 AND f.requester_id = p.id)
        LIMIT 1
      ) AS friendship_outgoing,
      (
        SELECT COUNT(*)::int FROM visible_posts($2::text) vp
        WHERE vp.author_id = p.id AND vp.deleted_at IS NULL
      ) AS posts_count,
      (
        SELECT COUNT(*)::int FROM visible_theses($2::text) vt
        WHERE vt.uploader_id = p.id
      ) AS theses_count,
      (
        SELECT COUNT(*)::int FROM public.friendships f
        WHERE (f.requester_id = p.id OR f.addressee_id = p.id)
          AND f.status = 'accepted'
      ) AS friends_count
    FROM public.profiles p
    LEFT JOIN public.departments d ON d.id = p.department_id
    LEFT JOIN public.courses c ON c.id = p.course_id
    WHERE p.id = $1;
  `;

  const result = await db.query(sql, [targetId, viewerId]);
  const row = result.rows[0];
  if (!row) return null;

  const friendship =
    row.friendship_status === "accepted"
      ? "friend"
      : row.friendship_status === "pending"
      ? row.friendship_outgoing
        ? "pending_out"
        : "pending_in"
      : "none";

  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
    bio: row.bio,
    year_level: row.year_level,
    role: row.role,
    skills: row.skills || [],
    department_id: row.department_id,
    course_id: row.course_id,
    department_name: row.department_name,
    course_name: row.course_name,
    created_at: row.created_at,
    verified_status: row.verified_status,
    friendship,
    is_self: Boolean(viewerId && String(viewerId) === String(row.id)),
    stats: {
      posts_count: row.posts_count || 0,
      theses_count: row.theses_count || 0,
      friends_count: row.friends_count || 0,
    },
  };
};

const createUser = async (userData) => {
  const {
    id, username, full_name, avatar_url, bio, course, year_level, role,
    department_id, course_id, email, student_id, verification_status,
  } = userData;
  const sql = `
    INSERT INTO profiles (id, username, full_name, avatar_url, bio, course, year_level, role, department_id, course_id, email, student_id, verification_status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (id) DO UPDATE SET
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      username = COALESCE(EXCLUDED.username, profiles.username),
      -- Department/course are CLAIM-ONCE: fill them only while still unset, so a
      -- repeat POST can never move a user into a different department.
      department_id = COALESCE(profiles.department_id, EXCLUDED.department_id),
      course_id = COALESCE(profiles.course_id, EXCLUDED.course_id),
      -- The signup address is authoritative; a repeat self-provision must not
      -- clobber a corrected one.
      email = COALESCE(EXCLUDED.email, profiles.email),
      student_id = COALESCE(profiles.student_id, EXCLUDED.student_id),
      verification_status = COALESCE(EXCLUDED.verification_status, profiles.verification_status)
    RETURNING *;
  `;
  const values = [
    id, username, full_name, avatar_url, bio, course, year_level, role || 'student',
    department_id || null, course_id || null, email || null, student_id || null, verification_status || 'unverified',
  ];
  const result = await db.query(sql, values);
  return result.rows[0];
};

const updateUser = async (id, userData) => {
  const {
    username, full_name, avatar_url, bio, course, year_level, role, skills,
    department_id, course_id, message_policy, student_id, verification_status,
  } = userData;
  const sql = `
    UPDATE profiles
    SET username = COALESCE($1, username),
        full_name = COALESCE($2, full_name),
        avatar_url = COALESCE($3, avatar_url),
        bio = COALESCE($4, bio),
        course = COALESCE($5, course),
        year_level = COALESCE($6, year_level),
        role = COALESCE($7, role),
        skills = COALESCE($8, skills),
        department_id = COALESCE($9, department_id),
        course_id = COALESCE($10, course_id),
        message_policy = COALESCE($11, message_policy),
        student_id = COALESCE($12, student_id),
        verification_status = COALESCE($13, verification_status)
    WHERE id = $14
    RETURNING *;
  `;
  const values = [
    username || null,
    full_name || null,
    avatar_url || null,
    bio || null,
    course || null,
    year_level || null,
    role || null,
    skills || null,
    department_id || null,
    course_id || null,
    message_policy || null,
    student_id || null,
    verification_status || null,
    id,
  ];
  const result = await db.query(sql, values);
  return result.rows[0];
};

const deleteUser = async (id) => {
  const sql = `DELETE FROM profiles WHERE id = $1 RETURNING *;`;
  const result = await db.query(sql, [id]);
  return result.rows[0];
};

/**
 * Resolves the email behind a student ID so the login route can hand Supabase
 * an email it understands. Only verified owners resolve: an unverified or
 * declined ID must not be a usable login handle.
 *
 * Returns `{ id, email }` or null. The route logs the attempt server-side and
 * always answers the same way whether the ID is unknown or the caller is
 * unverified, so the response cannot be used to enumerate accounts.
 */
const getLoginEmailByStudentId = async (studentId) => {
  const sql = `
    SELECT id, email
    FROM public.profiles
    WHERE upper(student_id) = $1
      AND verification_status = 'verified'
      AND email IS NOT NULL
    LIMIT 1;
  `;
  const result = await db.query(sql, [String(studentId).toUpperCase()]);
  return result.rows[0] || null;
};

/**
 * Looks up a user by username for login.
 * Returns `{ id, email }` or null. The route logs the attempt server-side and
 * always answers the same way whether the username is unknown or the caller is
 * unverified, so the response cannot be used to enumerate accounts.
 */
const getLoginEmailByUsername = async (username) => {
  const sql = `
    SELECT id, email
    FROM public.profiles
    WHERE lower(username) = $1
      AND verification_status = 'verified'
      AND email IS NOT NULL
    LIMIT 1;
  `;
  const result = await db.query(sql, [username.toLowerCase()]);
  return result.rows[0] || null;
};

/**
 * Looks up a user by email for lockout tracking on failed email login.
 * Returns minimal profile (id, role, failed_login_attempts) or null.
 * Does NOT require verification_status = 'verified' because we track
 * failed attempts even for unverified accounts (they can still be locked out).
 */
const getUserByEmailForLockout = async (email) => {
  const sql = `
    SELECT id, role, failed_login_attempts
    FROM public.profiles
    WHERE lower(email) = $1
    LIMIT 1;
  `;
  const result = await db.query(sql, [email.toLowerCase()]);
  return result.rows[0] || null;
};

/**
 * Existence check for signup. Backed by idx_profiles_email (migration 016), so
 * it costs one indexed lookup instead of a paginated admin API call.
 * Returns null when the address has no profile.
 */
const findProfileIdByEmail = async (email) => {
  const sql = `
    SELECT id, role
    FROM public.profiles
    WHERE lower(email) = $1
    LIMIT 1;
  `;
  const result = await db.query(sql, [String(email).toLowerCase()]);
  return result.rows[0] || null;
};

/** Pending Signups (reverse signup flow) */
const createPendingSignup = async ({ email, passwordHash, fullName, otpHash, otpExpiresAt }) => {
  const sql = `
    INSERT INTO pending_signups (email, password_hash, full_name, otp_hash, otp_expires_at)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      full_name = EXCLUDED.full_name,
      otp_hash = EXCLUDED.otp_hash,
      otp_expires_at = EXCLUDED.otp_expires_at,
      otp_attempts = 0,
      created_at = NOW(),
      verified_at = NULL
    RETURNING *;
  `;
  const result = await db.query(sql, [email, passwordHash, fullName, otpHash, otpExpiresAt]);
  return result.rows[0];
};

const incrementOtpAttempts = async (email) => {
  const sql = `
    UPDATE pending_signups
    SET otp_attempts = otp_attempts + 1
    WHERE email = $1
    RETURNING otp_attempts;
  `;
  const result = await db.query(sql, [String(email).toLowerCase()]);
  return result.rows[0]?.otp_attempts ?? 0;
};

const getPendingSignupByEmail = async (email) => {
  const sql = `SELECT * FROM pending_signups WHERE email = $1 LIMIT 1;`;
  const result = await db.query(sql, [email]);
  return result.rows[0];
};

const markPendingSignupVerified = async (email) => {
  const sql = `UPDATE pending_signups SET verified_at = NOW() WHERE email = $1 RETURNING *;`;
  const result = await db.query(sql, [email]);
  return result.rows[0];
};

const deletePendingSignup = async (email) => {
  const sql = `DELETE FROM pending_signups WHERE email = $1 RETURNING *;`;
  const result = await db.query(sql, [email]);
  return result.rows[0];
};

const deleteExpiredPendingSignups = async () => {
  const sql = `DELETE FROM pending_signups WHERE otp_expires_at < NOW() AND verified_at IS NULL RETURNING email;`;
  const result = await db.query(sql);
  return result.rows;
};

/**
 * Increments the failed login attempts counter for a user.
 * Returns the updated count.
 */
const incrementFailedLogins = async (userId) => {
  const sql = `
    UPDATE profiles
    SET failed_login_attempts = failed_login_attempts + 1
    WHERE id = $1
    RETURNING failed_login_attempts;
  `;
  const result = await db.query(sql, [userId]);
  return result.rows[0]?.failed_login_attempts ?? 0;
};

/**
 * Resets the failed login attempts counter to 0 and clears lockout.
 */
const resetFailedLogins = async (userId) => {
  const sql = `
    UPDATE profiles
    SET failed_login_attempts = 0,
        locked_until = NULL
    WHERE id = $1
    RETURNING failed_login_attempts, locked_until;
  `;
  const result = await db.query(sql, [userId]);
  return result.rows[0];
};

/**
 * Checks if a user's account is currently locked.
 * Returns true if locked_until is in the future.
 */
const isLocked = async (userId) => {
  const sql = `SELECT locked_until FROM profiles WHERE id = $1;`;
  const result = await db.query(sql, [userId]);
  if (!result.rows[0]?.locked_until) return false;
  return new Date(result.rows[0].locked_until) > new Date();
};

/**
 * Locks a user's account for a specified duration (e.g., '15 minutes').
 * Uses Postgres interval syntax.
 */
const lockAccount = async (userId, interval) => {
  // Do not touch failed_login_attempts here: the counter drives progressive
  // backoff, so resetting it to a fixed value would pin every future lock at
  // the shortest interval.
  const sql = `
    UPDATE profiles
    SET locked_until = NOW() + $1::interval
    WHERE id = $2
    RETURNING locked_until;
  `;
  const result = await db.query(sql, [interval, userId]);
  return result.rows[0]?.locked_until;
};

/**
 * Unlocks a user's account immediately (admin action).
 * Resets failed attempts and clears lockout.
 */
const unlockAccount = async (userId) => {
  const sql = `
    UPDATE profiles
    SET locked_until = NULL,
        failed_login_attempts = 0
    WHERE id = $1
    RETURNING locked_until, failed_login_attempts;
  `;
  const result = await db.query(sql, [userId]);
  return result.rows[0];
};

/**
 * Marks an email as bounced (hard bounce 550 5.1.1).
 * Returns the updated profile (id, role) or null if not found.
 */
const updateBouncedEmail = async (email, bounceReason, bouncedAt) => {
  const sql = `
    UPDATE profiles
    SET email_bounced = TRUE,
        bounce_reason = $2,
        bounced_at = $3
    WHERE lower(email) = $1
    RETURNING id, role;
  `;
  const result = await db.query(sql, [email, bounceReason, bouncedAt]);
  return result.rows[0] || null;
};

module.exports = {
  getAllUsers,
  getUserById,
  getPublicProfile,
  getDirectory,
  createUser,
  updateUser,
  deleteUser,
  getLoginEmailByStudentId,
  getLoginEmailByUsername,
  getUserByEmailForLockout,
  findProfileIdByEmail,
  createPendingSignup,
  getPendingSignupByEmail,
  incrementOtpAttempts,
  markPendingSignupVerified,
  deletePendingSignup,
  deleteExpiredPendingSignups,
  incrementFailedLogins,
  resetFailedLogins,
    isLocked,
    lockAccount,
    unlockAccount,
    updateBouncedEmail,
  };
