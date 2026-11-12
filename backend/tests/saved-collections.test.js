require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const db = require("../db");
const { stub } = require("./stub.helper");

const query = stub(db, "query", async () => ({ rows: [] }));
const savedCollectionModel = require("../models/savedCollectionModel");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const COLLECTION_ID = "33333333-3333-4333-8333-333333333333";
const POST_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  query.calls.length = 0;
  query.setImpl(async () => ({ rows: [] }));
});

describe("savedCollectionModel", () => {
  it("lists collections for user with item counts", async () => {
    query.setImpl(async () => ({
      rows: [
        {
          id: COLLECTION_ID,
          name: "Thesis References",
          is_private: true,
          item_count: 3,
          cover_image: "assets/img1.jpg",
        },
      ],
    }));

    const rows = await savedCollectionModel.listCollections(USER_ID);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, "Thesis References");
    assert.equal(rows[0].item_count, 3);

    const [sql, params] = query.calls[0];
    assert.match(sql, /FROM public\.saved_collections sc/i);
    assert.deepEqual(params, [USER_ID]);
  });

  it("creates a new collection", async () => {
    query.setImpl(async () => ({
      rows: [
        {
          id: COLLECTION_ID,
          user_id: USER_ID,
          name: "Study Materials",
          is_private: true,
          created_at: new Date().toISOString(),
        },
      ],
    }));

    const result = await savedCollectionModel.createCollection(USER_ID, "Study Materials", true);
    assert.equal(result.name, "Study Materials");
    assert.equal(result.is_private, true);

    const [sql, params] = query.calls[0];
    assert.match(sql, /INSERT INTO public\.saved_collections/i);
    assert.deepEqual(params, [USER_ID, "Study Materials", true]);
  });

  it("adds item to collection after verifying ownership", async () => {
    query.setImpl(async (sql) => {
      if (sql.includes("SELECT id FROM public.saved_collections")) {
        return { rows: [{ id: COLLECTION_ID }] };
      }
      return { rows: [{ collection_id: COLLECTION_ID, post_id: POST_ID }] };
    });

    const result = await savedCollectionModel.addItemToCollection(USER_ID, COLLECTION_ID, POST_ID);
    assert.equal(result.collection_id, COLLECTION_ID);
    assert.equal(result.post_id, POST_ID);
    assert.equal(query.calls.length, 3); // check ownership, ensure saved, insert collection item
  });

  it("rejects adding item to another user's collection", async () => {
    query.setImpl(async () => ({ rows: [] })); // collection not found

    await assert.rejects(
      async () => {
        await savedCollectionModel.addItemToCollection(USER_ID, COLLECTION_ID, POST_ID);
      },
      (err) => {
        assert.equal(err.status, 404);
        return true;
      }
    );
  });

  it("removes item from collection", async () => {
    query.setImpl(async (sql) => {
      if (sql.includes("SELECT id FROM public.saved_collections")) {
        return { rows: [{ id: COLLECTION_ID }] };
      }
      return { rowCount: 1, rows: [] };
    });

    const result = await savedCollectionModel.removeItemFromCollection(USER_ID, COLLECTION_ID, POST_ID);
    assert.deepEqual(result, { success: true });
  });

  it("deletes a collection", async () => {
    query.setImpl(async () => ({ rows: [{ id: COLLECTION_ID }] }));

    const result = await savedCollectionModel.deleteCollection(USER_ID, COLLECTION_ID);
    assert.deepEqual(result, { success: true });
    const [sql, params] = query.calls[0];
    assert.match(sql, /DELETE FROM public\.saved_collections/i);
    assert.deepEqual(params, [COLLECTION_ID, USER_ID]);
  });
});

