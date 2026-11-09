/**
 * Cleanup job: Delete pending signups older than 24 hours that were never verified.
 * Run via cron (e.g., every hour) or as a scheduled Supabase pg_cron job.
 */

const db = require("../db");

async function cleanupExpiredPendingSignups() {
  const result = await db.query(
    `DELETE FROM pending_signups
     WHERE otp_expires_at < NOW() - INTERVAL '24 hours'
       AND verified_at IS NULL
     RETURNING email, created_at`
  );

  if (result.rows.length > 0) {
    console.log(`[cleanup] Deleted ${result.rows.length} expired pending signups:`);
    result.rows.forEach((r) => console.log(`  - ${r.email} (created: ${r.created_at})`));
  } else {
    console.log("[cleanup] No expired pending signups to delete");
  }

  return result.rows;
}

// Allow running directly: node scripts/cleanup-expired-pending-signups.js
if (require.main === module) {
  require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
  cleanupExpiredPendingSignups()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[cleanup] Failed:", err);
      process.exit(1);
    });
}

module.exports = { cleanupExpiredPendingSignups };