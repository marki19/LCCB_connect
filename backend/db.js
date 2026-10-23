const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { Pool } = require("pg");

// Supabase's public root CA. Bundling it lets the API verify the database
// certificate instead of accepting any TLS certificate.
const SUPABASE_CA = fs.readFileSync(
  path.join(__dirname, "certs", "supabase-root-2021.crt"),
  "utf8"
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: SUPABASE_CA,
    rejectUnauthorized: true,
  },
});

pool.on("connect", () => {
  console.log("Connected to Supabase PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("Unexpected database error:", err);
});

/**
 * Runs `callback(client)` inside a single transaction on one dedicated
 * connection. The callback receives a `client` whose `.query` participates in
 * the transaction; anything that must commit atomically (a send + its
 * notification + the conversation bookkeeping) uses this.
 *
 * The connection is always released; a failure rolls back before re-throwing so
 * the central error handler still sees the original error.
 */
const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // A failed ROLLBACK must not mask the original error.
    }
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  withTransaction,
  pool,
};
