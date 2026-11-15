require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const db = require("../db");
const { stub } = require("./stub.helper");

const query = stub(db, "query", async () => ({ rows: [] }));
const postModel = require("../models/postModel");

const AUTHOR = "11111111-1111-4111-8111-111111111111";
const VIEWER = "33333333-3333-4333-8333-333333333333";
const CURSOR = "2026-10-20T00:00:00.000Z|22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  query.calls.length = 0;
  query.setImpl(async () => ({ rows: [] }));
});

describe("post list filters", () => {
  it("matches the search term against title and content", async () => {
    await postModel.getAllPosts({ limit: 10, q: "react" });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /p\.title ILIKE \$1/i);
    assert.match(sql, /p\.content ILIKE \$1/i);
    assert.deepEqual(params, ["%react%", null, 10]);
  });

  it("scopes the list to one author", async () => {
    await postModel.getAllPosts({ limit: 10, authorId: AUTHOR });

    const [sql, params] = query.calls.at(-1);
    // author_id is TEXT in the schema, so the cast must be ::text. Casting the
    // parameter to ::uuid throws "operator does not exist: text = uuid".
    assert.match(sql, /p\.author_id = \$1::text/i);
    assert.deepEqual(params, [AUTHOR, null, 10]);
  });

  it("keeps filters and cursor parameter numbering aligned", async () => {
    await postModel.getAllPosts({
      limit: 5,
      q: "ai",
      authorId: AUTHOR,
      cursor: CURSOR,
    });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /p\.created_at < \$3::timestamptz/i);
    assert.match(sql, /p\.id < \$4::uuid/i);
    assert.deepEqual(params, [
      "%ai%",
      AUTHOR,
      "2026-10-20T00:00:00.000Z",
      "22222222-2222-4222-8222-222222222222",
      null,
      5,
    ]);
  });
});

describe("post visibility", () => {
  it("reads the feed through visible_posts with the viewer id", async () => {
    await postModel.getAllPosts({ limit: 10, userId: VIEWER });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /FROM visible_posts\(\$1::text\) p/i);
    assert.doesNotMatch(sql, /FROM posts p/i);
    assert.deepEqual(params, [VIEWER, 10, VIEWER]);
  });

  it("passes a null viewer for guests", async () => {
    await postModel.getAllPosts({ limit: 10 });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /FROM visible_posts\(\$1::text\) p/i);
    assert.equal(params[0], null);
  });

  it("bypasses visibility for moderation reads", async () => {
    await postModel.getAllPosts({ limit: 10, includeHidden: true });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /FROM posts p/i);
    assert.doesNotMatch(sql, /visible_posts/i);
    assert.deepEqual(params, [10]);
  });

  it("gates the detail read through visible_posts", async () => {
    await postModel.getPostById("p1", { userId: VIEWER });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /FROM visible_posts\(\$2::text\) p/i);
    assert.deepEqual(params, ["p1", VIEWER, VIEWER]);
  });

  it("reads the base table for a moderation detail read", async () => {
    await postModel.getPostById("p1", { includeHidden: true });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /FROM posts p/i);
    assert.doesNotMatch(sql, /visible_posts/i);
    assert.deepEqual(params, ["p1"]);
  });

  it("gates comments on the parent post's visibility", async () => {
    await postModel.getComments("p1", { viewerId: VIEWER });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /FROM visible_posts\(\$2::text\) vp/i);
    assert.deepEqual(params, ["p1", VIEWER]);
  });

  it("does not gate comments for moderation", async () => {
    await postModel.getComments("p1", { includeHidden: true });

    const [sql, params] = query.calls.at(-1);
    assert.doesNotMatch(sql, /visible_posts/i);
    assert.deepEqual(params, ["p1"]);
  });
});
