// Moderation queue visibility of user-submitted content reports (`reports`).
// The auth middleware and the models are stubbed so the route contract is
// exercised without a database; the final describe block runs the queue SQL
// against the real schema (see snapExpiry.test.js for the pattern).
require("./env.helper");

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const db = require("../db");
const auth = require("../middleware/auth");
const postModel = require("../models/postModel");
const messageModel = require("../models/messageModel");
const reportModel = require("../models/reportModel");
const auditService = require("../services/auditService");

const REPORT = "77777777-7777-4777-8777-777777777777";
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
const messages = {
  listOpenMessageReports: stub(messageModel, "listOpenMessageReports"),
};
const reports = {
  listOpenReports: stub(reportModel, "listOpenReports"),
  getReportForModeration: stub(reportModel, "getReportForModeration"),
  updateReportStatus: stub(reportModel, "updateReportStatus"),
};
stub(auditService, "recordRequest", async () => undefined);

const app = require("../app");
const AUTH = { Authorization: "Bearer test-token" };

beforeEach(() => {
  profile = { id: "u1", role: "admin", department_id: null };
  for (const fn of [...Object.values(posts), ...Object.values(messages), ...Object.values(reports)]) {
    fn.calls.length = 0;
    fn.setImpl(async () => []);
  }
});

describe("moderation queue includes content reports", () => {
  it("returns contentReports and counts them in totalFlagged", async () => {
    reports.listOpenReports.setImpl(async () => [
      { id: REPORT, target_type: "post", excerpt: "bad post" },
    ]);

    const res = await request(app).get("/api/moderation/queue").set(AUTH);

    assert.equal(res.status, 200);
    assert.equal(res.body.contentReports.length, 1);
    assert.equal(res.body.totalFlagged, 1);
  });

  it("passes a campus admin's department filter through", async () => {
    await request(app)
      .get(`/api/moderation/queue?department_id=${DEPT_A}`)
      .set(AUTH);

    assert.deepEqual(reports.listOpenReports.calls[0], [{ departmentId: DEPT_A }]);
  });

  it("scopes a department admin to their own department", async () => {
    profile = { id: "u1", role: "departmentAdmin", department_id: DEPT_A };

    await request(app).get("/api/moderation/queue").set(AUTH);

    assert.deepEqual(reports.listOpenReports.calls[0], [{ departmentId: DEPT_A }]);
  });
});

describe("resolve a content report", () => {
  it("400 on an invalid action", async () => {
    const res = await request(app)
      .post(`/api/moderation/reports/${REPORT}`)
      .set(AUTH)
      .send({ action: "nuke", reason: "legit reason" });

    assert.equal(res.status, 400);
    assert.equal(reports.updateReportStatus.calls.length, 0);
  });

  it("404 for an unknown report", async () => {
    reports.getReportForModeration.setImpl(async () => null);

    const res = await request(app)
      .post(`/api/moderation/reports/${REPORT}`)
      .set(AUTH)
      .send({ action: "reviewed", reason: "legit reason" });

    assert.equal(res.status, 404);
    assert.equal(reports.updateReportStatus.calls.length, 0);
  });

  it("403 for a department admin outside the target author's department", async () => {
    profile = { id: "u1", role: "departmentAdmin", department_id: DEPT_A };
    reports.getReportForModeration.setImpl(async () => ({
      id: REPORT,
      author_department_id: DEPT_B,
    }));

    const res = await request(app)
      .post(`/api/moderation/reports/${REPORT}`)
      .set(AUTH)
      .send({ action: "reviewed", reason: "legit reason" });

    assert.equal(res.status, 403);
    assert.equal(reports.updateReportStatus.calls.length, 0);
  });

  it("403 for a department admin when the target author has no department", async () => {
    profile = { id: "u1", role: "departmentAdmin", department_id: DEPT_A };
    reports.getReportForModeration.setImpl(async () => ({
      id: REPORT,
      author_department_id: null,
    }));

    const res = await request(app)
      .post(`/api/moderation/reports/${REPORT}`)
      .set(AUTH)
      .send({ action: "reviewed", reason: "legit reason" });

    assert.equal(res.status, 403);
    assert.equal(reports.updateReportStatus.calls.length, 0);
  });

  it("resolves as reviewed and records the reviewer", async () => {
    reports.getReportForModeration.setImpl(async () => ({
      id: REPORT,
      target_type: "post",
      author_department_id: DEPT_A,
    }));
    reports.updateReportStatus.setImpl(async () => ({ id: REPORT, status: "reviewed" }));

    const res = await request(app)
      .post(`/api/moderation/reports/${REPORT}`)
      .set(AUTH)
      .send({ action: "reviewed", reason: "legit reason" });

    assert.equal(res.status, 200);
    assert.deepEqual(reports.updateReportStatus.calls[0], [REPORT, "reviewed", "u1"]);
  });

  it("resolves as dismissed", async () => {
    reports.getReportForModeration.setImpl(async () => ({
      id: REPORT,
      target_type: "comment",
      author_department_id: DEPT_A,
    }));
    reports.updateReportStatus.setImpl(async () => ({ id: REPORT, status: "dismissed" }));

    const res = await request(app)
      .post(`/api/moderation/reports/${REPORT}`)
      .set(AUTH)
      .send({ action: "dismissed", reason: "legit reason" });

    assert.equal(res.status, 200);
    assert.deepEqual(reports.updateReportStatus.calls[0], [REPORT, "dismissed", "u1"]);
  });
});

/**
 * The queue SQL, exercised against the real schema. The stubs above prove the
 * route wiring; these prove the joins, the department scoping, and the
 * fail-closed behaviour for unresolvable targets.
 */
describe("content report queue queries", () => {
  const suffix = Math.floor(100000 + Math.random() * 899999);
  const authorId = `report_q_${suffix}`;
  let deptId;
  let postId;
  let postReportId;
  let orphanReportId;

  before(async () => {
    // The stubs above stand in for the model on the routes; the queries here
    // need the real implementations back.
    for (const fn of Object.values(reports)) fn.restore();

    // Reuse an existing department for the author so the department filter
    // has something to match against.
    const deptRes = await db.query("SELECT id FROM public.departments LIMIT 1");
    deptId = deptRes.rows[0]?.id || null;

    await db.query(
      `INSERT INTO public.profiles (id, username, full_name, department_id, role, course, student_id)
       VALUES ($1, $2, 'Report Queue Author', $3, 'student', 'BSCS', 'ID_' || $1)`,
      [authorId, `${authorId}_u`, deptId]
    );

    const postRes = await db.query(
      `INSERT INTO public.posts (author_id, content, visibility, kind)
       VALUES ($1, 'Report queue test post', 'public', 'discussion')
       RETURNING id`,
      [authorId]
    );
    postId = postRes.rows[0].id;

    const postReport = await db.query(
      `INSERT INTO public.reports (reporter_id, target_type, target_id, reason)
       VALUES ($1, 'post', $2, 'spam')
       RETURNING id`,
      [authorId, postId]
    );
    postReportId = postReport.rows[0].id;

    // No FK on target_id: a deleted target leaves the row standalone.
    const orphanReport = await db.query(
      `INSERT INTO public.reports (reporter_id, target_type, target_id, reason)
       VALUES ($1, 'post', $2, 'spam')
       RETURNING id`,
      [authorId, "88888888-8888-4888-8888-888888888888"]
    );
    orphanReportId = orphanReport.rows[0].id;
  });

  after(async () => {
    await db.query(`DELETE FROM public.reports WHERE id IN ($1, $2)`, [
      postReportId,
      orphanReportId,
    ]);
    await db.query(`DELETE FROM public.posts WHERE id = $1`, [postId]);
    await db.query(`DELETE FROM public.profiles WHERE id = $1`, [authorId]);
  });

  it("lists pending reports with the target author and excerpt resolved", async () => {
    const rows = await reportModel.listOpenReports({ departmentId: null });
    const byId = new Map(rows.map((row) => [row.id, row]));

    const postReport = byId.get(postReportId);
    assert.ok(postReport, "post report is listed");
    assert.equal(postReport.author.id, authorId);
    assert.equal(postReport.excerpt, "Report queue test post");
    assert.equal(postReport.post_id, postId);
    assert.equal(postReport.status, "pending");

    const orphan = byId.get(orphanReportId);
    assert.ok(orphan, "orphan report is listed for a campus admin");
    assert.equal(orphan.author.id, null);
    assert.equal(orphan.excerpt, null);
  });

  it("excludes resolved reports", async () => {
    await reportModel.updateReportStatus(postReportId, "reviewed", authorId);

    const rows = await reportModel.listOpenReports({ departmentId: null });
    const ids = rows.map((row) => row.id);

    assert.ok(!ids.includes(postReportId), "reviewed report is not listed");
    assert.ok(ids.includes(orphanReportId), "pending orphan is still listed");

    await reportModel.updateReportStatus(postReportId, "pending", null);
  });

  it("fails closed: unresolvable targets never match a department filter", async () => {
    if (!deptId) return; // no department in the schema to scope on

    const scoped = await reportModel.listOpenReports({ departmentId: deptId });
    const ids = scoped.map((row) => row.id);

    assert.ok(ids.includes(postReportId), "author's department sees their reported post");
    assert.ok(!ids.includes(orphanReportId), "orphan target is invisible to the department scope");
  });

  it("resolves the target author's department for the scope check", async () => {
    const report = await reportModel.getReportForModeration(postReportId);

    assert.equal(report.id, postReportId);
    assert.equal(report.target_type, "post");
    assert.equal(
      report.author_department_id,
      deptId,
      "post author's department is resolved"
    );

    const orphan = await reportModel.getReportForModeration(orphanReportId);
    assert.equal(orphan.author_department_id, null);
  });
});
