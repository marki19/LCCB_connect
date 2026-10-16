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

// `requireAuth` calls `supabase.auth.getUser(token)` at request time.
const getUser = stub(auth.supabase.auth, "getUser", async () => ({
  data: { user: null },
  error: { message: "not stubbed" },
}));

// Route handlers must not touch a database.
stub(postModel, "getAllPosts", async () => []);

// Imported only after the stubs are installed.
const app = require("../app");

beforeEach(() => {
  getUser.calls.length = 0;
  getUser.setImpl(async () => ({ data: { user: null }, error: { message: "not stubbed" } }));
});

describe("requireAuth", () => {
  it("401 when there is no Authorization header", async () => {
    const res = await request(app).get("/api/posts");

    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: "Authentication required" });
    assert.equal(getUser.calls.length, 0, "Supabase must not be called without a token");
  });

  it("401 when the Authorization scheme is not Bearer", async () => {
    const res = await request(app).get("/api/posts").set("Authorization", "Basic dXNlcjpwYXNz");

    assert.equal(res.status, 401);
    assert.equal(getUser.calls.length, 0);
  });

  it("401 when Supabase rejects the token", async () => {
    getUser.setImpl(async () => ({ data: { user: null }, error: { message: "invalid JWT" } }));

    const res = await request(app).get("/api/posts").set("Authorization", "Bearer forged");

    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: "Invalid or expired token" });
    assert.deepEqual(getUser.calls, [["forged"]]);
  });

  it("401 when Supabase returns no user even without an error", async () => {
    getUser.setImpl(async () => ({ data: { user: null }, error: null }));

    const res = await request(app).get("/api/posts").set("Authorization", "Bearer anon-key");

    assert.equal(res.status, 401);
  });

  it("allows the request through with a valid token", async () => {
    getUser.setImpl(async () => ({ data: { user: { id: "u1", email: "a@b.c" } }, error: null }));

    const res = await request(app).get("/api/posts").set("Authorization", "Bearer good");

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
    assert.deepEqual(getUser.calls, [["good"]]);
  });

  it("protects every /api mount", async () => {
    const paths = ["/api/posts", "/api/posts/abc", "/api/theses", "/api/users", "/api/users/u1"];

    for (const path of paths) {
      const res = await request(app).get(path);
      assert.equal(res.status, 401, `${path} should require auth`);
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
