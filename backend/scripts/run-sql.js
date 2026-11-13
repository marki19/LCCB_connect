// Runs a .sql file against Supabase using the direct (session-mode) connection.
//
//   node scripts/run-sql.js migrations/001_rls_hardening.sql
//
// Uses DIRECT_URL when present (session pooler / port 5432, appropriate for DDL)
// and falls back to DATABASE_URL. Mirrors the SSL settings in ../db.js.
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Client } = require("pg");

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/run-sql.js <file.sql>");
    process.exit(1);
  }

  const fullPath = path.isAbsolute(file) ? file : path.join(__dirname, "..", file);
  const sql = fs.readFileSync(fullPath, "utf8");

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Neither DIRECT_URL nor DATABASE_URL is set in backend/.env");
    process.exit(1);
  }

  const isLocalhost =
    !connectionString ||
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1") ||
    process.env.DATABASE_SSL === "false";

  const caPath = path.join(__dirname, "..", "certs", "supabase-root-2021.crt");
  const ca = fs.existsSync(caPath) ? fs.readFileSync(caPath, "utf8") : null;

  const client = new Client({
    connectionString,
    ssl: isLocalhost ? false : ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    console.log(`Applying ${path.relative(process.cwd(), fullPath)} ...`);
    await client.query(sql);
    console.log("OK");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
