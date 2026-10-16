// Authorization + validation behaviour. Auth and the models are stubbed, so the
// HTTP contract is asserted without a database or network.
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const auth = require("../middleware/auth");
const postModel = require("../models/postModel");
const thesisModel = require("../models/thesisModel");
const userModel = require("../models/userModel");
const notificationService = require("../services/notificationService");
const moderationService = require("../services/moderationService");

// The controllers fire off background notification/moderation work after
// responding. Stub it so the suite stays hermetic (and quiet).
stub(notificationService, "notifyAdminsOnPostCreated", async () => undefined);
stub(notificationService, "notifyAdminsOnThesisCreated", async () => undefined);
stub(notificationService, "notifyAdminsOnFlaggedContent", async () => undefined);
stub(notificationService, "notifyAuthorOnAction", async () => undefined);
stub(moderationService, "scanPost", async () => ({ flagged: false }));
stub(moderationService, "scanComment", async () => ({ flagged: false }));
stub(moderationService, "scanThesis", async () => ({ flagged: false }));

const STORAGE_URL = "https://test-project.supabase.co/storage/v1/object/public";

// The "session" the stubbed requireAuth resolves to.
const session = { id: "u1", role: "student", course: null };

const defaultRequireAuth = (req, res, next) => {
  if (!(req.headers.authorization || "").startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: session.id };
  return next();
};
const defaultLoadProfile = (req, res, next) => {
  req.profile = { id: session.id, role: session.role, course: session.course };
  return next();
};

stub(auth, "requireAuth", defaultRequireAuth);
stub(auth, "loadProfile", defaultLoadProfile);

// Every model method the routes touch.
const m = {
  getAllPosts: stub(postModel, "getAllPosts"),
  getPostById: stub(postModel, "getPostById"),
  createPost: stub(postModel, "createPost"),
  updatePost: stub(postModel, "updatePost"),
  deletePost: stub(postModel, "deletePost"),
  toggleLike: stub(postModel, "toggleLike"),
  getCommentById: stub(postModel, "getCommentById"),
  updatePostModeration: stub(postModel, "updatePostModeration"),
  updateCommentModeration: stub(postModel, "updateCommentModeration"),
  adminDeletePost: stub(postModel, "adminDeletePost"),
  deleteComment: stub(postModel, "deleteComment"),
  getAllTheses: stub(thesisModel, "getAllTheses"),
  updateThesis: stub(thesisModel, "updateThesis"),
  createThesis: stub(thesisModel, "createThesis"),
  getAllUsers: stub(userModel, "getAllUsers"),
  getUserById: stub(userModel, "getUserById"),
  createUser: stub(userModel, "createUser"),
  updateUser: stub(userModel, "updateUser"),
  deleteUser: stub(userModel, "deleteUser"),
};

// Imported only after the stubs are installed.
const app = require("../app");
const AUTH = { Authorization: "Bearer test-token" };

beforeEach(() => {
  for (const fn of Object.values(m)) {
    fn.calls.length = 0;
    fn.setImpl(() => undefined);
  }
  session.id = "u1";
  session.role = "student";
  session.course = null;
});

describe("identity comes from the token, never the body", () => {
  it("stamps author_id from the token on create", async () => {
    m.createPost.setImpl(async (data) => ({ id: "p1", ...data }));

    const res = await request(app).post("/api/posts").set(AUTH).send({ content: "hello" });

    assert.equal(res.status, 201);
    // Server-controlled fields (moderation_status, etc.) may be added; the
    // contract under test is that `author_id` comes from the token and the
    // caller's own fields pass through.
    assert.equal(m.createPost.calls.length, 1);
    const sent = m.createPost.calls[0][0];
    assert.equal(sent.author_id, "u1");
    assert.equal(sent.content, "hello");
  });

  it("rejects a client-supplied author_id with 400", async () => {
    const res = await request(app)
      .post("/api/posts")
      .set(AUTH)
      .send({ content: "x", author_id: "u2" });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, "Validation failed");
    assert.ok(res.body.fields.some((f) => f.path === "author_id"));
    assert.equal(m.createPost.calls.length, 0);
  });

  it("stamps the liker from the token", async () => {
    m.toggleLike.setImpl(async () => ({ liked: true }));

    await request(app).post("/api/posts/p1/like").set(AUTH).send({ user_id: "u9" });

    assert.deepEqual(m.toggleLike.calls, [["p1", "u1"]]);
  });
});

describe("ownership is enforced in SQL (404, not 403)", () => {
  it("404 when the update matched no owned row", async () => {
    m.updatePost.setImpl(async () => undefined);

    const res = await request(app).put("/api/posts/abc").set(AUTH).send({ content: "x" });

    assert.equal(res.status, 404);
    assert.deepEqual(m.updatePost.calls, [["abc", "u1", { content: "x" }]]);
  });

  it("404 when deleting a post that is not owned", async () => {
    m.deletePost.setImpl(async () => undefined);

    const res = await request(app).delete("/api/posts/abc").set(AUTH);

    assert.equal(res.status, 404);
    assert.deepEqual(m.deletePost.calls, [["abc", "u1"]]);
  });

  it("404 when updating a thesis that is not owned", async () => {
    m.updateThesis.setImpl(async () => undefined);

    const res = await request(app).put("/api/theses/t1").set(AUTH).send({ title: "new" });

    assert.equal(res.status, 404);
  });
});

describe("profile writes: self-or-admin only", () => {
  it("403 when a student edits someone else's profile", async () => {
    const res = await request(app).put("/api/users/u9").set(AUTH).send({ full_name: "Nope" });

    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: "Forbidden" });
    assert.equal(m.updateUser.calls.length, 0);
  });

  it("lets a student edit their own profile but strips role", async () => {
    m.updateUser.setImpl(async () => ({ id: "u1" }));

    const res = await request(app)
      .put("/api/users/u1")
      .set(AUTH)
      .send({ full_name: "Me", role: "superadmin" });

    assert.equal(res.status, 200);
    const [id, payload] = m.updateUser.calls[0];
    assert.equal(id, "u1");
    assert.equal(payload.full_name, "Me");
    assert.equal(payload.role, undefined, "a student must not be able to set a role");
  });

  it("lets an admin change a role on a lower-ranked account", async () => {
    session.id = "admin1";
    session.role = "admin";
    m.getUserById.setImpl(async () => ({ id: "u9", role: "student" }));
    m.updateUser.setImpl(async () => ({ id: "u9" }));

    const res = await request(app).put("/api/users/u9").set(AUTH).send({ role: "faculty" });

    assert.equal(res.status, 200);
    assert.equal(m.updateUser.calls[0][1].role, "faculty");
  });

  it("never lets a caller self-assign a role at signup", async () => {
    await request(app).post("/api/users").set(AUTH).send({ full_name: "Me", role: "admin" });

    // `role` is not in createProfileSchema -> the strict object rejects it.
    assert.equal(m.createUser.calls.length, 0);
  });

  it("403 when a student deletes another account", async () => {
    const res = await request(app).delete("/api/users/u9").set(AUTH);

    assert.equal(res.status, 403);
    assert.equal(m.deleteUser.calls.length, 0);
  });
});

// --- RBAC regression tests (privilege hierarchy) ---------------------------
// An admin must not be able to raise its own rank, and must not be able to
// edit or delete an account of equal or higher rank.
describe("role escalation is closed", () => {
  it("403 when an admin tries to promote itself to superadmin", async () => {
    session.id = "admin1";
    session.role = "admin";

    const res = await request(app)
      .put("/api/users/admin1")
      .set(AUTH)
      .send({ role: "superadmin" });

    assert.equal(res.status, 403);
    assert.equal(m.updateUser.calls.length, 0, "the escalation must never reach the DB");
  });

  it("403 for the camelCase `superAdmin` spelling too", async () => {
    session.id = "admin1";
    session.role = "admin";

    const res = await request(app)
      .put("/api/users/admin1")
      .set(AUTH)
      .send({ role: "superAdmin" });

    assert.equal(res.status, 403);
    assert.equal(m.updateUser.calls.length, 0);
  });

  it("403 when an admin grants superadmin to someone else", async () => {
    session.id = "admin1";
    session.role = "admin";
    m.getUserById.setImpl(async () => ({ id: "u9", role: "student" }));

    const res = await request(app).put("/api/users/u9").set(AUTH).send({ role: "superadmin" });

    assert.equal(res.status, 403);
    assert.equal(m.updateUser.calls.length, 0);
  });

  it("lets a superadmin grant superadmin", async () => {
    session.id = "super1";
    session.role = "superadmin";
    m.getUserById.setImpl(async () => ({ id: "u9", role: "admin" }));
    m.updateUser.setImpl(async () => ({ id: "u9" }));

    const res = await request(app).put("/api/users/u9").set(AUTH).send({ role: "superadmin" });

    assert.equal(res.status, 200);
    assert.equal(m.updateUser.calls[0][1].role, "superadmin");
  });

  it("403 when an admin edits a peer admin", async () => {
    session.id = "admin1";
    session.role = "admin";
    m.getUserById.setImpl(async () => ({ id: "admin2", role: "admin" }));

    const res = await request(app)
      .put("/api/users/admin2")
      .set(AUTH)
      .send({ full_name: "Renamed" });

    assert.equal(res.status, 403);
    assert.equal(m.updateUser.calls.length, 0);
  });

  it("403 when an admin deletes a superadmin", async () => {
    session.id = "admin1";
    session.role = "admin";
    m.getUserById.setImpl(async () => ({ id: "super1", role: "superadmin" }));

    const res = await request(app).delete("/api/users/super1").set(AUTH);

    assert.equal(res.status, 403);
    assert.equal(m.deleteUser.calls.length, 0);
  });

  it("still lets an admin manage a lower-ranked account", async () => {
    session.id = "admin1";
    session.role = "admin";
    m.getUserById.setImpl(async () => ({ id: "s1", role: "student" }));
    m.deleteUser.setImpl(async () => ({ id: "s1" }));

    const res = await request(app).delete("/api/users/s1").set(AUTH);

    assert.equal(res.status, 200);
    assert.deepEqual(m.deleteUser.calls, [["s1"]]);
  });

  it("never looks up the target for a non-admin (no id probing)", async () => {
    const res = await request(app).delete("/api/users/ghost").set(AUTH);

    assert.equal(res.status, 403);
    assert.equal(m.getUserById.calls.length, 0);
  });
});

// --- RBAC regression tests (moderation department scope) -------------------
describe("moderation is confined to a department admin's own department", () => {
  it("403 when a departmentAdmin moderates a comment from another department", async () => {
    session.role = "departmentAdmin";
    session.course = "BSIT";
    m.getCommentById.setImpl(async () => ({ id: "c1", author: { course: "BSED" } }));

    const res = await request(app)
      .post("/api/moderation/comments/c1")
      .set(AUTH)
      .send({ action: "hide" });

    assert.equal(res.status, 403);
    assert.equal(m.updateCommentModeration.calls.length, 0);
  });

  it("403 for a permanent delete outside the department", async () => {
    session.role = "departmentAdmin";
    session.course = "BSIT";
    m.getCommentById.setImpl(async () => ({ id: "c1", author: { course: "BSED" } }));

    const res = await request(app)
      .post("/api/moderation/comments/c1")
      .set(AUTH)
      .send({ action: "delete" });

    assert.equal(res.status, 403);
    assert.equal(m.deleteComment.calls.length, 0);
  });

  it("allows a comment inside the department (case/whitespace insensitive)", async () => {
    session.role = "departmentAdmin";
    session.course = " bsit ";
    m.getCommentById.setImpl(async () => ({ id: "c1", author: { course: "BSIT" } }));
    m.updateCommentModeration.setImpl(async () => ({ id: "c1" }));

    const res = await request(app)
      .post("/api/moderation/comments/c1")
      .set(AUTH)
      .send({ action: "hide" });

    assert.equal(res.status, 200);
    assert.equal(m.updateCommentModeration.calls.length, 1);
  });

  it("fails closed when the moderator has no department on file", async () => {
    session.role = "departmentAdmin";
    session.course = null;
    m.getPostById.setImpl(async () => ({ id: "p1", author: { course: "BSIT" } }));

    const res = await request(app)
      .post("/api/moderation/posts/p1")
      .set(AUTH)
      .send({ action: "hide" });

    assert.equal(res.status, 403);
    assert.equal(m.updatePostModeration.calls.length, 0);
  });

  it("fails closed when the content has no department on file", async () => {
    session.role = "departmentAdmin";
    session.course = "BSIT";
    m.getPostById.setImpl(async () => ({ id: "p1", author: { course: null } }));

    const res = await request(app)
      .post("/api/moderation/posts/p1")
      .set(AUTH)
      .send({ action: "hide" });

    assert.equal(res.status, 403);
    assert.equal(m.updatePostModeration.calls.length, 0);
  });

  it("does not scope a campus admin to a department", async () => {
    session.role = "superadmin";
    session.course = null;
    m.getPostById.setImpl(async () => ({ id: "p1", author: { course: "BSED" } }));
    m.updatePostModeration.setImpl(async () => ({ id: "p1" }));

    const res = await request(app)
      .post("/api/moderation/posts/p1")
      .set(AUTH)
      .send({ action: "hide" });

    assert.equal(res.status, 200);
    assert.equal(m.updatePostModeration.calls.length, 1);
  });
});

describe("file URLs must live in this project's storage", () => {
  it("rejects an external image_url", async () => {
    const res = await request(app)
      .post("/api/posts")
      .set(AUTH)
      .send({ content: "x", type: "image", image_url: "https://evil.example/x.jpg" });

    assert.equal(res.status, 400);
    assert.equal(m.createPost.calls.length, 0);
  });

  it("accepts a storage-hosted image_url", async () => {
    m.createPost.setImpl(async () => ({ id: "p2" }));

    const res = await request(app)
      .post("/api/posts")
      .set(AUTH)
      .send({ content: "x", type: "image", image_url: `${STORAGE_URL}/assets/posts/a.jpg` });

    assert.equal(res.status, 201);
  });

  it("rejects an external pdf_url on a thesis", async () => {
    const res = await request(app).post("/api/theses").set(AUTH).send({
      title: "t",
      abstract: "a",
      department: "d",
      category: "c",
      pdf_url: "https://w3.org/dummy.pdf",
    });

    assert.equal(res.status, 400);
    assert.equal(m.createThesis.calls.length, 0);
  });
});

describe("errors and pagination limits", () => {
  it("returns a generic 500 and never leaks the DB error", async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      m.createPost.setImpl(async () => {
        throw new Error('duplicate key value violates unique constraint "secret_table_pkey"');
      });

      const res = await request(app).post("/api/posts").set(AUTH).send({ content: "x" });

      assert.equal(res.status, 500);
      assert.deepEqual(res.body, { error: "Internal server error" });
      assert.ok(!JSON.stringify(res.body).includes("secret_table"));
    } finally {
      console.error = originalError;
    }
  });

  it("clamps ?limit and passes ?cursor through to the model", async () => {
    m.getAllPosts.setImpl(async () => []);

    await request(app).get("/api/posts?limit=500").set(AUTH);
    assert.deepEqual(m.getAllPosts.calls.at(-1), [{ limit: 100, cursor: null }]);

    await request(app)
      .get("/api/posts")
      .query({ limit: 2, cursor: "2026-01-01T00:00:00.000Z|abc" })
      .set(AUTH);
    assert.deepEqual(m.getAllPosts.calls.at(-1), [
      { limit: 2, cursor: "2026-01-01T00:00:00.000Z|abc" },
    ]);
  });

  it("applies the same clamping to theses and users", async () => {
    m.getAllTheses.setImpl(async () => []);
    m.getAllUsers.setImpl(async () => []);

    await request(app).get("/api/theses?limit=9999").set(AUTH);
    assert.deepEqual(m.getAllTheses.calls.at(-1), [{ limit: 100, cursor: null }]);

    await request(app).get("/api/users?limit=0").set(AUTH);
    assert.deepEqual(m.getAllUsers.calls.at(-1), [{ limit: 100, cursor: null }]);
  });
});
