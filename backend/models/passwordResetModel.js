// =============================================================================
// PASSWORD RESET MODEL
// =============================================================================
// Backend-owned password reset (Option B). The client never talks to Supabase
// Auth for recovery: a request stores a pending row with only an HMAC of the
// 6-digit code, and the verify endpoint compares the submitted code against
// that hash before handing the new password to the admin client.
//
// Mirrors pending_signups (migration 018) so the same rate-limit, attempt, and
// anti-enumeration patterns apply. RLS is revoked for every role — the service
// role is the only writer, so there is nothing to leak through RLS.
//
// Every write answers identically whether or not the address is registered,
// so none of these functions can be used to enumerate accounts.

const db = require("../db");
const { getSupabaseAdmin, AdminAuthUnavailableError } = require("../services/supabaseAdmin");

const MAX_OTP_ATTEMPTS = 5;

/**
 * Look up a profile by email. Used to resolve the user_id for the reset row
 * and to confirm the address is registered before issuing a code.
 *
 * Returns null when no profile exists — the caller must NOT branch on that
 * (anti-enumeration), so the response stays identical either way.
 */
const getProfileByEmail = async (email) => {
  const sql = `SELECT id, email, full_name FROM public.profiles WHERE email = $1 LIMIT 1;`;
  const result = await db.query(sql, [String(email).toLowerCase()]);
  return result.rows[0] || null;
};

/**
 * Create a password reset row. Upserts on email so a second request for the
 * same address rotates the code rather than stacking two live rows.
 *
 * `user_id` is resolved from the profile at request time so the reset row can
 * be audited against a real account, but it is never returned to the client.
 */
const createPasswordReset = async ({ email, otpHash, otpExpiresAt, userId = null }) => {
  const sql = `
    INSERT INTO public.password_resets (user_id, email, otp_hash, otp_expires_at)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (email) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      otp_hash = EXCLUDED.otp_hash,
      otp_expires_at = EXCLUDED.otp_expires_at,
      otp_attempts = 0,
      created_at = NOW(),
      used_at = NULL
    RETURNING *;
  `;
  const result = await db.query(sql, [userId, String(email).toLowerCase(), otpHash, otpExpiresAt]);
  return result.rows[0];
};

const getPasswordResetByEmail = async (email) => {
  const sql = `SELECT * FROM public.password_resets WHERE email = $1 LIMIT 1;`;
  const result = await db.query(sql, [String(email).toLowerCase()]);
  return result.rows[0] || null;
};

const incrementPasswordResetAttempts = async (email) => {
  const sql = `
    UPDATE public.password_resets
    SET otp_attempts = otp_attempts + 1
    WHERE email = $1
    RETURNING otp_attempts;
  `;
  const result = await db.query(sql, [String(email).toLowerCase()]);
  return result.rows[0]?.otp_attempts ?? 0;
};

const markPasswordResetUsed = async (email) => {
  const sql = `UPDATE public.password_resets SET used_at = NOW() WHERE email = $1 RETURNING *;`;
  const result = await db.query(sql, [String(email).toLowerCase()]);
  return result.rows[0] || null;
};

const deletePasswordReset = async (email) => {
  const sql = `DELETE FROM public.password_resets WHERE email = $1 RETURNING *;`;
  const result = await db.query(sql, [String(email).toLowerCase()]);
  return result.rows[0] || null;
};

const deleteExpiredPasswordResets = async () => {
  const sql = `DELETE FROM public.password_resets WHERE otp_expires_at < NOW() AND used_at IS NULL RETURNING email;`;
  const result = await db.query(sql);
  return result.rows;
};

/**
 * Apply a new password to the auth user. Throws on a missing admin client or
 * a Supabase error; the controller catches and returns a generic 500.
 */
const updateUserPassword = async (userId, newPassword) => {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) {
    const err = new Error(error.message || "Could not update the password");
    err.status = 502;
    err.cause = error;
    throw err;
  }
  return true;
};

module.exports = {
  MAX_OTP_ATTEMPTS,
  getProfileByEmail,
  createPasswordReset,
  getPasswordResetByEmail,
  incrementPasswordResetAttempts,
  markPasswordResetUsed,
  deletePasswordReset,
  deleteExpiredPasswordResets,
  updateUserPassword,
};