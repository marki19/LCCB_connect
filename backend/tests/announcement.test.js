// Announcement HTTP contract (041_announcement_posts.sql).
//
// Auth, the model, the audit log and db.query are stubbed, so the routes are
// exercised without a database: the role gate, the per-audience scope rules, and
// the edit/delete authorization.
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const db = require("../db");
const { stub } = require("./stub.helper");
const auth = require("../middleware/auth");
const announcementModel = require("../models/announcementModel");
const auditService = require("../services/auditService");

const ADMIN = "11111111-1111-4111-8111-111111111111";
const DEPT = "22222222-2222-4222-8222-222222222222";
const OTHER_DEPT = "33333333-3333-4333-8333-333333333333";
const COURSE = "44444444-4444-4444-8444-444444444444";
const ANNOUNCEMENT = "55555555-5555-4555-8555-555555555555";

let session = { id: ADMIN, role: "admin", department_id: null };

stub(auth, "requireAuth", (req, res, next) => {
  if (!(req.headers.authorization || "").startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: session.id };
  return next();
});
stub(auth, "loadProfile", (req, res, next) => {
  req.profile = {
    id: session.id,
    role: session.role,
    department_id: session.department_id,
  };
  return next();
});
stub(auth, "requireActiveAccount", (req, res, next) => next());

const model = {
  create: stub(announcementModel, "create"),
  update: stub(announcementModel, "update"),
  softDelete: stub(announcementModel, "softDelete"),
  getById: stub(announcementModel, "getById"),
  list: stub(announcementModel, "list"),
  resolveRecipients: stub(announcementModel, "resolveRecipients"),
};
const audit = stub(auditService, "recordRequest", async () => {});
const query = stub(db, "query", async () => ({ rows: [] }));

const app = require("../app");
const AUTH = { Authorization: "Bearer test-token" };

const announcementRow = (over = {}) => ({
  id: ANNOUNCEMENT,
  author_id: ADMIN,
  title: "Enrollment",
  content: "Opens Monday",
  visibility: "announcement",
  audience_role: null,
  audience_department_id: null,
  audience_course_id: null,
  audience_year_level: null,
  pinned: false,
  expires_at: null,
  allow_reposts: true,
  repost_count: 0,
  created_at: "2026-11-12T00:00:00.000Z",
  edited_at: null,
  deleted_at: null,
  ...over,
});

beforeEach(() => {
  session = { id: ADMIN, role: "admin", department_id: null };
  for (const fn of Object.values(model)) {
    fn.calls.length = 0;
    fn.setImpl(() => undefined);
  }
  audit.calls.length = 0;
  query.calls.length = 0;
  query.setImpl(async () => ({ rows: [] }));
});

describe("announcement role gate", () => {
  it("401 without a token", async () => {
    const res = await request(app).get("/api/announcements");
    assert.equal(res.status, 401);
  });

  it("403 for a student", async () => {
    session.role = "student";
    const res = await request(app).get("/api/announcements").set(AUTH);
    assert.equal(res.status, 403);
  });

  it("200 for a department admin", async () => {
    session.role = "departmentAdmin";
    session.department_id = DEPT;
    model.list.setImpl(async () => ({ items: [], next_cursor: null }));

    const res = await request(app).get("/api/announcements").set(AUTH);
    assert.equal(res.status, 200);
    assert.equal(model.list.calls[0][0].isCampusAdmin, false);
    assert.equal(model.list.calls[0][0].departmentId, DEPT);
  });
});

describe("POST /api/announcements", () => {
  it("creates a post and audits as a campus admin", async () => {
    model.create.setImpl(async () => ({ post: announcementRow(), recipients: 4 }));

    const res = await request(app)
      .post("/api/announcements")
      .set(AUTH)
      .send({ title: "Enrollment", body: "Opens Monday", audience: { type: "all" } });

    assert.equal(res.status, 201);
    assert.equal(res.body.recipients, 4);
    assert.deepEqual(res.body.audience, { type: "all" });
    assert.deepEqual(model.create.calls[0][0].audience, {});
    assert.equal(audit.calls.at(-1)[1].action, "announcement.send");
  });

  it("refuses a department admin targeting everyone", async () => {
    session.role = "departmentAdmin";
    session.department_id = DEPT;

    const res = await request(app)
      .post("/api/announcements")
      .set(AUTH)
      .send({ title: "Enrollment", body: "Opens Monday", audience: { type: "all" } });

    assert.equal(res.status, 403);
    assert.equal(model.create.calls.length, 0);
  });

  it("refuses a department admin targeting another department", async () => {
    session.role = "departmentAdmin";
    session.department_id = DEPT;

    const res = await request(app)
      .post("/api/announcements")
      .set(AUTH)
      .send({
        title: "Enrollment",
        body: "Opens Monday",
        audience: { type: "department", department_id: OTHER_DEPT },
      });

    assert.equal(res.status, 403);
    assert.equal(model.create.calls.length, 0);
  });

  it("pins a department admin's year-level audience to their own department", async () => {
    session.role = "departmentAdmin";
    session.department_id = DEPT;
    model.create.setImpl(async () => ({ post: announcementRow(), recipients: 2 }));

    const res = await request(app)
      .post("/api/announcements")
      .set(AUTH)
      .send({
        title: "Enrollment",
        body: "Opens Monday",
        audience: { type: "year_level", year_level: "3rd Year" },
      });

    assert.equal(res.status, 201);
    assert.deepEqual(model.create.calls[0][0].audience, {
      audience_year_level: "3rd Year",
      audience_department_id: DEPT,
    });
  });

  it("refuses a department admin targeting another department's course", async () => {
    session.role = "departmentAdmin";
    session.department_id = DEPT;
    query.setImpl(async () => ({ rows: [{ department_id: OTHER_DEPT }] }));

    const res = await request(app)
      .post("/api/announcements")
      .set(AUTH)
      .send({
        title: "Enrollment",
        body: "Opens Monday",
        audience: { type: "course", course_id: COURSE },
      });

    assert.equal(res.status, 403);
    assert.equal(model.create.calls.length, 0);
  });

  it("rejects an unknown course", async () => {
    query.setImpl(async () => ({ rows: [] }));

    const res = await request(app)
      .post("/api/announcements")
      .set(AUTH)
      .send({
        title: "Enrollment",
        body: "Opens Monday",
        audience: { type: "course", course_id: COURSE },
      });

    assert.equal(res.status, 400);
  });
});

describe("PATCH /api/announcements/:id", () => {
  it("403 when a department admin edits someone else's announcement", async () => {
    session.role = "departmentAdmin";
    session.department_id = DEPT;
    model.getById.setImpl(async () => announcementRow({ author_id: "someone-else" }));

    const res = await request(app)
      .patch(`/api/announcements/${ANNOUNCEMENT}`)
      .set(AUTH)
      .send({ title: "Updated" });

    assert.equal(res.status, 403);
    assert.equal(model.update.calls.length, 0);
  });

  it("lets the author edit and passes expiry through", async () => {
    model.getById.setImpl(async () => announcementRow());
    model.update.setImpl(async () =>
      announcementRow({ title: "Updated", expires_at: "2026-12-01T00:00:00.000Z" })
    );

    const res = await request(app)
      .patch(`/api/announcements/${ANNOUNCEMENT}`)
      .set(AUTH)
      .send({ title: "Updated", expires_at: "2026-12-01T00:00:00.000Z" });

    assert.equal(res.status, 200);
    assert.equal(model.update.calls[0][0].expiresAt, "2026-12-01T00:00:00.000Z");
    assert.equal(audit.calls.at(-1)[1].action, "announcement.update");
  });

  it("404 for a missing announcement", async () => {
    model.getById.setImpl(async () => undefined);

    const res = await request(app)
      .patch(`/api/announcements/${ANNOUNCEMENT}`)
      .set(AUTH)
      .send({ title: "Updated" });

    assert.equal(res.status, 404);
  });
});

describe("DELETE /api/announcements/:id", () => {
  it("soft-deletes and audits", async () => {
    model.getById.setImpl(async () => announcementRow());
    model.softDelete.setImpl(async () => ({ id: ANNOUNCEMENT }));

    const res = await request(app)
      .delete(`/api/announcements/${ANNOUNCEMENT}`)
      .set(AUTH);

    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, true);
    assert.equal(audit.calls.at(-1)[1].action, "announcement.delete");
  });

  it("404 when already deleted", async () => {
    model.getById.setImpl(async () =>
      announcementRow({ deleted_at: "2026-11-12T00:00:00.000Z" })
    );

    const res = await request(app)
      .delete(`/api/announcements/${ANNOUNCEMENT}`)
      .set(AUTH);

    assert.equal(res.status, 404);
  });
});

describe("GET /api/announcements/audience-count", () => {
  it("counts the resolved audience", async () => {
    model.resolveRecipients.setImpl(async () => [{ id: "u2" }, { id: "u3" }]);

    const res = await request(app)
      .get(`/api/announcements/audience-count?type=department&department_id=${DEPT}`)
      .set(AUTH);

    assert.equal(res.status, 200);
    assert.equal(res.body.count, 2);
  });

  it("rejects an audience without its required field", async () => {
    const res = await request(app)
      .get("/api/announcements/audience-count?type=department")
      .set(AUTH);

    assert.equal(res.status, 400);
  });
});
