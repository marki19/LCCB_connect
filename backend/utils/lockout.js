/**
 * Progressive lockout schedule for failed password attempts.
 *
 * Pure and dependency-free so the policy can be unit-tested without a database.
 * The threshold is deliberately low (5) because the identifier rate limiter
 * already caps guesses at 5 per 15 minutes; the lock exists to stop a slow,
 * distributed attack, not to replace the limiter.
 */

const LOCKOUT_THRESHOLD = 5;

const SCHEDULE = [
  { minAttempts: 10, interval: "15 minutes" },
  { minAttempts: 8, interval: "5 minutes" },
  { minAttempts: 5, interval: "1 minute" },
];

/**
 * Returns the lock interval for a given attempt count, or null when the
 * account should not be locked yet.
 *
 * @param {number} attempts failed attempts so far, after incrementing
 * @returns {string|null} Postgres interval literal
 */
function lockoutIntervalFor(attempts) {
  const count = Number(attempts);
  if (!Number.isFinite(count) || count < LOCKOUT_THRESHOLD) return null;
  const step = SCHEDULE.find((entry) => count >= entry.minAttempts);
  return step ? step.interval : null;
}

module.exports = { LOCKOUT_THRESHOLD, lockoutIntervalFor };
