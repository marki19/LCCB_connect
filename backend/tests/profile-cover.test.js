require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { stub } = require("./stub.helper");

const auth = require("../middleware/auth");

let session = { id: "test-user-cover-1", role: "student" };

stub(auth, "requireAuth", (req, res, next) => {
  if (!(req.headers.authorization || "").startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: session.id };
  return next();
});

stub(auth, "loadProfile", (req, res, next) => {
  req.profile = { id: session.id, role: session.role };
  return next();
});

stub(auth, "requireActiveAccount", (req, res, next) => {
  return next();
});

const app = require("../app");
const filePolicy = require("../services/filePolicy");
const objectStorage = require("../services/objectStorage");
const db = require("../db");

describe("Cover photo policy & endpoints", () => {
  beforeEach(() => {
    session = { id: "test-user-cover-1", role: "student" };
  });

  it("covers category accepts 5MB max image and rejects >5MB", () => {
    const rules = filePolicy.CATEGORY_RULES.covers;
    assert.ok(rules);
    assert.equal(rules.maxBytes, 5 * 1024 * 1024);
    assert.deepEqual(rules.allowedExtensions.sort(), [".jpeg", ".jpg", ".png", ".webp"].sort());
    assert.equal(filePolicy.isPublicCategory("covers"), true);
  });

  it("PUT /api/users/me/cover rejects missing cover_url or non-covers category", async () => {
    const resNoUrl = await request(app)
      .put("/api/users/me/cover")
      .set("Authorization", "Bearer valid-token")
      .send({});
    assert.equal(resNoUrl.status, 400);

    const resWrongCat = await request(app)
      .put("/api/users/me/cover")
      .set("Authorization", "Bearer valid-token")
      .send({ cover_url: "avatars/abc123def4567890.jpg" });
    assert.equal(resWrongCat.status, 400);
  });

  it("PUT /api/users/me/cover updates cover and deletes old cover best-effort", async () => {
    let deletedKey = null;
    stub(objectStorage, "deleteObject", async (key) => {
      deletedKey = key;
      return true;
    });

    stub(db, "query", async (sql, params) => {
      if (sql.includes("SELECT cover_url FROM public.profiles")) {
        return { rows: [{ cover_url: "covers/aabbccddeeff00112233445566778899.jpg" }] };
      }
      if (sql.includes("UPDATE public.profiles") && sql.includes("cover_url = $1")) {
        return { rows: [{ id: params[1], cover_url: params[0] }] };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .put("/api/users/me/cover")
      .set("Authorization", "Bearer valid-token")
      .send({ cover_url: "covers/11223344556677889900aabbccddeeff.jpg" });

    assert.equal(res.status, 200);
    assert.equal(res.body.cover_url, "covers/11223344556677889900aabbccddeeff.jpg");
    assert.equal(deletedKey, "covers/aabbccddeeff00112233445566778899.jpg");
  });

  it("DELETE /api/users/me/cover removes cover and deletes file", async () => {
    let deletedKey = null;
    stub(objectStorage, "deleteObject", async (key) => {
      deletedKey = key;
      return true;
    });

    stub(db, "query", async (sql, params) => {
      if (sql.includes("SELECT cover_url FROM public.profiles")) {
        return { rows: [{ cover_url: "covers/mycover123456789.jpg" }] };
      }
      if (sql.includes("UPDATE public.profiles") && sql.includes("cover_url = NULL")) {
        return { rows: [{ id: params[0], cover_url: null }] };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .delete("/api/users/me/cover")
      .set("Authorization", "Bearer valid-token");

    assert.equal(res.status, 200);
    assert.equal(res.body.cover_url, null);
    assert.equal(deletedKey, "covers/mycover123456789.jpg");
  });

  it("GET /api/users/:id/friends returns 404 when user is not found or blocked", async () => {
    stub(db, "query", async (sql) => {
      if (sql.includes("FROM public.blocks")) {
        return { rows: [{ is_blocked: true }] };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .get("/api/users/blocked-user/friends")
      .set("Authorization", "Bearer valid-token");

    assert.equal(res.status, 404);
  });

  it("GET /api/users/:id/photos returns image posts", async () => {
    stub(db, "query", async (sql, params) => {
      if (sql.includes("LOWER(username) = LOWER($1)") || sql.includes("SELECT id FROM public.profiles")) {
        return { rows: [{ id: "target-user", username: "target" }] };
      }
      if (sql.includes("FROM public.blocks")) {
        return { rows: [{ is_blocked: false }] };
      }
      if (sql.includes("SELECT") && sql.includes("p.id") && sql.includes("friendship_status")) {
        return { rows: [{ id: "target-user", username: "target", full_name: "Target User" }] };
      }
      if (sql.includes("visible_posts")) {
        return {
          rows: [
            { post_id: "post-1", storage_key: "posts/photo1.jpg", sort_order: 0, created_at: new Date().toISOString() },
            { post_id: "post-2", storage_key: "posts/photo2.jpg", sort_order: 1, created_at: new Date().toISOString() },
          ],
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .get("/api/users/target-user/photos")
      .set("Authorization", "Bearer valid-token");

    assert.equal(res.status, 200);
    assert.equal(Array.isArray(res.body), true);
    assert.equal(res.body.length, 2);
  });
});
