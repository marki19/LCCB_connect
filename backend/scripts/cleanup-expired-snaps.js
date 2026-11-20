/**
 * Expired Quick Snap purge.
 *
 * A snap is valid for 24 hours. Nothing removes it when the clock runs out, so
 * this sweep does both halves of the job for each expired snap:
 *
 *   1. delete the stored media object
 *   2. delete the row, which cascades to views, reactions and comments
 *
 * Objects go first on purpose. If storage rejects one, that snap's row is kept,
 * so the next run sees it again and retries. The snap is already past
 * `expires_at`, so `visible_snaps` hides it from every reader in the meantime.
 * The reverse order would lose the key and orphan the object permanently.
 *
 * Usage:
 *   node scripts/cleanup-expired-snaps.js
 *   node scripts/cleanup-expired-snaps.js --dry-run
 */

const path = require("path");
const snapModel = require("../models/snapModel");
const objectStorage = require("../services/objectStorage");

/** Rows handled per round trip. Keeps memory flat and lets a long backlog drain. */
const BATCH_SIZE = 200;

/**
 * Purges expired snaps and their media.
 *
 * @param {object} [options]
 * @param {boolean} [options.dryRun] report the backlog without deleting anything
 * @param {number} [options.batchSize]
 * @param {object} [options.store] storage adapter; injectable for tests
 * @returns {Promise<{snaps: number, objects: number, failures: number}>}
 */
async function cleanupExpiredSnaps({
  dryRun = false,
  batchSize = BATCH_SIZE,
  store = objectStorage,
} = {}) {
  const expired = await snapModel.countExpiredSnaps();

  if (expired === 0) {
    console.log("[snaps] no expired snaps");
    return { snaps: 0, objects: 0, failures: 0 };
  }

  if (dryRun) {
    console.log(`[snaps] DRY RUN: ${expired} expired snap(s) would be purged`);
    return { snaps: 0, objects: 0, failures: 0 };
  }

  if (!store.isConfigured()) {
    // Deleting rows now would orphan their media with no key left to retry.
    throw new Error(
      "Object storage is not configured; refusing to purge snap rows and orphan their media"
    );
  }

  let snaps = 0;
  let objects = 0;
  const failedIds = new Set();

  for (;;) {
    const rows = await snapModel.listExpiredSnaps(batchSize);
    if (rows.length === 0) break;

    const purgedIds = [];

    for (const row of rows) {
      try {
        await store.deleteObject(row.media_key);
        objects += 1;
        purgedIds.push(row.id);
      } catch (err) {
        if (!failedIds.has(row.id)) {
          console.warn(`[snaps] kept snap ${row.id}: ${err.message}`);
        }
        failedIds.add(row.id);
      }
    }

    snaps += await snapModel.purgeSnapRows(purgedIds);

    // A batch where every object failed would be re-listed unchanged; leave the
    // rest for the next run rather than spinning on the same rows.
    if (purgedIds.length === 0) break;
  }

  console.log(
    `[snaps] purged ${snaps} snap(s) and ${objects} object(s)` +
      (failedIds.size > 0 ? `, ${failedIds.size} left for the next run` : "")
  );

  return { snaps, objects, failures: failedIds.size };
}

async function runCleanupCli() {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
  const dryRun = process.argv.includes("--dry-run");

  try {
    const result = await cleanupExpiredSnaps({ dryRun });
    // A failed object leaves storage billing for a file nobody can reach, so
    // surface it as a failed job instead of a line nobody reads.
    process.exit(result.failures > 0 ? 1 : 0);
  } catch (err) {
    console.error("[snaps] FAILED:", err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runCleanupCli();
}

module.exports = { cleanupExpiredSnaps };
