const db = require("../db");
const { generateOtp, hashOtp, verifyOtpHash, MAX_OTP_ATTEMPTS } = require("../utils/otp");

/**
 * Emailed codes that gate identity verification (042_verification_roles.sql).
 *
 * Same construction as `pending_signups`: only an HMAC of `email:code` is
 * stored, so a database dump cannot complete someone's verification. One row per
 * user — issuing a new code replaces the old one, so only the newest code works
 * and a user cannot have two live challenges.
 *
 * The code is never read back out of the database: `issue` returns it once, for
 * the caller to email, and nothing else can recover it.
 */

const OTP_TTL_MINUTES = 10;

/** How long a code stays usable, surfaced to the client and the email copy. */
const expiresInMinutes = () => OTP_TTL_MINUTES;

/**
 * Issues (or replaces) the caller's live challenge. Returns the plaintext code
 * for the caller to email — this is the only place it exists.
 */
async function issue({ userId, email }) {
  const code = generateOtp();

  const result = await db.query(
    `INSERT INTO public.verification_otp (user_id, code_hash, attempts, expires_at, consumed_at)
     VALUES ($1, $2, 0, NOW() + make_interval(mins => $3::int), NULL)
     ON CONFLICT (user_id) DO UPDATE
        SET code_hash = EXCLUDED.code_hash,
            attempts = 0,
            expires_at = EXCLUDED.expires_at,
            consumed_at = NULL,
            created_at = NOW()
     RETURNING expires_at;`,
    [userId, hashOtp(email, code), OTP_TTL_MINUTES]
  );

  return { code, expiresAt: result.rows[0].expires_at };
}

/**
 * Checks a submitted code and burns it in the same transaction.
 *
 * The row is locked first, so two concurrent submissions cannot both pass on one
 * code. A wrong guess increments `attempts` and the code dies after
 * `MAX_OTP_ATTEMPTS`; the caller has to request a fresh one either way.
 *
 * Returns `{ ok: true }` or `{ ok: false, reason }` where `reason` is one of
 * `missing`, `expired`, `too_many`, `mismatch`. Mapping those to HTTP statuses
 * is the controller's job.
 */
async function verifyAndConsume({ userId, email, code }) {
  return db.withTransaction(async (client) => {
    const row = (
      await client.query(`SELECT * FROM public.verification_otp WHERE user_id = $1 FOR UPDATE;`, [
        userId,
      ])
    ).rows[0];

    if (!row || row.consumed_at) return { ok: false, reason: "missing" };
    if (new Date(row.expires_at).getTime() <= Date.now()) return { ok: false, reason: "expired" };
    if (row.attempts >= MAX_OTP_ATTEMPTS) return { ok: false, reason: "too_many" };

    if (!verifyOtpHash(email, code, row.code_hash)) {
      await client.query(
        `UPDATE public.verification_otp SET attempts = attempts + 1 WHERE user_id = $1;`,
        [userId]
      );
      return { ok: false, reason: "mismatch", attemptsLeft: MAX_OTP_ATTEMPTS - row.attempts - 1 };
    }

    await client.query(
      `UPDATE public.verification_otp SET consumed_at = NOW() WHERE user_id = $1;`,
      [userId]
    );
    return { ok: true };
  });
}

module.exports = { issue, verifyAndConsume, expiresInMinutes, OTP_TTL_MINUTES };
