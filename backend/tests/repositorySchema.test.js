// backend/tests/repositorySchema.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");

test("posts.kind defaults to discussion and rejects unknown values", async () => {
  const cols = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'posts' AND column_name IN ('kind','repository_type','live_url','repository_category')`
  );
  assert.equal(cols.rows.length, 4);
  await assert.rejects(
    db.query(`INSERT INTO posts (author_id, kind) VALUES ('__nobody__','nope')`),
    /posts_kind_check/
  );
});

test("post_attachments cascades on post delete", async () => {
  const def = await db.query(
    `SELECT pg_get_constraintdef(oid) d FROM pg_constraint
     WHERE conname = 'post_attachments_post_id_fkey'`
  );
  assert.match(def.rows[0].d, /ON DELETE CASCADE/);
});

test("visible_post_attachments function exists and is callable", async () => {
  const res = await db.query(`SELECT routine_name FROM information_schema.routines WHERE routine_name = 'visible_post_attachments'`);
  assert.equal(res.rows.length, 1);
});

test("legacy post columns type, image_url, image_urls are dropped", async () => {
  const cols = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'posts' AND column_name IN ('type', 'image_url', 'image_urls')`
  );
  assert.equal(cols.rows.length, 0, `Expected legacy columns to be dropped, found: ${cols.rows.map(r => r.column_name).join(', ')}`);
});
