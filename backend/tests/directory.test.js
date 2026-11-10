require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const auth = require("../middleware/auth");
const userModel = require("../models/userModel");
const messageModel = require("../models/messageModel");

const getDirectory = stub(userModel, "getDirectory", async () => []);
const getUserById = stub(userModel, "getUserById", async () => null);

// Mirror routes.test.js:63-70 — a bearer token is the only accepted credential.
stub(auth, "requireAuth", (req, res, next) => {
  if (!(req.headers.authorization || "").startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: "u1" };
  return next();
});
stub(auth, "loadProfile", (req, res, next) => {
  req.profile = { id: "u1", role: "student", department_id: "dept-a" };
  return next();
});
stub(auth, "requireActiveAccount", (req, res, next) => next());
// Stub new admin middleware (checkSessionAge, requireAal2) to pass through
stub(auth, "checkSessionAge", (req, res, next) => next());
stub(auth, "requireAal2", (req, res, next) => next());

// Also stub messageModel.resolveDecision to return predictable decisions
const resolveDecision = stub(messageModel, "resolveDecision", (opts) => {
  if (opts.is_blocked) return "blocked";
  if (opts.is_friend) return "direct";
  if (opts.recipient_policy === "everyone") return "direct";
  if (opts.recipient_policy === "department") {
    if (opts.sender_department_id && opts.recipient_department_id &&
        opts.sender_department_id === opts.recipient_department_id) {
      return "direct";
    }
    return "request";
  }
  if (opts.recipient_policy === "selected") {
    if (opts.sender_department_allowed) return "direct";
    return "request";
  }
  // nobody or unknown -> request
  return "request";
});

const app = require("../app");
const AUTH = { Authorization: "Bearer test" };

describe("GET /api/users/directory", () => {
  beforeEach(() => {
    getDirectory.setImpl(async () => []);
    getUserById.setImpl(async () => null);
    resolveDecision.setImpl((opts) => {
      if (opts.is_blocked) return "blocked";
      if (opts.is_friend) return "direct";
      if (opts.recipient_policy === "everyone") return "direct";
      if (opts.recipient_policy === "department") {
        if (opts.sender_department_id && opts.recipient_department_id &&
            opts.sender_department_id === opts.recipient_department_id) {
          return "direct";
        }
        return "request";
      }
      if (opts.recipient_policy === "selected") {
        if (opts.sender_department_allowed) return "direct";
        return "request";
      }
      return "request";
    });
  });

  it("401 without a token", async () => {
    const res = await request(app).get("/api/users/directory?limit=5");
    assert.equal(res.status, 401);
    assert.equal(res.body.error, "Authentication required");
  });

  it("mapping: accepted friend -> friendship: friend, message_decision: direct", async () => {
    getDirectory.setImpl(async () => [{
      id: "u2",
      username: "friend",
      full_name: "Friend User",
      avatar_url: null,
      year_level: "3rd Year",
      department_id: "dept-a",
      department_name: "College of Computer Studies",
      message_policy: "nobody",
      friendship_status: "accepted",
      friendship_outgoing: false,
      sender_department_id: "dept-a",
      sender_department_allowed: false,
    }]);

    const res = await request(app).get("/api/users/directory").set(AUTH);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    const peer = res.body[0];
    assert.equal(peer.id, "u2");
    assert.equal(peer.friendship, "friend");
    assert.equal(peer.message_decision, "direct");
  });

  it("mapping: pending outgoing with message_policy department different dept -> pending_out + request", async () => {
    getDirectory.setImpl(async () => [{
      id: "u3",
      username: "stranger",
      full_name: "Stranger User",
      avatar_url: null,
      year_level: "2nd Year",
      department_id: "dept-b",
      department_name: "College of Engineering",
      message_policy: "department",
      friendship_status: "pending",
      friendship_outgoing: true,
      sender_department_id: "dept-a",
      sender_department_allowed: false,
    }]);

    const res = await request(app).get("/api/users/directory").set(AUTH);
    assert.equal(res.status, 200);
    const peer = res.body[0];
    assert.equal(peer.friendship, "pending_out");
    assert.equal(peer.message_decision, "request");
  });

  it("mapping: no friendship row -> friendship: none, null friendship_outgoing doesn't throw", async () => {
    getDirectory.setImpl(async () => [{
      id: "u4",
      username: "nobody",
      full_name: "Nobody User",
      avatar_url: null,
      year_level: "1st Year",
      department_id: "dept-c",
      department_name: "College of Business",
      message_policy: "everyone",
      friendship_status: null,
      friendship_outgoing: null,
      sender_department_id: "dept-a",
      sender_department_allowed: false,
    }]);

    const res = await request(app).get("/api/users/directory").set(AUTH);
    assert.equal(res.status, 200);
    const peer = res.body[0];
    assert.equal(peer.friendship, "none");
    assert.equal(peer.message_decision, "direct"); // policy=everyone -> direct
  });

  it("wiring: getDirectory called with correct params for default scope", async () => {
    getDirectory.setImpl(async (userId, opts) => {
      assert.equal(userId, "u1");
      assert.deepEqual(opts, { limit: 50, q: null, scope: "network" });
      return [];
    });

    await request(app).get("/api/users/directory").set(AUTH);
    assert.ok(getDirectory.calls.length > 0);
  });

  it("wiring: getDirectory called with correct params for ?q=mark&scope=all&limit=500", async () => {
    getDirectory.setImpl(async (userId, opts) => {
      assert.equal(userId, "u1");
      assert.deepEqual(opts, { limit: 50, q: "mark", scope: "all" }); // limit capped at MAX_DIRECTORY=50
      return [];
    });

    await request(app).get("/api/users/directory?q=mark&scope=all&limit=500").set(AUTH);
    assert.ok(getDirectory.calls.length > 0);
  });

  it("identity_complete: stub getUserById returning all four fields -> true", async () => {
    getUserById.setImpl(async () => ({
      id: "u1",
      full_name: "Mark Rivera",
      student_id: "2023-12345",
      department_id: "dept-a",
      course_id: "course-bscs",
    }));

    const res = await request(app).get("/api/users/u1").set(AUTH);
    assert.equal(res.status, 200);
    assert.equal(res.body.identity_complete, true);
  });

  it("identity_complete: department_id null -> false", async () => {
    getUserById.setImpl(async () => ({
      id: "u1",
      full_name: "Mark Rivera",
      student_id: "2023-12345",
      department_id: null,
      course_id: "course-bscs",
    }));

    const res = await request(app).get("/api/users/u1").set(AUTH);
    assert.equal(res.status, 200);
    assert.equal(res.body.identity_complete, false);
  });
});