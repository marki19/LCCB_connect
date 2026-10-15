const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("connect", () => {
  console.log("Connected to Supabase PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("Unexpected database error:", err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
