const fs = require("fs");
const path = require("path");
const db = require("../db");

async function initDB() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "../schema.sql"), "utf8");
    console.log("Running SQL schema setup on Supabase...");
    await db.query(sql);
    console.log("SUCCESS: All tables created successfully in Supabase!");
    process.exit(0);
  } catch (err) {
    console.error("ERROR creating tables:", err.message);
    process.exit(1);
  }
}

initDB();
