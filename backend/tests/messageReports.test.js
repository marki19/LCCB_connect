// Moderator visibility of reported messages (Messaging_plan.md §7, Phase 6).
// The auth middleware, the post model, and the message model are stubbed so the
// route contract is exercised without a database: role gate, department scope,
// queue composition, and the reviewed/dismissed action.
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const auth = require("../middleware/auth");
const postModel = require("../models/postModel");
const messageModel = require("../models/messageModel");

const REPORT = "66666666-6666-4666-8666-666666666666";
const DEPT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEPT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// `loadProfile` sets this; the role predicates read it back. The router
// destructures `loadProfile` at require time, so the stub must be installed
// before `../app` is required below.
let profile = { id: "u1", role: "admin", department_id: null };

stub(auth, "requireAuth", (req, res, next) => {
  if (!(req.headers.authorization || "").startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: "u1" };
  return next();
});
stub(auth, "loadProfile", (req, res, next) => {
  req.profile = profile;
  return next();
});

const posts = {
  getFlaggedPosts: stub(postModel, "getFlaggedPosts"),
  getFlaggedComments: stub(postModel, "getFlaggedComments"),
};
const reports = {
  listOpenMessageReports: stub(messageModel, "listOpenMessageReports"),
  getMessageReportById: stub(messageModel, "getMessageReportById"),
  resolveMessageReport: stub(messageModel, "resolveMessageReport"),
};

const app = require("../app");
const AUTH = { Authorization: "Bearer test-token" };

beforeEach(() => {
  profile = { id: "u1", role: "admin", department_id: null };
  for (const fn of Object.values(posts)) {
    fn.calls.length = 0;
    fn.setImpl(async () => []);
  }
  for (const fn of Object.values(reports)) {
    fn.calls.length = 0;
    fn.setImpl(async () => []);
  }
});

describe("moderation queue includes reported messages (§7)", () => {
  it("401 without a token", async () => {
    const res = await request(app).get("/api/moderation/queue");
    assert.equal(res.status, 401);
  });

  it("403 for a student", async () => {
    profile = { id: "u1", role: "student", department_id: null };
    const res = await request(app).get("/api/moderation/queue").set(AUTH);
    assert.equal(res.status, 403);
  });

  it("returns messageReports and counts them in totalFlagged", async () => {
    reports.listOpenMessageReports.setImpl(async () => [{ id: REPORT, message_body: "hi" }]);

    const res = await request(app).get("/api/moderation/queue").set(AUTH);

    assert.equal(res.status, 200);
    assert.equal(res.body.messageReports.length, 1);
    assert.equal(res.body.totalFlagged, 1);
  });

  it("passes a campus admin's department filter through", async () => {
    const res = await request(app)
      .get(`/api/moderation/queue?department_id=${DEPT_A}`)
      .set(AUTH);

    assert.equal(res.status, 200);
    assert.deepEqual(reports.listOpenMessageReports.calls[0], [{ departmentId: DEPT_A }]);
  });

  it("scopes a department admin to their own department", async () => {
    profile = { id: "u1", role: "departmentAdmin", department_id: DEPT_A };

    await request(app).get("/api/moderation/queue").set(AUTH);

    assert.deepEqual(reports.listOpenMessageReports.calls[0], [{ departmentId: DEPT_A }]);
  });
});

describe("resolve a reported message (§7)", () => {
  it("400 on an invalid action", async () => {
    const res = await request(app)
      .post(`/api/moderation/message-reports/${REPORT}`)
      .set(AUTH)
      .send({ action: "nuke" });

    assert.equal(res.status, 400);
    assert.equal(reports.resolveMessageReport.calls.length, 0);
  });

  it("404 when the report does not exist", async () => {
    reports.getMessageReportById.setImpl(async () => undefined);

    const res = await request(app)
      .post(`/api/moderation/message-reports/${REPORT}`)
      .set(AUTH)
      .send({ action: "reviewed" });

    assert.equal(res.status, 404);
  });

  it("marks a report reviewed", async () => {
    reports.getMessageReportById.setImpl(async () => ({ id: REPORT, sender_department_id: DEPT_A }));
    reports.resolveMessageReport.setImpl(async () => ({ id: REPORT, status: "reviewed" }));

    const res = await request(app)
      .post(`/api/moderation/message-reports/${REPORT}`)
      .set(AUTH)
      .send({ action: "reviewed" });

    assert.equal(res.status, 200);
    assert.equal(res.body.report.status, "reviewed");
    assert.deepEqual(reports.resolveMessageReport.calls[0], [REPORT, "reviewed"]);
  });

  it("403 when a department admin resolves a report outside their department", async () => {
    profile = { id: "u1", role: "departmentAdmin", department_id: DEPT_A };
    reports.getMessageReportById.setImpl(async () => ({ id: REPORT, sender_department_id: DEPT_B }));

    const res = await request(app)
      .post(`/api/moderation/message-reports/${REPORT}`)
      .set(AUTH)
      .send({ action: "dismissed" });

    assert.equal(res.status, 403);
    assert.equal(reports.resolveMessageReport.calls.length, 0);
  });

  it("allows a department admin to resolve a report inside their department", async () => {
    profile = { id: "u1", role: "departmentAdmin", department_id: DEPT_A };
    reports.getMessageReportById.setImpl(async () => ({ id: REPORT, sender_department_id: DEPT_A }));
    reports.resolveMessageReport.setImpl(async () => ({ id: REPORT, status: "dismissed" }));

    const res = await request(app)
      .post(`/api/moderation/message-reports/${REPORT}`)
      .set(AUTH)
      .send({ action: "dismissed" });

    assert.equal(res.status, 200);
    assert.deepEqual(reports.resolveMessageReport.calls[0], [REPORT, "dismissed"]);
  });
});
