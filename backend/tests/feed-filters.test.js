require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const auth = require("../middleware/auth");

const VIEWER_ID = "11111111-1111-4111-8111-111111111111";

stub(auth, "requireAuth", (req, res, next) => {
  if (!(req.headers.authorization || "").startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: VIEWER_ID };
  return next();
});
stub(auth, "requireActiveAccount", (req, res, next) => next());
stub(auth, "checkSessionAge", (req, res, next) => next());
stub(auth, "requireAal2", (req, res, next) => next());
stub(auth, "loadProfile", (req, res, next) => {
  req.profile = { id: VIEWER_ID, profile_completed: true, role: "student" };
  return next();
});

const postModel = require("../models/postModel");
const thesisModel = require("../models/thesisModel");
const app = require("../app");

describe("feed faceted filters", () => {

  describe("GET /api/posts department and course filters", () => {
    it("rejects non-uuid department_id with 400", async () => {
      const res = await request(app)
        .get("/api/posts?department_id=not-a-uuid")
        .set("Authorization", "Bearer valid");
      assert.equal(res.status, 400);
      assert.match(res.body.error, /department_id/i);
    });

    it("rejects non-uuid course_id with 400", async () => {
      const res = await request(app)
        .get("/api/posts?course_id=not-a-uuid")
        .set("Authorization", "Bearer valid");
      assert.equal(res.status, 400);
      assert.match(res.body.error, /course_id/i);
    });

    it("passes valid department_id and course_id to postModel.visiblePostsFor", async () => {
      let capturedArgs = null;
      stub(postModel, "visiblePostsFor", async (args) => {
        capturedArgs = args;
        return { posts: [] };
      });

      const deptId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
      const courseId = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

      const res = await request(app)
        .get(`/api/posts?department_id=${deptId}&course_id=${courseId}&type=project`)
        .set("Authorization", "Bearer valid");

      assert.equal(res.status, 200);
      assert.ok(capturedArgs);
      assert.equal(capturedArgs.departmentId, deptId);
      assert.equal(capturedArgs.courseId, courseId);
      assert.equal(capturedArgs.type, "project");
    });
  });

  describe("GET /api/theses department filter", () => {
    it("rejects non-uuid department_id with 400", async () => {
      const res = await request(app)
        .get("/api/theses?department_id=bad-uuid")
        .set("Authorization", "Bearer valid");
      assert.equal(res.status, 400);
      assert.match(res.body.error, /department_id/i);
    });

    it("passes valid department_id to thesisModel.getAllTheses", async () => {
      let capturedArgs = null;
      stub(thesisModel, "getAllTheses", async (args) => {
        capturedArgs = args;
        return [];
      });

      const deptId = "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

      const res = await request(app)
        .get(`/api/theses?department_id=${deptId}`)
        .set("Authorization", "Bearer valid");

      assert.equal(res.status, 200);
      assert.ok(capturedArgs);
      assert.equal(capturedArgs.departmentId, deptId);
    });
  });
});
