const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { Pool } = require("pg");

// Supabase's public root CA. Bundling it lets the API verify the database
// certificate instead of accepting any TLS certificate.
const SUPABASE_CA_PATH = path.join(__dirname, "certs", "supabase-root-2021.crt");
const SUPABASE_CA = fs.existsSync(SUPABASE_CA_PATH)
  ? fs.readFileSync(SUPABASE_CA_PATH, "utf8")
  : null;

const isLocalhost =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes("localhost") ||
  process.env.DATABASE_URL.includes("127.0.0.1") ||
  process.env.DATABASE_SSL === "false";

const rejectUnauthorized =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" &&
  process.env.DATABASE_REJECT_UNAUTHORIZED !== "false";

const sslConfig = isLocalhost
  ? false
  : SUPABASE_CA && rejectUnauthorized
    ? { ca: SUPABASE_CA, rejectUnauthorized: true }
    : { rejectUnauthorized: false };

const parsePositiveInt = (raw, fallback) => {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  // Bounded pool: Supabase enforces a hard connection ceiling, and an
  // unbounded queue turns overload into request timeouts instead of fast 503s.
  max: parsePositiveInt(process.env.PG_POOL_MAX, 20),
  idleTimeoutMillis: parsePositiveInt(process.env.PG_IDLE_TIMEOUT_MS, 30_000),
  connectionTimeoutMillis: parsePositiveInt(process.env.PG_CONNECT_TIMEOUT_MS, 15_000),
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
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
    } catch (rollbackErr) {
      // A failed ROLLBACK must not mask the original error, but surface it so
      // a broken connection pool is diagnosable.
      console.warn("[db] rollback failed:", rollbackErr?.message ?? rollbackErr);
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
