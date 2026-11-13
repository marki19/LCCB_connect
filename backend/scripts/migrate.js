/**
 * LCCB Connect - Idempotent Database Migration Runner
 *
 * Runs all pending migrations from backend/migrations/*.sql in alphabetical order,
 * tracking applied migrations in public._migrations table.
 *
 * Usage:
 *   node backend/scripts/migrate.js
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("../db");

async function runMigrations() {
  console.log("==> Checking database migrations...");
  const client = await db.pool.connect();

  try {
    // 1. Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS public._migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Fetch already-applied migrations
    const { rows } = await client.query("SELECT name FROM public._migrations;");
    const applied = new Set(rows.map((r) => r.name));

    // 3. Scan migrations directory
    const migrationsDir = path.join(__dirname, "../migrations");
    if (!fs.existsSync(migrationsDir)) {
      console.log("No migrations directory found.");
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log(`==> Database is up to date (${applied.size} migrations recorded).`);
      return;
    }

    console.log(`==> Found ${pending.length} pending migration(s) to apply.`);

    // 4. Apply each pending migration inside its own transaction
    for (const file of pending) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf8");

      console.log(`    -> Applying ${file}...`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO public._migrations (name) VALUES ($1);", [file]);
        await client.query("COMMIT");
        console.log(`       [OK] ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`\n[ERROR] Migration failed on ${file}:`);
        console.error(err.message);
        process.exit(1);
      }
    }

    console.log(`==> Successfully applied all ${pending.length} migration(s).`);
  } finally {
    client.release();
    await db.pool.end();
  }
}

if (require.main === module) {
  runMigrations().catch((err) => {
    console.error("Migration execution failed:", err);
    process.exit(1);
  });
}

module.exports = { runMigrations };
