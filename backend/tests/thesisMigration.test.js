const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");

after(async () => {
  await db.pool.end();
});

test("theses and thesis_audience no longer exist", async () => {
  const t = await db.query("SELECT to_regclass('public.theses') AS r");
  assert.equal(t.rows[0].r, null);
  const a = await db.query("SELECT to_regclass('public.thesis_audience') AS r");
  assert.equal(a.rows[0].r, null);
});
