/**
 * Scheduled Cleanup Orchestrator
 *
 * Runs all four cleanup jobs in sequence:
 * 1. cleanupExpiredPendingSignups - removes pending signups older than 24h
 * 2. cleanupGhostAuthUsers - removes Auth users without profiles older than 24h
 * 3. prune - retention sweep for device_tokens, message_reports, notifications
 * 4. cleanupExpiredSnaps - removes Quick Snaps past their 24h and their media
 *
 * Usage:
 *   node scripts/scheduled-cleanup.js          # run all cleanups
 *   node scripts/scheduled-cleanup.js --dry-run # dry-run prune and snap purge only
 *
 * Environment variables required:
 *   DATABASE_URL
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { cleanupExpiredPendingSignups } = require("./cleanup-expired-pending-signups");
const { cleanupGhostAuthUsers } = require("./cleanup-ghost-auth-users");
const { prune } = require("./prune");
const { cleanupExpiredSnaps } = require("./cleanup-expired-snaps");

async function runScheduledCleanup() {
  const requiredEnv = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(
      `[cleanup] Missing required environment variable(s): ${missing.join(", ")}.\n` +
        `[cleanup] Ensure these are set in .env (for local runs) or in GitHub Repository Secrets (for GitHub Actions).`
    );
    process.exit(1);
  }

  // Pre-validate DATABASE_URL scheme to prevent cryptic EAI_AGAIN 'base' errors
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (dbUrl && !dbUrl.startsWith("postgresql://") && !dbUrl.startsWith("postgres://")) {
    console.error(
      `[cleanup] FATAL: DATABASE_URL must start with "postgresql://" or "postgres://".\n` +
        `[cleanup] Received: "${dbUrl.slice(0, 20)}...".\n` +
        `[cleanup] Check GitHub Repository Secrets -> Actions -> DATABASE_URL and ensure it contains only the URL without variable name or quotes.`
    );
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("[cleanup] DRY RUN — scheduled cleanup starting");
  } else {
    console.log("[cleanup] Starting scheduled cleanup...");
  }

  try {
    // 1. Cleanup expired pending signups
    console.log("[cleanup] Step 1/4: Cleaning up expired pending signups...");
    await cleanupExpiredPendingSignups();

    // 2. Cleanup ghost Auth users
    console.log("[cleanup] Step 2/4: Cleaning up ghost Auth users...");
    await cleanupGhostAuthUsers();

    // 3. Prune old data (retention sweep)
    console.log("[cleanup] Step 3/4: Running retention sweep (prune)...");
    await prune();

    // 4. Purge expired Quick Snaps and their media
    console.log("[cleanup] Step 4/4: Purging expired Quick Snaps...");
    await cleanupExpiredSnaps({ dryRun });

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
  runScheduledCleanup().then(() => process.exit(0));
}

module.exports = { runScheduledCleanup };