require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const db = require("../db");
const { stub } = require("./stub.helper");
const auth = require("../middleware/auth");

const query = stub(db, "query", async () => ({ rows: [] }));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const AUTH = { Authorization: "Bearer test-token" };

stub(auth, "requireAuth", (req, res, next) => {
  if (!(req.headers.authorization || "").startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: USER_ID };
  return next();
});
stub(auth, "requireActiveAccount", (req, res, next) => next());
stub(auth, "loadProfile", (req, res, next) => next());

const app = require("../app");

beforeEach(() => {
  query.calls.length = 0;
  query.setImpl(async () => ({ rows: [] }));
});

describe("GET /api/notifications", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/notifications");
    assert.equal(res.status, 401);
  });

  it("returns notifications and unread count", async () => {
    query.setImpl(async (sql) => {
      if (sql.includes("COUNT(*)")) {
        return { rows: [{ unread: 2 }] };
      }
      return {
        rows: [
          {
            id: "notif-1",
            user_id: USER_ID,
            type: "like",
            message: "John liked your post",
            is_read: false,
            created_at: new Date().toISOString(),
            actor: { id: "u2", full_name: "John Doe" },
          },
        ],
      };
    });

    const res = await request(app).get("/api/notifications").set(AUTH);
    assert.equal(res.status, 200);
    assert.equal(res.body.unread, 2);
    assert.equal(res.body.notifications.length, 1);
    assert.equal(res.body.notifications[0].message, "John liked your post");
  });
});

describe("GET /api/notifications/unread-count", () => {
  it("returns count of unread notifications", async () => {
    query.setImpl(async (sql) => {
      if (sql.includes("COUNT(*)")) {
        return { rows: [{ unread: 5 }] };
      }
      return { rows: [] };
    });

    const res = await request(app).get("/api/notifications/unread-count").set(AUTH);
    assert.equal(res.status, 200);
    assert.equal(res.body.unread, 5);
  });
});

describe("PUT /api/notifications/:id/read", () => {
  it("marks a notification as read", async () => {
    query.setImpl(async () => ({
      rows: [{ id: "notif-1", user_id: USER_ID, is_read: true }],
    }));

    const res = await request(app)
      .put("/api/notifications/notif-1/read")
      .set(AUTH);
    assert.equal(res.status, 200);
    assert.equal(res.body.is_read, true);
  });
});

describe("POST /api/notifications/read-all", () => {
  it("marks all notifications as read", async () => {
    query.setImpl(async () => ({ rowCount: 3, rows: [] }));

    const res = await request(app)
      .post("/api/notifications/read-all")
      .set(AUTH);
    assert.equal(res.status, 200);
    assert.equal(res.body.message, "All notifications marked as read");
  });
});

describe("messages never appear in the bell", () => {
  it("excludes message types from the list and the unread count", async () => {
    query.setImpl(async () => ({ rows: [] }));

    await request(app).get("/api/notifications").set(AUTH);
    const listSql = query.calls.map((c) => c[0]).join("\n");
    assert.match(listSql, /NOT IN \('new_message', 'message_request'\)/);

    query.calls.length = 0;
    await request(app).get("/api/notifications/unread-count").set(AUTH);
    const countSql = query.calls.map((c) => c[0]).join("\n");
    assert.match(countSql, /NOT IN \('new_message', 'message_request'\)/);
  });
});


