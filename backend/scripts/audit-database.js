const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");

async function runAudit() {
  console.log("Running read-only database integrity audit...\n");

  try {
    // 1. Check for NULL foreign keys
    console.log("=== 1. Checking for NULL foreign keys ===");
    const nullCheckSql = `
      SELECT 'posts.author_id' AS column_name, COUNT(*) AS null_count FROM public.posts WHERE author_id IS NULL
      UNION ALL
      SELECT 'theses.uploader_id', COUNT(*) FROM public.theses WHERE uploader_id IS NULL
      UNION ALL
      SELECT 'likes.post_id', COUNT(*) FROM public.likes WHERE post_id IS NULL
      UNION ALL
      SELECT 'likes.user_id', COUNT(*) FROM public.likes WHERE user_id IS NULL
      UNION ALL
      SELECT 'comments.post_id', COUNT(*) FROM public.comments WHERE post_id IS NULL
      UNION ALL
      SELECT 'comments.user_id', COUNT(*) FROM public.comments WHERE user_id IS NULL;
    `;
    const nullRes = await db.query(nullCheckSql);
    console.table(nullRes.rows);

    // 2. Check for duplicate pairs
    console.log("\n=== 2. Checking for duplicate key pairs ===");
    const dupChecks = [
      { name: "likes (post_id, user_id)", sql: "SELECT post_id, user_id, COUNT(*) FROM public.likes GROUP BY post_id, user_id HAVING COUNT(*) > 1;" },
      { name: "messages (sender_id, client_msg_id)", sql: "SELECT sender_id, client_msg_id, COUNT(*) FROM public.messages GROUP BY sender_id, client_msg_id HAVING COUNT(*) > 1;" },
      { name: "message_reports (message_id, reporter_id)", sql: "SELECT message_id, reporter_id, COUNT(*) FROM public.message_reports GROUP BY message_id, reporter_id HAVING COUNT(*) > 1;" },
      { name: "device_tokens (user_id, token)", sql: "SELECT user_id, token, COUNT(*) FROM public.device_tokens GROUP BY user_id, token HAVING COUNT(*) > 1;" },
      { name: "conversations (user_a, user_b)", sql: "SELECT user_a, user_b, COUNT(*) FROM public.conversations GROUP BY user_a, user_b HAVING COUNT(*) > 1;" }
    ];

    let foundDups = false;
    for (const check of dupChecks) {
      const res = await db.query(check.sql);
      if (res.rows.length > 0) {
        foundDups = true;
        console.log(`[!] DUPLICATES FOUND IN ${check.name}:`, res.rows);
      } else {
        console.log(`[OK] 0 duplicates in ${check.name}`);
      }
    }

    // 3. Inspect existing unique constraints and indexes
    console.log("\n=== 3. Existing UNIQUE constraints in public schema ===");
    const uniqueSql = `
      SELECT conrelid::regclass AS table_name, conname AS constraint_name
      FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace AND contype = 'u'
      ORDER BY 1, 2;
    `;
    const uniqueRes = await db.query(uniqueSql);
    console.table(uniqueRes.rows);

    // 4. Inspect existing CHECK constraints
    console.log("\n=== 4. Existing CHECK constraints in public schema ===");
    const checkSql = `
      SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace AND contype = 'c'
      ORDER BY 1, 2;
    `;
    const checkRes = await db.query(checkSql);
    console.table(checkRes.rows);

    // 5. Inspect column nullability
    console.log("\n=== 5. Column nullability in public schema ===");
    const nullabilitySql = `
      SELECT table_name, column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('posts', 'theses', 'likes', 'comments')
        AND column_name IN ('author_id', 'uploader_id', 'post_id', 'user_id')
      ORDER BY 1, 2;
    `;
    const nullabilityRes = await db.query(nullabilitySql);
    console.table(nullabilityRes.rows);

    console.log("\nAudit finished successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Audit failed:", err);
    process.exit(1);
  }
}

runAudit();
