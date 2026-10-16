require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const postModel = require("../models/postModel");
const thesisModel = require("../models/thesisModel");
const userModel = require("../models/userModel");

const m = {
  getAllPosts: stub(postModel, "getAllPosts", async () => []),
  getPostById: stub(postModel, "getPostById", async () => null),
  getCommentsByPostId: stub(postModel, "getCommentsByPostId", async () => []),
  getAllTheses: stub(thesisModel, "getAllTheses", async () => []),
  getThesisById: stub(thesisModel, "getThesisById", async () => null),
  getAllUsers: stub(userModel, "getAllUsers", async () => []),
};

const app = require("../app");

beforeEach(() => {
  for (const fn of Object.values(m)) {
    fn.calls.length = 0;
    fn.setImpl(() => undefined);
  }
});

describe("Public read-only endpoints (Guest Mode)", () => {
  it("allows unauthenticated GET /api/public/posts and excludes hidden posts", async () => {
    m.getAllPosts.setImpl(async () => [
      { id: "p1", title: "Visible Post", moderation_status: "approved" },
      { id: "p2", title: "Hidden Post", moderation_status: "hidden" },
    ]);

    const res = await request(app).get("/api/public/posts");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, "p1");
  });

  it("returns 404 for hidden posts on GET /api/public/posts/:id", async () => {
    m.getPostById.setImpl(async () => ({
      id: "p2",
      title: "Hidden",
      moderation_status: "hidden",
    }));

    const res = await request(app).get("/api/public/posts/p2");
    assert.equal(res.status, 404);
  });

  it("allows unauthenticated GET /api/public/theses", async () => {
    m.getAllTheses.setImpl(async () => [
      { id: "t1", title: "Thesis Research", department: "BSIT" },
    ]);

    const res = await request(app).get("/api/public/theses");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].title, "Thesis Research");
  });

  it("allows unauthenticated GET /api/public/peers and sanitizes profiles", async () => {
    m.getAllUsers.setImpl(async () => [
      {
        id: "u1",
        username: "jane",
        full_name: "Jane Doe",
        avatar_url: null,
        course: "BSIT",
        year_level: "3rd Year",
        bio: "Coder",
        role: "student",
        secret_internal_flag: "should not be exposed",
      },
    ]);

    const res = await request(app).get("/api/public/peers");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].username, "jane");
    assert.equal(res.body[0].secret_internal_flag, undefined);
  });

  it("rejects write requests on /api/public", async () => {
    const res = await request(app).post("/api/public/posts").send({ content: "spam" });
    assert.equal(res.status, 404);
  });

  it("blocks private, local, and metadata IP targets from link preview (SSRF protection)", async () => {
    const { validateUrlSafety } = require("../services/previewService");

    await assert.rejects(
      () => validateUrlSafety("http://localhost:3000"),
      /restricted/i
    );
    await assert.rejects(
      () => validateUrlSafety("http://127.0.0.1/admin"),
      /restricted/i
    );
    await assert.rejects(
      () => validateUrlSafety("http://169.254.169.254/latest/meta-data"),
      /restricted/i
    );
    await assert.rejects(
      () => validateUrlSafety("ftp://example.com"),
      /protocols are supported/i
    );
  });
});
