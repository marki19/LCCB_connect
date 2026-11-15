/**
 * Best-effort Storage cleanup.
 *
 * Deleting a thesis row must not leave its 50 MB PDF behind. The database row
 * and the Storage object are two separate systems, so a failure to remove the
 * file must never roll back the successful delete — the row is gone either way.
 */

const { getSupabaseAdmin, AdminAuthUnavailableError } = require("./supabaseAdmin");

async function deleteStorageObject(bucket, key) {
  if (!key) return;
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (err) {
    if (err instanceof AdminAuthUnavailableError) {
      console.warn("[storage] cannot clean up %s/%s: service role not configured", bucket, key);
      return;
    }
    throw err;
  }

  const { error } = await admin.storage.from(bucket).remove([key]);
  if (error) {
    // Non-fatal: the row is already gone. Log and move on.
    console.error("[storage] failed to remove %s/%s: %s", bucket, key, error.message);
  }
}

module.exports = {
  deleteStorageObject,
};