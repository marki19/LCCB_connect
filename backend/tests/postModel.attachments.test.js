require("./env.helper");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const postModel = require("../models/postModel");

let userId;
let createdPostIds = [];

before(async () => {
  const res = await db.query("SELECT id FROM profiles LIMIT 1");
  userId = res.rows[0].id;
});

after(async () => {
  if (createdPostIds.length > 0) {
    await db.query("DELETE FROM posts WHERE id = ANY($1::uuid[])", [createdPostIds]);
  }
});

test("createPost inserts attachments in sort order", async () => {
  const post = await postModel.createPost({
    author_id: userId,
    content: "c",
    kind: "repository",
    repository_type: "project",
    attachments: [
      { storage_key: "posts/a.png", file_name: "a.png", mime_type: "image/png", size_bytes: 10 },
      { storage_key: "documents/b.pdf", file_name: "b.pdf", mime_type: "application/pdf", size_bytes: 20 },
    ],
  });
  createdPostIds.push(post.id);

  const rows = await db.query(
    `SELECT storage_key, sort_order FROM post_attachments WHERE post_id=$1 ORDER BY sort_order`,
    [post.id]
  );
  assert.deepEqual(rows.rows.map(r => r.storage_key), ["posts/a.png", "documents/b.pdf"]);
  assert.deepEqual(rows.rows.map(r => r.sort_order), [0, 1]);
});

test("a post returns its attachments and derived image fields", async () => {
  const post = await postModel.createPost({
    author_id: userId,
    content: "test read",
    kind: "repository",
    repository_type: "project",
    attachments: [
      { storage_key: "posts/a.png", file_name: "a.png", mime_type: "image/png", size_bytes: 10 },
      { storage_key: "documents/b.pdf", file_name: "b.pdf", mime_type: "application/pdf", size_bytes: 20 },
    ],
  });
  createdPostIds.push(post.id);

  const fetched = await postModel.getPostById(post.id, userId);
  assert.equal(fetched.kind, "repository");
  assert.equal(fetched.repository_type, "project");
  assert.deepEqual(fetched.attachments.map(a => a.storage_key), ["posts/a.png", "documents/b.pdf"]);
  assert.deepEqual(fetched.image_urls, ["posts/a.png"]);
  assert.equal(fetched.image_url, "posts/a.png");
});

test("updatePost replaces the attachment set", async () => {
  const post = await postModel.createPost({
    author_id: userId,
    content: "test update",
    kind: "repository",
    repository_type: "project",
    attachments: [
      { storage_key: "posts/a.png", file_name: "a.png", mime_type: "image/png", size_bytes: 10 },
    ],
  });
  createdPostIds.push(post.id);

  await postModel.updatePost(post.id, userId, {
    attachments: [
      { storage_key: "documents/c.docx", file_name: "c.docx", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size_bytes: 5 },
    ],
  });
  const rows = await db.query(`SELECT storage_key FROM post_attachments WHERE post_id=$1`, [post.id]);
  assert.deepEqual(rows.rows.map(r => r.storage_key), ["documents/c.docx"]);
});

test("updatePost with attachments:[] clears them", async () => {
  const post = await postModel.createPost({
    author_id: userId,
    content: "test clear",
    kind: "repository",
    repository_type: "project",
    attachments: [
      { storage_key: "posts/a.png", file_name: "a.png", mime_type: "image/png", size_bytes: 10 },
    ],
  });
  createdPostIds.push(post.id);

  await postModel.updatePost(post.id, userId, { attachments: [] });
  const rows = await db.query(`SELECT 1 FROM post_attachments WHERE post_id=$1`, [post.id]);
  assert.equal(rows.rowCount, 0);
});

test("a failed post insert leaves no attachments", async () => {
  await assert.rejects(postModel.createPost({
    author_id: userId,
    content: "c",
    kind: "repository",
    repository_type: "thesis",
    attachments: [{ storage_key: "documents/x.pdf", file_name: "x.pdf", mime_type: "application/pdf", size_bytes: 1 }],
    visibility: "not_a_visibility",
  }));
  const rows = await db.query(`SELECT 1 FROM post_attachments WHERE storage_key='documents/x.pdf'`);
  assert.equal(rows.rowCount, 0);
});
