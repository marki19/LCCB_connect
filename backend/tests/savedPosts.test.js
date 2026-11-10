require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const db = require("../db");
const { stub } = require("./stub.helper");

const query = stub(db, "query", async () => ({ rows: [] }));
const savedPostModel = require("../models/savedPostModel");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const POST_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  query.calls.length = 0;
  query.setImpl(async () => ({ rows: [] }));
});

describe("savedPostModel", () => {
  it("saves a visible post", async () => {
    // First query: visibility check succeeds
    // Second query: insert into saved_posts
    query.setImpl(async (sql) => {
      if (sql.includes("visible_posts")) {
        return { rows: [{ id: POST_ID }] };
      }
      return { rowCount: 1, rows: [] };
    });

    const result = await savedPostModel.savePost(USER_ID, POST_ID);
    assert.deepEqual(result, { saved: true, postId: POST_ID });

    assert.equal(query.calls.length, 2);
    const [insertSql, insertParams] = query.calls[1];
    assert.match(insertSql, /INSERT INTO public\.saved_posts/i);
    assert.deepEqual(insertParams, [USER_ID, POST_ID]);
  });

  it("throws 404 when saving a non-visible or non-existent post", async () => {
    query.setImpl(async () => ({ rows: [] }));

    await assert.rejects(
      async () => {
        await savedPostModel.savePost(USER_ID, POST_ID);
      },
      (err) => {
        assert.equal(err.code, "POST_NOT_FOUND");
        assert.equal(err.status, 404);
        return true;
      }
    );
  });

  it("unsaves a post", async () => {
    query.setImpl(async () => ({ rowCount: 1, rows: [{ id: "saved-id" }] }));

    const result = await savedPostModel.unsavePost(USER_ID, POST_ID);
    assert.deepEqual(result, { saved: false, postId: POST_ID, removed: true });

    const [sql, params] = query.calls[0];
    assert.match(sql, /DELETE FROM public\.saved_posts/i);
    assert.deepEqual(params, [USER_ID, POST_ID]);
  });

  it("lists saved posts joined with visible_posts", async () => {
    query.setImpl(async () => ({
      rows: [
        {
          id: POST_ID,
          title: "My Saved Post",
          content: "Important content",
          is_saved: true,
          saved_at: "2026-11-10T12:00:00Z",
        },
      ],
    }));

    const result = await savedPostModel.listSavedPosts(USER_ID, { limit: 10 });
    assert.equal(result.posts.length, 1);
    assert.equal(result.posts[0].id, POST_ID);

    const [sql, params] = query.calls[0];
    assert.match(sql, /FROM public\.saved_posts sp/i);
    assert.match(sql, /JOIN visible_posts\(\$1::text\) p ON sp\.post_id = p\.id/i);
    assert.equal(params[0], USER_ID);
  });
});

