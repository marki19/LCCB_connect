// Retention maintenance (Messaging_plan.md §13, §14, Phase 7).
//
//   node scripts/prune.js            # apply the deletions
//   node scripts/prune.js --dry-run  # report what *would* be deleted
//
// Deletes only data that is already past its useful life; nothing here is
// reachable by a user once removed:
//   * device_tokens not refreshed within DEVICE_TOKEN_TTL_DAYS (default 90) —
//     a phone that hasn't opened the app in months is a dead push target.
//   * resolved message_reports older than MESSAGE_REPORT_TTL_DAYS (default 180)
//     — open reports are NEVER pruned (they're the moderation queue).
//   * read notifications older than NOTIFICATION_TTL_DAYS (default 90) — unread
//     rows are kept so a badge can't silently disappear.
//
// Every TTL is env-tunable; run it from cron / a scheduled job.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const db = require("../db");

const ttl = (raw, fallback) => {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DEVICE_TOKEN_TTL_DAYS = ttl(process.env.DEVICE_TOKEN_TTL_DAYS, 90);
const MESSAGE_REPORT_TTL_DAYS = ttl(process.env.MESSAGE_REPORT_TTL_DAYS, 180);
const NOTIFICATION_TTL_DAYS = ttl(process.env.NOTIFICATION_TTL_DAYS, 90);

/** Each job: a description, the predicate, and the DELETE. */
const jobs = [
  {
    name: "device_tokens",
    ttlDays: DEVICE_TOKEN_TTL_DAYS,
    where: `updated_at < NOW() - ($1::int * INTERVAL '1 day')`,
    table: "public.device_tokens",
  },
  {
    name: "message_reports (resolved)",
    ttlDays: MESSAGE_REPORT_TTL_DAYS,
    where: `status <> 'open' AND created_at < NOW() - ($1::int * INTERVAL '1 day')`,
    table: "public.message_reports",
  },
  {
    name: "notifications (read)",
    ttlDays: NOTIFICATION_TTL_DAYS,
    where: `is_read = TRUE AND created_at < NOW() - ($1::int * INTERVAL '1 day')`,
    table: "public.notifications",
  },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`[prune] ${dryRun ? "DRY RUN — " : ""}retention sweep starting`);

  for (const job of jobs) {
    const countSql = `SELECT COUNT(*)::int AS count FROM ${job.table} WHERE ${job.where};`;
    const { rows } = await db.query(countSql, [job.ttlDays]);
    const count = rows[0]?.count ?? 0;

    if (dryRun || count === 0) {
      console.log(`[prune] ${job.name}: ${count} row(s) past ${job.ttlDays}d`);
      continue;
    }

    const { rowCount } = await db.query(
      `DELETE FROM ${job.table} WHERE ${job.where};`,
      [job.ttlDays]
    );
    console.log(`[prune] ${job.name}: deleted ${rowCount} row(s) past ${job.ttlDays}d`);
  }

  console.log("[prune] done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[prune] FAILED:", err.message);
    process.exit(1);
  });
