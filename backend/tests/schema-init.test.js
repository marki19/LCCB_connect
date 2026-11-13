const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

describe("Unified Database Schema (init-schema.sql)", () => {
  it("executes cleanly on vanilla PostgreSQL and verifies table structures", async () => {
    const pg = new PGlite();
    const sqlPath = path.join(__dirname, "../init-schema.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Execute the complete unified schema
    await pg.exec(sql);

    // Verify departments table & seed data
    const depts = await pg.query("SELECT * FROM public.departments ORDER BY sort_order;");
    assert.strictEqual(depts.rows.length, 4);
    assert.strictEqual(depts.rows[0].code, "CCS");

    // Verify courses table & seed data
    const courses = await pg.query("SELECT * FROM public.courses ORDER BY sort_order;");
    assert.strictEqual(courses.rows.length, 5);
    assert.strictEqual(courses.rows[0].code, "BSIT");

    // Verify profiles table & native auth columns
    const profileColumns = await pg.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'profiles' AND table_schema = 'public';
    `);
    const colNames = profileColumns.rows.map((r) => r.column_name);
    assert.ok(colNames.includes("password_hash"), "profiles should have password_hash");
    assert.ok(colNames.includes("email_confirmed_at"), "profiles should have email_confirmed_at");
    assert.ok(colNames.includes("student_id"), "profiles should have student_id");
    assert.ok(colNames.includes("verification_status"), "profiles should have verification_status");

    // Verify posts table & multi-image support
    const postColumns = await pg.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'posts' AND table_schema = 'public';
    `);
    const postCols = postColumns.rows.map((r) => r.column_name);
    assert.ok(postCols.includes("image_urls"), "posts should have image_urls");

    // Verify _migrations version tracking records
    const migs = await pg.query("SELECT COUNT(*) AS count FROM public._migrations;");
    assert.strictEqual(Number(migs.rows[0].count), 45, "Should have 45 baseline migrations recorded");
  });
});
