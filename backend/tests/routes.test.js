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
const auditService = require("../services/auditService");

// The controllers fire off background notification/moderation work after
// responding. Stub it so the suite stays hermetic (and quiet).
stub(notificationService, "notifyAdminsOnPostCreated", async () => undefined);
stub(notificationService, "notifyAdminsOnThesisCreated", async () => undefined);
stub(notificationService, "notifyAdminsOnFlaggedContent", async () => undefined);
stub(notificationService, "notifyAuthorOnAction", async () => undefined);
stub(moderationService, "scanPost", async () => ({ flagged: false }));
stub(moderationService, "scanComment", async () => ({ flagged: false }));
stub(moderationService, "scanThesis", async () => ({ flagged: false }));
stub(thesisModel, "getFlaggedTheses", async () => []);
stub(auditService, "recordRequest", async () => undefined);

const STORAGE_URL = "https://test-project.supabase.co/storage/v1/object/public";

// The "session" the stubbed requireAuth resolves to.
const session = { id: "u1", role: "student", department_id: null };

const defaultRequireAuth = (req, res, next) => {
  if (!(req.headers.authorization || "").startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: session.id };
  return next();
};
const defaultLoadProfile = (req, res, next) => {
  req.profile = { id: session.id, role: session.role, department_id: session.department_id };
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
  getComments: stub(postModel, "getComments"),
  addComment: stub(postModel, "addComment"),
  updatePostModeration: stub(postModel, "updatePostModeration"),
  updateCommentModeration: stub(postModel, "updateCommentModeration"),
  adminDeletePost: stub(postModel, "adminDeletePost"),
  deleteComment: stub(postModel, "deleteComment"),
  updateCommentByAuthor: stub(postModel, "updateCommentByAuthor"),
  deleteCommentByAuthor: stub(postModel, "deleteCommentByAuthor"),
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
  session.department_id = null;
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

describe("comments stay hidden with their parent post", () => {
  it("404s when listing comments for a hidden or missing post", async () => {
    m.getPostById.setImpl(async () => undefined);

    const res = await request(app).get("/api/posts/p1/comments").set(AUTH);

    assert.equal(res.status, 404);
    assert.equal(m.getComments.calls.length, 0);
  });

  it("404s when commenting on a hidden or missing post", async () => {
    m.getPostById.setImpl(async () => undefined);

    const res = await request(app)
      .post("/api/posts/p1/comments")
      .set(AUTH)
      .send({ content: "Hello" });

    assert.equal(res.status, 404);
    assert.equal(m.addComment.calls.length, 0);
  });
});

describe("comments: the author can edit and delete their own", () => {
  it("401s on both routes without a token", async () => {
    const put = await request(app).put("/api/posts/p1/comments/c1").send({ content: "x" });
    const del = await request(app).delete("/api/posts/p1/comments/c1");

    assert.equal(put.status, 401);
    assert.equal(del.status, 401);
    assert.equal(m.updateCommentByAuthor.calls.length, 0);
    assert.equal(m.deleteCommentByAuthor.calls.length, 0);
  });

  it("404 when the edit matched no owned (or hidden) comment", async () => {
    m.updateCommentByAuthor.setImpl(async () => undefined);

    const res = await request(app)
      .put("/api/posts/p1/comments/c1")
      .set(AUTH)
      .send({ content: "edited" });

    assert.equal(res.status, 404);
    // Caller identity comes from the token; post + comment come from the path.
    assert.deepEqual(m.updateCommentByAuthor.calls, [["c1", "p1", "u1", "edited"]]);
  });

  it("404 when deleting a comment that is not owned", async () => {
    m.deleteCommentByAuthor.setImpl(async () => undefined);

    const res = await request(app).delete("/api/posts/p1/comments/c1").set(AUTH);

    assert.equal(res.status, 404);
    assert.deepEqual(m.deleteCommentByAuthor.calls, [["c1", "p1", "u1"]]);
  });

  it("400 when the new content is blank", async () => {
    const res = await request(app)
      .put("/api/posts/p1/comments/c1")
      .set(AUTH)
      .send({ content: "   " });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, "Validation failed");
    assert.equal(m.updateCommentByAuthor.calls.length, 0);
  });

  it("rejects a client-supplied user_id with 400", async () => {
    const res = await request(app)
      .put("/api/posts/p1/comments/c1")
      .set(AUTH)
      .send({ content: "hi", user_id: "u9" });

    assert.equal(res.status, 400);
    assert.ok(res.body.fields.some((f) => f.path === "user_id"));
    assert.equal(m.updateCommentByAuthor.calls.length, 0);
  });

  it("returns the updated comment on a successful edit", async () => {
    m.updateCommentByAuthor.setImpl(async () => ({ id: "c1", content: "edited" }));

    const res = await request(app)
      .put("/api/posts/p1/comments/c1")
      .set(AUTH)
      .send({ content: "  edited  " });

    assert.equal(res.status, 200);
    // The schema trims, so SQL receives the clean value.
    assert.deepEqual(m.updateCommentByAuthor.calls, [["c1", "p1", "u1", "edited"]]);
    assert.equal(res.body.content, "edited");
  });

  it("re-scans an edited comment and flags it when the scanner matches", async () => {
    m.updateCommentByAuthor.setImpl(async () => ({ id: "c1", content: "bad words" }));
    moderationService.scanComment.setImpl(async () => ({ flagged: true, reason: "language" }));
    try {
      const res = await request(app)
        .put("/api/posts/p1/comments/c1")
        .set(AUTH)
        .send({ content: "bad words" });

      assert.equal(res.status, 200);
      // Let the background Promise.resolve() chain run before asserting.
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(m.updateCommentModeration.calls, [["c1", "flagged", "language"]]);
    } finally {
      moderationService.scanComment.setImpl(async () => ({ flagged: false }));
    }
  });

  it("deletes an owned comment and confirms the removal", async () => {
    m.deleteCommentByAuthor.setImpl(async () => ({ id: "c1" }));

    const res = await request(app).delete("/api/posts/p1/comments/c1").set(AUTH);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Comment deleted successfully");
    assert.deepEqual(m.deleteCommentByAuthor.calls, [["c1", "p1", "u1"]]);
  });
});

describe("profile writes: self-or-admin only", () => {
  it("403 when a student edits someone else's profile", async () => {
    const res = await request(app).put("/api/users/u9").set(AUTH).send({ full_name: "Nope" });

    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: "Forbidden" });
    assert.equal(m.updateUser.calls.length, 0);
  });

  it("rejects a role write through the legacy profile endpoint", async () => {
    m.updateUser.setImpl(async () => ({ id: "u1" }));

    const res = await request(app)
      .put("/api/users/u1")
      .set(AUTH)
      .send({ full_name: "Me", role: "superadmin" });

    assert.equal(res.status, 400);
    assert.equal(m.updateUser.calls.length, 0, "role writes must use the admin endpoint");
  });

  it("rejects an admin role change through the legacy profile endpoint", async () => {
    session.id = "admin1";
    session.role = "admin";
    m.getUserById.setImpl(async () => ({ id: "u9", role: "student" }));
    m.updateUser.setImpl(async () => ({ id: "u9" }));

    const res = await request(app).put("/api/users/u9").set(AUTH).send({ role: "faculty" });

    assert.equal(res.status, 400);
    assert.equal(m.updateUser.calls.length, 0);
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
  it("rejects an admin promoting itself to superadmin", async () => {
    session.id = "admin1";
    session.role = "admin";

    const res = await request(app)
      .put("/api/users/admin1")
      .set(AUTH)
      .send({ role: "superadmin" });

    assert.equal(res.status, 400);
    assert.equal(m.updateUser.calls.length, 0, "the escalation must never reach the DB");
  });

  it("rejects the camelCase `superAdmin` spelling too", async () => {
    session.id = "admin1";
    session.role = "admin";

    const res = await request(app)
      .put("/api/users/admin1")
      .set(AUTH)
      .send({ role: "superAdmin" });

    assert.equal(res.status, 400);
    assert.equal(m.updateUser.calls.length, 0);
  });

  it("rejects an admin granting superadmin to someone else", async () => {
    session.id = "admin1";
    session.role = "admin";
    m.getUserById.setImpl(async () => ({ id: "u9", role: "student" }));

    const res = await request(app).put("/api/users/u9").set(AUTH).send({ role: "superadmin" });

    assert.equal(res.status, 400);
    assert.equal(m.updateUser.calls.length, 0);
  });

  it("rejects a superadmin role grant through the legacy endpoint too", async () => {
    session.id = "super1";
    session.role = "superadmin";
    m.getUserById.setImpl(async () => ({ id: "u9", role: "admin" }));
    m.updateUser.setImpl(async () => ({ id: "u9" }));

    const res = await request(app).put("/api/users/u9").set(AUTH).send({ role: "superadmin" });

    assert.equal(res.status, 400);
    assert.equal(m.updateUser.calls.length, 0);
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

  it("does not let an admin delete a lower-ranked account through the legacy route", async () => {
    session.id = "admin1";
    session.role = "admin";
    m.getUserById.setImpl(async () => ({ id: "s1", role: "student" }));
    m.deleteUser.setImpl(async () => ({ id: "s1" }));

    const res = await request(app).delete("/api/users/s1").set(AUTH);

    assert.equal(res.status, 403);
    assert.equal(m.deleteUser.calls.length, 0);
  });

  it("never looks up the target for a non-admin (no id probing)", async () => {
    const res = await request(app).delete("/api/users/ghost").set(AUTH);

    assert.equal(res.status, 403);
    assert.equal(m.getUserById.calls.length, 0);
  });
});

// --- RBAC regression tests (moderation department scope) -------------------
// Scope is decided by the `department_id` catalog UUID, never a display string.
describe("moderation is confined to a department admin's own department", () => {
  const DEPT_A = "11111111-1111-4111-8111-111111111111";
  const DEPT_B = "22222222-2222-4222-8222-222222222222";

  it("403 when a departmentAdmin moderates a comment from another department", async () => {
    session.role = "departmentAdmin";
    session.department_id = DEPT_A;
    m.getCommentById.setImpl(async () => ({ id: "c1", author: { department_id: DEPT_B } }));

    const res = await request(app)
      .post("/api/moderation/comments/c1")
      .set(AUTH)
      .send({ action: "hide", reason: "Department scope check" });

    assert.equal(res.status, 403);
    assert.equal(m.updateCommentModeration.calls.length, 0);
  });

  it("403 for a permanent delete outside the department", async () => {
    session.role = "departmentAdmin";
    session.department_id = DEPT_A;
    m.getCommentById.setImpl(async () => ({ id: "c1", author: { department_id: DEPT_B } }));

    const res = await request(app)
      .post("/api/moderation/comments/c1")
      .set(AUTH)
      .send({ action: "delete", reason: "Department scope check" });

    assert.equal(res.status, 403);
    assert.equal(m.deleteComment.calls.length, 0);
  });

  it("allows a comment in the same department", async () => {
    session.role = "departmentAdmin";
    session.department_id = DEPT_A;
    m.getCommentById.setImpl(async () => ({ id: "c1", author: { department_id: DEPT_A } }));
    m.updateCommentModeration.setImpl(async () => ({ id: "c1" }));

    const res = await request(app)
      .post("/api/moderation/comments/c1")
      .set(AUTH)
      .send({ action: "hide", reason: "Department scope check" });

    assert.equal(res.status, 200);
    assert.equal(m.updateCommentModeration.calls.length, 1);
  });

  it("fails closed when the moderator has no department on file", async () => {
    session.role = "departmentAdmin";
    session.department_id = null;
    m.getPostById.setImpl(async () => ({ id: "p1", author: { department_id: DEPT_A } }));

    const res = await request(app)
      .post("/api/moderation/posts/p1")
      .set(AUTH)
      .send({ action: "hide", reason: "Department scope check" });

    assert.equal(res.status, 403);
    assert.equal(m.updatePostModeration.calls.length, 0);
  });

  it("fails closed when the content has no department on file", async () => {
    session.role = "departmentAdmin";
    session.department_id = DEPT_A;
    m.getPostById.setImpl(async () => ({ id: "p1", author: { department_id: null } }));

    const res = await request(app)
      .post("/api/moderation/posts/p1")
      .set(AUTH)
      .send({ action: "hide", reason: "Department scope check" });

    assert.equal(res.status, 403);
    assert.equal(m.updatePostModeration.calls.length, 0);
  });

  it("does not scope a campus admin to a department", async () => {
    session.role = "superadmin";
    session.department_id = null;
    m.getPostById.setImpl(async () => ({ id: "p1", author: { department_id: DEPT_B } }));
    m.updatePostModeration.setImpl(async () => ({ id: "p1" }));

    const res = await request(app)
      .post("/api/moderation/posts/p1")
      .set(AUTH)
      .send({ action: "hide", reason: "Department scope check" });

    assert.equal(res.status, 200);
    assert.equal(m.updatePostModeration.calls.length, 1);
  });
});

describe("file uploads use storage object keys", () => {
  it("rejects an external URL on a post image", async () => {
    const res = await request(app)
      .post("/api/posts")
      .set(AUTH)
      .send({ content: "x", type: "image", image_url: "https://evil.example/x.jpg" });

    assert.equal(res.status, 400);
    assert.equal(m.createPost.calls.length, 0);
  });

  it("rejects a full storage URL on a post image (keys only)", async () => {
    const res = await request(app)
      .post("/api/posts")
      .set(AUTH)
      .send({
        content: "x",
        type: "image",
        image_url: `${STORAGE_URL}/assets/posts/a.jpg`,
      });

    assert.equal(res.status, 400);
    assert.equal(m.createPost.calls.length, 0);
  });

  it("accepts a bucket-relative storage key on a post image", async () => {
    m.createPost.setImpl(async (data) => ({ id: "p2" }));

    const res = await request(app)
      .post("/api/posts")
      .set(AUTH)
      .send({ content: "x", type: "image", image_url: "posts/a/b.jpg" });

    assert.equal(res.status, 201);
    assert.deepEqual(m.createPost.calls.at(-1)[0].image_url, "posts/a/b.jpg");
  });

  it("rejects an external URL on a thesis pdf", async () => {
    const res = await request(app).post("/api/theses").set(AUTH).send({
      title: "t",
      abstract: "a",
      category: "c",
      pdf_url: "https://w3.org/dummy.pdf",
    });

    assert.equal(res.status, 400);
    assert.equal(m.createThesis.calls.length, 0);
  });

  it("accepts a bucket-relative storage key on a thesis pdf", async () => {
    m.createThesis.setImpl(async (data) => ({ id: "t2" }));

    const res = await request(app).post("/api/theses").set(AUTH).send({
      title: "t",
      abstract: "a",
      category: "c",
      pdf_url: "u1/2.pdf",
    });

    assert.equal(res.status, 201);
    assert.deepEqual(m.createThesis.calls.at(-1)[0].pdf_url, "u1/2.pdf");
  });

  it("rejects a client-supplied department on a thesis (server-derived)", async () => {
    const res = await request(app).post("/api/theses").set(AUTH).send({
      title: "t",
      abstract: "a",
      department: "somewhere else",
      category: "c",
      pdf_url: "u1/2.pdf",
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
    assert.deepEqual(m.getAllPosts.calls.at(-1), [
      { limit: 100, cursor: null, q: null, authorId: null },
    ]);

    await request(app)
      .get("/api/posts")
      .query({ limit: 2, cursor: "2026-01-01T00:00:00.000Z|abc" })
      .set(AUTH);
    assert.deepEqual(m.getAllPosts.calls.at(-1), [
      {
        limit: 2,
        cursor: "2026-01-01T00:00:00.000Z|abc",
        q: null,
        authorId: null,
      },
    ]);
  });

  it("applies the same clamping to theses and users", async () => {
    session.role = "admin";
    m.getAllTheses.setImpl(async () => []);
    m.getAllUsers.setImpl(async () => []);

    await request(app).get("/api/theses?limit=9999").set(AUTH);
    assert.deepEqual(m.getAllTheses.calls.at(-1), [
      {
        limit: 100,
        cursor: null,
        q: null,
        uploaderId: null,
        categories: null,
      },
    ]);

    await request(app).get("/api/users?limit=0").set(AUTH);
    assert.deepEqual(m.getAllUsers.calls.at(-1), [{ limit: 100, cursor: null }]);
  });
});

describe("post list filters", () => {
  const AUTHOR = "11111111-1111-4111-8111-111111111111";

  it("passes a trimmed search term and author id to the model", async () => {
    m.getAllPosts.setImpl(async () => []);

    const res = await request(app)
      .get("/api/posts")
      .query({ q: "  react  ", author_id: AUTHOR, limit: 5 })
      .set(AUTH);

    assert.equal(res.status, 200);
    assert.deepEqual(m.getAllPosts.calls.at(-1), [
      { limit: 5, cursor: null, q: "react", authorId: AUTHOR },
    ]);
  });

  it("caps an overlong search term at 100 characters", async () => {
    m.getAllPosts.setImpl(async () => []);

    await request(app)
      .get("/api/posts")
      .query({ q: "x".repeat(150) })
      .set(AUTH);

    assert.equal(m.getAllPosts.calls.at(-1)[0].q.length, 100);
  });

  it("rejects a malformed author_id instead of letting Postgres cast it", async () => {
    const res = await request(app)
      .get("/api/posts?author_id=not-a-uuid")
      .set(AUTH);

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: "Invalid author_id" });
    assert.equal(m.getAllPosts.calls.length, 0);
  });
});

describe("thesis list filters", () => {
  const UPLOADER = "22222222-2222-4222-8222-222222222222";

  it("passes search, uploader, and category filters to the model", async () => {
    m.getAllTheses.setImpl(async () => []);

    const res = await request(app)
      .get("/api/theses")
      .query({
        q: "  ai  ",
        uploader_id: UPLOADER,
        category: "Graduate Dissertation",
        limit: 5,
      })
      .set(AUTH);

    assert.equal(res.status, 200);
    assert.deepEqual(m.getAllTheses.calls.at(-1), [
      {
        limit: 5,
        cursor: null,
        q: "ai",
        uploaderId: UPLOADER,
        categories: ["Graduate Dissertation"],
      },
    ]);
  });

  it("maps the undergraduate label to the legacy Capstone rows", async () => {
    m.getAllTheses.setImpl(async () => []);

    await request(app)
      .get("/api/theses")
      .query({ category: "Undergraduate Capstone" })
      .set(AUTH);

    assert.deepEqual(m.getAllTheses.calls.at(-1)[0].categories, [
      "Undergraduate Capstone",
      "Capstone",
    ]);
  });

  it("rejects a malformed uploader_id with 400", async () => {
    const res = await request(app)
      .get("/api/theses?uploader_id=nope")
      .set(AUTH);

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: "Invalid uploader_id" });
    assert.equal(m.getAllTheses.calls.length, 0);
  });
});
