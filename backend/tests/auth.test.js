// Verifies the REAL requireAuth middleware, with only the Supabase token check
// stubbed. Covers: missing token, wrong scheme, rejected token, accepted token,
// and that every /api mount is protected.
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const auth = require("../middleware/auth");
const postModel = require("../models/postModel");
const thesisModel = require("../models/thesisModel");
const userModel = require("../models/userModel");

// `requireAuth` calls `supabase.auth.getUser(token)` at request time.
const getUser = stub(auth.supabase.auth, "getUser", async () => ({
  data: { user: null },
  error: { message: "not stubbed" },
}));
const getClaims = stub(auth.supabase.auth, "getClaims", async () => ({
  data: null,
  error: { message: "not stubbed" },
}));

// Route handlers must not touch a database.
stub(postModel, "getAllPosts", async () => []);
stub(thesisModel, "getAllTheses", async () => []);
stub(userModel, "getAllUsers", async () => []);
// Every authenticated mount now loads the profile so suspended accounts are
// blocked. Auth tests only exercise the middleware, so return a minimal row.
const getProfile = stub(userModel, "getUserById", async (id) => ({ id, role: "student" }));

// Imported only after the stubs are installed.
const app = require("../app");

beforeEach(() => {
  getUser.calls.length = 0;
  getUser.setImpl(async () => ({ data: { user: null }, error: { message: "not stubbed" } }));
  getClaims.calls.length = 0;
  getClaims.setImpl(async () => ({ data: null, error: { message: "not stubbed" } }));
});

describe("requireAuth", () => {
  it("401 when there is no Authorization header", async () => {
    const res = await request(app).post("/api/posts");

    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: "Authentication required" });
    assert.equal(getUser.calls.length, 0, "Supabase must not be called without a token");
  });

  it("401 when the Authorization scheme is not Bearer", async () => {
    const res = await request(app).post("/api/posts").set("Authorization", "Basic dXNlcjpwYXNz");

    assert.equal(res.status, 401);
    assert.equal(getUser.calls.length, 0);
  });

  it("401 when Supabase rejects the token", async () => {
    getUser.setImpl(async () => ({ data: { user: null }, error: { message: "invalid JWT" } }));

    const res = await request(app).post("/api/posts").set("Authorization", "Bearer forged");

    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: "Invalid or expired token" });
    assert.deepEqual(getUser.calls, [["forged"]]);
  });

  it("401 when Supabase returns no user even without an error", async () => {
    getUser.setImpl(async () => ({ data: { user: null }, error: null }));

    const res = await request(app).post("/api/posts").set("Authorization", "Bearer anon-key");

    assert.equal(res.status, 401);
  });

  it("accepts a verified JWT after its session was revoked", async () => {
    getUser.setImpl(async () => ({
      data: { user: null },
      error: { message: "Auth session missing!" },
    }));
    getClaims.setImpl(async () => ({
      data: {
        claims: {
          sub: "u1",
          email: "a@b.c",
          aud: "authenticated",
          role: "authenticated",
        },
      },
      error: null,
    }));

    const res = await request(app).get("/api/posts").set("Authorization", "Bearer suspended");

    assert.equal(res.status, 200);
    assert.deepEqual(getUser.calls, [["suspended"]]);
    assert.deepEqual(getClaims.calls, [["suspended"]]);
  });

  it("rejects a revoked JWT when its profile was deleted", async () => {
    getUser.setImpl(async () => ({
      data: { user: null },
      error: { message: "Auth session missing!" },
    }));
    getClaims.setImpl(async () => ({
      data: { claims: { sub: "gone", aud: "authenticated" } },
      error: null,
    }));
    getProfile.setImpl(async () => null);
    try {
      const res = await request(app).get("/api/posts").set("Authorization", "Bearer deleted");
      assert.equal(res.status, 401);
      assert.deepEqual(res.body, { error: "Invalid or expired token" });
    } finally {
      getProfile.setImpl(async (id) => ({ id, role: "student" }));
    }
  });

  it("allows the request through with a valid token", async () => {
    getUser.setImpl(async () => ({ data: { user: { id: "u1", email: "a@b.c" } }, error: null }));

    const res = await request(app).get("/api/posts").set("Authorization", "Bearer good");

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
    assert.deepEqual(getUser.calls, [["good"]]);
  });

  it("protects mutating actions across all API mounts", async () => {
    const paths = [
      ["post", "/api/posts"],
      ["put", "/api/posts/p1"],
      ["delete", "/api/posts/p1"],
      ["post", "/api/theses"],
      ["post", "/api/users"],
      ["get", "/api/moderation"],
      // Messaging / social graph mounts (Phase 2) — the same real requireAuth.
      ["get", "/api/conversations"],
      ["post", "/api/conversations"],
      ["post", "/api/messages/p1/delivered"],
      ["get", "/api/friends"],
      ["get", "/api/users/me/message-policy"],
      ["post", "/api/users/me/presence"],
    ];

    for (const [method, path] of paths) {
      const res = await request(app)[method](path);
      assert.equal(res.status, 401, `${method.toUpperCase()} ${path} should require auth`);
    }
  });

  it("keeps the authenticated API closed and serves reads from /api/public", async () => {
    // The /api/* collections require a bearer token...
    for (const path of ["/api/posts", "/api/theses", "/api/users"]) {
      const res = await request(app).get(path);
      assert.equal(res.status, 401, `GET ${path} should require auth`);
    }

    // ...public, read-only browsing is served by the dedicated /api/public router.
    for (const path of ["/api/public/posts", "/api/public/theses", "/api/public/peers"]) {
      const res = await request(app).get(path);
      assert.equal(res.status, 200, `GET ${path} should be publicly readable`);
    }
  });

  it("keeps / public and returns a JSON 404 for unknown routes", async () => {
    const root = await request(app).get("/");
    assert.equal(root.status, 200);
    assert.deepEqual(root.body, { message: "Backend is running!" });

    const missing = await request(app).get("/definitely-not-a-route");
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, { error: "Not found" });
  });
});
