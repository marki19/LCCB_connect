/**
 * Scheduled Cleanup Orchestrator
 *
 * Runs all three cleanup jobs in sequence:
 * 1. cleanupExpiredPendingSignups - removes pending signups older than 24h
 * 2. cleanupGhostAuthUsers - removes Auth users without profiles older than 24h
 * 3. prune - retention sweep for device_tokens, message_reports, notifications
 *
 * Usage:
 *   node scripts/scheduled-cleanup.js          # run all cleanups
 *   node scripts/scheduled-cleanup.js --dry-run # dry-run prune only
 *
 * Environment variables required:
 *   DATABASE_URL
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const { cleanupExpiredPendingSignups } = require("./cleanup-expired-pending-signups");
const { cleanupGhostAuthUsers } = require("./cleanup-ghost-auth-users");
const { prune } = require("./prune");

async function runScheduledCleanup() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("[cleanup] DRY RUN — scheduled cleanup starting");
  } else {
    console.log("[cleanup] Starting scheduled cleanup...");
  }

  try {
    // 1. Cleanup expired pending signups
    console.log("[cleanup] Step 1/3: Cleaning up expired pending signups...");
    await cleanupExpiredPendingSignups();

    // 2. Cleanup ghost Auth users
    console.log("[cleanup] Step 2/3: Cleaning up ghost Auth users...");
    await cleanupGhostAuthUsers();

    // 3. Prune old data (retention sweep)
    console.log("[cleanup] Step 3/3: Running retention sweep (prune)...");
    await prune();

    if (dryRun) {
      console.log("[cleanup] DRY RUN completed");
    } else {
      console.log("[cleanup] Completed");
    }
  } catch (err) {
    console.error("[cleanup] Failed:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  // Load .env for local runs
  require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
  runScheduledCleanup().then(() => process.exit(0));
}

module.exports = { runScheduledCleanup };