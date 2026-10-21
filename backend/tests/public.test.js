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
  getComments: stub(postModel, "getComments", async () => []),
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

  it("passes public post search and author filters to the model", async () => {
    const authorId = "11111111-1111-4111-8111-111111111111";
    m.getAllPosts.setImpl(async () => []);

    await request(app)
      .get("/api/public/posts")
      .query({ q: "  react  ", author_id: authorId, limit: 5 });

    assert.deepEqual(m.getAllPosts.calls.at(-1), [
      { limit: 5, cursor: null, q: "react", authorId },
    ]);
  });

  it("rejects a malformed public author_id with 400", async () => {
    const res = await request(app).get("/api/public/posts?author_id=nope");

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: "Invalid author_id" });
    assert.equal(m.getAllPosts.calls.length, 0);
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

  it("returns comments for a visible public post", async () => {
    m.getPostById.setImpl(async () => ({
      id: "p1",
      moderation_status: "approved",
    }));
    m.getComments.setImpl(async () => [{ id: "c1", content: "Hello" }]);

    const res = await request(app).get("/api/public/posts/p1/comments");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.deepEqual(m.getComments.calls.at(-1), [
      "p1",
      { includeHidden: false },
    ]);
  });

  it("returns 404 for comments on a hidden or missing public post", async () => {
    m.getPostById.setImpl(async () => null);

    const res = await request(app).get("/api/public/posts/p1/comments");
    assert.equal(res.status, 404);
    assert.equal(m.getComments.calls.length, 0);
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

  it("passes public thesis search, uploader, and category filters to the model", async () => {
    const uploaderId = "22222222-2222-4222-8222-222222222222";
    m.getAllTheses.setImpl(async () => []);

    await request(app)
      .get("/api/public/theses")
      .query({
        q: "ai",
        uploader_id: uploaderId,
        category: "Graduate Dissertation",
        limit: 5,
      });

    assert.deepEqual(m.getAllTheses.calls.at(-1), [
      {
        limit: 5,
        cursor: null,
        q: "ai",
        uploaderId,
        categories: ["Graduate Dissertation"],
      },
    ]);
  });

  it("rejects a malformed public uploader_id with 400", async () => {
    const res = await request(app).get("/api/public/theses?uploader_id=nope");

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: "Invalid uploader_id" });
    assert.equal(m.getAllTheses.calls.length, 0);
  });

  it("excludes hidden theses from the public response even if the model leaks one", async () => {
    m.getAllTheses.setImpl(async () => [
      { id: "t1", title: "Visible", moderation_status: "approved" },
      { id: "t2", title: "Hidden", moderation_status: "hidden" },
    ]);

    const res = await request(app).get("/api/public/theses");
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((thesis) => thesis.id),
      ["t1"]
    );
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
    assert.equal(res.body[0].bio, undefined);
    assert.equal(res.body[0].role, undefined);
    assert.equal(res.body[0].course, undefined);
    assert.equal(res.body[0].department_id, undefined);
  });

  it("passes public peer search, department, and year filters to the model", async () => {
    const departmentId = "33333333-3333-4333-8333-333333333333";
    m.getAllUsers.setImpl(async () => []);

    await request(app)
      .get("/api/public/peers")
      .query({
        q: "  jane  ",
        department_id: departmentId,
        year_level: "3rd Year",
        limit: 5,
      });

    assert.deepEqual(m.getAllUsers.calls.at(-1), [
      {
        limit: 5,
        cursor: null,
        q: "jane",
        departmentId,
        yearLevel: "3rd Year",
      },
    ]);
  });

  it("rejects a malformed public department_id with 400", async () => {
    const res = await request(app).get("/api/public/peers?department_id=nope");

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: "Invalid department_id" });
    assert.equal(m.getAllUsers.calls.length, 0);
  });

  it("rejects write requests on /api/public", async () => {
    const res = await request(app).post("/api/public/posts").send({ content: "spam" });
    assert.equal(res.status, 404);
  });

  it("blocks private, local, and metadata IP targets from link preview (SSRF protection)", async () => {
    const { validateUrlSafety } = require("../services/previewService");

    const blockedTargets = [
      "http://localhost:3000",
      "http://127.0.0.1/admin",
      "http://169.254.169.254/latest/meta-data",
      "http://100.64.0.1/",
      "http://198.18.0.1/",
      "http://224.0.0.1/",
      "http://240.0.0.1/",
      "http://[::1]/",
      "http://[::ffff:127.0.0.1]/",
      "http://[::ffff:7f00:1]/",
      "http://[::ffff:169.254.169.254]/",
      "http://[fc01::1]/",
      "http://[fd12::1]/",
    ];

    for (const target of blockedTargets) {
      await assert.rejects(
        () => validateUrlSafety(target),
        /restricted/i,
        `Expected ${target} to be rejected`
      );
    }

    await assert.doesNotReject(
      () => validateUrlSafety("http://8.8.8.8/"),
      "Expected a public IP literal to be allowed"
    );

    await assert.rejects(
      () => validateUrlSafety("ftp://example.com"),
      /protocols are supported/i
    );
  });
});
