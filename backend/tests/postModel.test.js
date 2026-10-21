require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const db = require("../db");
const { stub } = require("./stub.helper");

const query = stub(db, "query", async () => ({ rows: [] }));
const postModel = require("../models/postModel");

const AUTHOR = "11111111-1111-4111-8111-111111111111";
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
    assert.deepEqual(params, ["%react%", 10]);
  });

  it("scopes the list to one author", async () => {
    await postModel.getAllPosts({ limit: 10, authorId: AUTHOR });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /p\.author_id = \$1::uuid/i);
    assert.deepEqual(params, [AUTHOR, 10]);
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
      5,
    ]);
  });
});
