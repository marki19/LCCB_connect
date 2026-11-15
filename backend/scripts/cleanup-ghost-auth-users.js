/**
 * Cleanup job: Delete ghost Auth users (no profile, created >24 hours ago).
 * These are users created by the old signup flow that never completed verification.
 * Run via cron (e.g., daily) or as a scheduled Supabase pg_cron job.
 *
 * Uses Supabase Admin API to list and delete users.
 */

const { getSupabaseAdmin } = require("../services/supabaseAdmin");
const db = require("../db");

async function cleanupGhostAuthUsers() {
  const supabase = getSupabaseAdmin();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // List all users (paginated)
  let allUsers = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    if (!data.users || data.users.length === 0) {
      break;
    }

    allUsers.push(...data.users);

    if (data.users.length < perPage) {
      break;
    }
    page++;
  }

  // Find ghost users: no profile, created >24h ago
  const ghostUsers = [];
  for (const user of allUsers) {
    const createdAt = new Date(user.created_at);
    if (createdAt < new Date(twentyFourHoursAgo)) {
      // Check if profile exists
      const profileResult = await db.query(
        `SELECT id FROM profiles WHERE id = $1`,
        [user.id]
      );

      if (profileResult.rows.length === 0) {
        ghostUsers.push(user);
      }
    }
  }

  if (ghostUsers.length === 0) {
    console.log("[cleanup] No ghost Auth users to delete");
    return [];
  }

  console.log(`[cleanup] Found ${ghostUsers.length} ghost Auth users to delete`);

  const deleted = [];
  for (const user of ghostUsers) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(`[cleanup] Failed to delete user ${user.id} (${user.email}):`, error.message);
    } else {
      console.log(`[cleanup] Deleted ghost user: ${user.id} (${user.email})`);
      deleted.push(user);
    }
  }

  return deleted;
}

// Allow running directly: node scripts/cleanup-ghost-auth-users.js
if (require.main === module) {
  require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
  cleanupGhostAuthUsers()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[cleanup] Failed:", err);
      process.exit(1);
    });
}

module.exports = { cleanupGhostAuthUsers };