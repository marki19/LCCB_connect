/**
 * Profile Sanitization Utility
 *
 * Ensures sensitive internal credential fields (such as `password_hash`) are
 * never accidentally serialized or returned to clients across any endpoint.
 */

function sanitizeProfile(row) {
  if (!row || typeof row !== "object") return row;
  const copy = { ...row };
  delete copy.password_hash;
  return copy;
}

module.exports = {
  sanitizeProfile,
};
