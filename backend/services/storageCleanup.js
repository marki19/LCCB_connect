/**
 * Best-effort object cleanup.
 *
 * Deleting a thesis row must not leave its 50 MB PDF behind. The database row
 * and the storage object are two separate systems, so a failure to remove the
 * file must never roll back the successful delete — the row is gone either way.
 */

const objectStorage = require("./objectStorage");
const { objectKey } = require("./storageService");

/**
 * @param {string} bucket  Column bucket name (`theses`, `assets`, `avatars`).
 * @param {string} key     Stored key, with or without its category prefix.
 */
async function deleteStorageObject(bucket, key) {
  if (!key) return;

  try {
    await objectStorage.deleteObject(objectKey(bucket, key));
  } catch (err) {
    // Non-fatal: the row is already gone. Log and move on.
    console.error("[storage] failed to remove %s/%s: %s", bucket, key, err.message);
  }
}

module.exports = {
  deleteStorageObject,
};
