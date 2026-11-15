require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const db = require("../db");
const { stub } = require("./stub.helper");
const auth = require("../middleware/auth");

const query = stub(db, "query", async () => ({ rows: [] }));
const userModel = require("../models/userModel");

const VIEWER_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ID = "22222222-2222-4222-8222-222222222222";
const AUTH = { Authorization: "Bearer test-token" };

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

const app = require("../app");

beforeEach(() => {
  query.calls.length = 0;
  query.setImpl(async () => ({ rows: [] }));
});

describe("userModel.getPublicProfile", () => {
  it("returns public profile with stats and friendship", async () => {
    query.setImpl(async (sql, params) => {
      // 1. Block check
      if (sql.includes("public.blocks")) {
        return { rows: [{ is_blocked: false }] };
      }
      // 2. Profile fetch
      return {
        rows: [
          {
            id: TARGET_ID,
            username: "johndoe",
            full_name: "John Doe",
            avatar_url: "avatars/john.jpg",
            bio: "CS Major & Developer",
            year_level: "3",
            role: "student",
            skills: ["JavaScript", "PostgreSQL"],
            department_id: "dept-cs",
            course_id: "course-bscs",
            department_name: "Computer Studies",
            course_name: "BS Computer Science",
            created_at: "2026-01-01T00:00:00.000Z",
            verified_status: "verified",
            friendship_status: "accepted",
            friendship_outgoing: true,
            posts_count: 5,
            theses_count: 1,
            friends_count: 12,
          },
        ],
      };
    });

    const profile = await userModel.getPublicProfile(TARGET_ID, VIEWER_ID);
    assert.ok(profile);
    assert.equal(profile.id, TARGET_ID);
    assert.equal(profile.username, "johndoe");
    assert.equal(profile.department_name, "Computer Studies");
    assert.equal(profile.friendship, "friend");
    assert.equal(profile.is_self, false);
    assert.equal(profile.stats.posts_count, 5);
    assert.equal(profile.stats.friends_count, 12);
  });

  it("returns null when users have a mutual block", async () => {
    query.setImpl(async (sql) => {
      if (sql.includes("public.blocks")) {
        return { rows: [{ is_blocked: true }] };
      }
      return { rows: [] };
    });

    const profile = await userModel.getPublicProfile(TARGET_ID, VIEWER_ID);
    assert.equal(profile, null);
  });
});

describe("GET /api/users/:id/profile", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get(`/api/users/${TARGET_ID}/profile`);
    assert.equal(res.status, 401);
  });

  it("returns 404 when profile does not exist or blocked", async () => {
    query.setImpl(async () => ({ rows: [] }));

    const res = await request(app)
      .get(`/api/users/${TARGET_ID}/profile`)
      .set(AUTH);
    assert.equal(res.status, 404);
  });

  it("returns 200 with sanitized public profile", async () => {
    query.setImpl(async (sql) => {
      if (sql.includes("public.blocks")) {
        return { rows: [{ is_blocked: false }] };
      }
      return {
        rows: [
          {
            id: TARGET_ID,
            username: "johndoe",
            full_name: "John Doe",
            department_name: "Engineering",
            friendship_status: null,
            posts_count: 2,
            theses_count: 0,
            friends_count: 3,
          },
        ],
      };
    });

    const res = await request(app)
      .get(`/api/users/${TARGET_ID}/profile`)
      .set(AUTH);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, TARGET_ID);
    assert.equal(res.body.friendship, "none");
    assert.equal(res.body.department_name, "Engineering");
    // Ensure sensitive student_id or email is NOT present
    assert.equal(res.body.student_id, undefined);
    assert.equal(res.body.email, undefined);
  });
});
