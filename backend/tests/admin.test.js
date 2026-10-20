// Superadmin console API contract (SPEC-superadmin-console.md §9-11).
// Auth, the admin model, the account service, and audit writes are stubbed, so
// the HTTP contract, rank matrix, and validation are asserted without a DB.
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const auth = require("../middleware/auth");
const adminModel = require("../models/adminModel");
const userModel = require("../models/userModel");
const accountService = require("../services/accountService");
const auditService = require("../services/auditService");

const TARGET = "99999999-9999-4999-8999-999999999999";
const SUPER = "11111111-1111-4111-8111-111111111111";
const DEPT = "22222222-2222-4222-8222-222222222222";

let session = { id: SUPER, role: "superadmin", department_id: null };
let currentProfile = {
  id: SUPER,
  role: "superadmin",
  department_id: null,
};

stub(auth, "requireAuth", (req, res, next) => {
  if (!(req.headers.authorization || "").startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: session.id };
  return next();
});
stub(auth, "loadProfile", (req, res, next) => {
  req.profile = {
    ...currentProfile,
    id: session.id,
    role: session.role,
    department_id: session.department_id,
  };
  return next();
});

const model = {
  getOverview: stub(adminModel, "getOverview"),
  listUsers: stub(adminModel, "listUsers"),
  getUserById: stub(adminModel, "getUserById"),
  getUserDossier: stub(adminModel, "getUserDossier"),
  setUserSuspension: stub(adminModel, "setUserSuspension"),
  clearUserSuspension: stub(adminModel, "clearUserSuspension"),
  listContent: stub(adminModel, "listContent"),
  listAudit: stub(adminModel, "listAudit"),
  getAnnouncementRecipients: stub(adminModel, "getAnnouncementRecipients"),
  createAnnouncementNotifications: stub(adminModel, "createAnnouncementNotifications"),
  getDepartmentName: stub(adminModel, "getDepartmentName"),
  listAnnouncementHistory: stub(adminModel, "listAnnouncementHistory"),
  getUserByIdText: stub(userModel, "getUserById"),
  updateUser: stub(userModel, "updateUser"),
  deleteUser: stub(userModel, "deleteUser"),
};

const accounts = {
  banUser: stub(accountService, "banUser", async () => undefined),
  unbanUser: stub(accountService, "unbanUser", async () => undefined),
  revokeSessions: stub(accountService, "revokeSessions", async () => ({
    sessions: 2,
    refresh_tokens: 3,
  })),
  deleteAuthUser: stub(accountService, "deleteAuthUser", async () => true),
  getAuthUser: stub(accountService, "getAuthUser", async () => null),
};

const audit = stub(auditService, "recordRequest", async () => ({ id: "audit-1" }));

const app = require("../app");
const AUTH = { Authorization: "Bearer test-token" };

const targetUser = (role = "student") => ({
  id: TARGET,
  username: "student_test",
  full_name: "Student Test",
  role,
  department_id: null,
  suspended_at: null,
  suspended_until: null,
  suspension_reason: null,
});

beforeEach(() => {
  session = { id: SUPER, role: "superadmin", department_id: null };
  currentProfile = {
    id: session.id,
    role: session.role,
    department_id: session.department_id,
  };
  audit.calls.length = 0;
  for (const fn of Object.values(model)) {
    fn.calls.length = 0;
    fn.setImpl(() => undefined);
  }
  for (const fn of Object.values(accounts)) {
    fn.calls.length = 0;
  }
  accounts.banUser.setImpl(async () => undefined);
  accounts.unbanUser.setImpl(async () => undefined);
  accounts.revokeSessions.setImpl(async () => ({ sessions: 2, refresh_tokens: 3 }));
  accounts.deleteAuthUser.setImpl(async () => true);
  accounts.getAuthUser.setImpl(async () => null);
  model.listAudit.setImpl(async () => ({ items: [], total: 0, next_cursor: null }));
});

describe("admin console gate", () => {
  it("401 without a token", async () => {
    const res = await request(app).get("/api/admin/overview");
    assert.equal(res.status, 401);
  });

  it("403 for a student", async () => {
    session.role = "student";
    const res = await request(app).get("/api/admin/overview").set(AUTH);
    assert.equal(res.status, 403);
  });

  it("403 for a suspended account", async () => {
    session.role = "superadmin";
    currentProfile = {
      id: session.id,
      role: session.role,
      suspended_at: new Date().toISOString(),
      suspended_until: null,
    };

    const res = await request(app).get("/api/admin/overview").set(AUTH);
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "account_suspended");
  });

  it("still lets a suspended account read its own profile, but not the directory", async () => {
    currentProfile = {
      id: SUPER,
      role: "student",
      suspended_at: new Date().toISOString(),
      suspended_until: null,
      suspension_reason: "test",
    };
    model.getUserByIdText.setImpl(async () => ({
      ...currentProfile,
      id: SUPER,
      username: "student_test",
    }));

    const self = await request(app).get(`/api/users/${SUPER}`).set(AUTH);
    assert.equal(self.status, 200);
    assert.equal(self.body.suspension_reason, "test");

    const directory = await request(app).get("/api/users").set(AUTH);
    assert.equal(directory.status, 403);
    assert.equal(directory.body.code, "account_suspended");
  });
});

describe("overview", () => {
  it("returns recent actions to superadmin only", async () => {
    model.getOverview.setImpl(async () => ({
      users: { total: 5 },
      content: {},
      reports: {},
      announcements: {},
      needs_attention: [],
    }));
    model.listAudit.setImpl(async () => ({
      items: [{ action: "user.suspend" }],
      total: 1,
      next_cursor: null,
    }));

    const res = await request(app).get("/api/admin/overview").set(AUTH);
    assert.equal(res.status, 200);
    assert.equal(res.body.recent_actions.length, 1);

    session.role = "admin";
    const adminRes = await request(app).get("/api/admin/overview").set(AUTH);
    assert.deepEqual(adminRes.body.recent_actions, []);
  });
});

describe("user governance", () => {
  it("lists users with parsed filters and rejects a bad role", async () => {
    model.listUsers.setImpl(async () => ({ items: [], total: 0, next_cursor: null }));

    await request(app)
      .get("/api/admin/users?role=departmentAdmin&status=suspended&limit=10")
      .set(AUTH);
    const args = model.listUsers.calls.at(-1)[0];
    assert.equal(args.role, "departmentAdmin");
    assert.equal(args.status, "suspended");
    assert.equal(args.limit, 10);

    const bad = await request(app).get("/api/admin/users?role=wizard").set(AUTH);
    assert.equal(bad.status, 400);
  });

  it("returns a dossier with the auth email", async () => {
    model.getUserDossier.setImpl(async () => ({ ...targetUser(), email: undefined }));
    accounts.getAuthUser.setImpl(async () => ({ email: "student@lccb.edu.ph" }));

    const res = await request(app).get(`/api/admin/users/${TARGET}`).set(AUTH);
    assert.equal(res.status, 200);
    assert.equal(res.body.email, "student@lccb.edu.ph");
  });

  it("rejects self-management", async () => {
    const res = await request(app)
      .post(`/api/admin/users/${SUPER}/suspend`)
      .set(AUTH)
      .send({ reason: "testing" });
    assert.equal(res.status, 403);
  });

  it("rejects an admin granting admin", async () => {
    session.role = "admin";
    model.getUserByIdText.setImpl(async () => targetUser("student"));

    const res = await request(app)
      .patch(`/api/admin/users/${TARGET}/role`)
      .set(AUTH)
      .send({ role: "admin", reason: "promotion" });
    assert.equal(res.status, 403);
    assert.equal(model.updateUser.calls.length, 0);
  });

  it("lets a superadmin grant admin and audits it", async () => {
    model.getUserByIdText.setImpl(async () => targetUser("student"));
    model.updateUser.setImpl(async () => ({ id: TARGET, role: "admin" }));
    model.getUserById.setImpl(async () => ({ ...targetUser("admin") }));

    const res = await request(app)
      .patch(`/api/admin/users/${TARGET}/role`)
      .set(AUTH)
      .send({ role: "admin", reason: "promotion" });
    assert.equal(res.status, 200);
    assert.equal(model.updateUser.calls[0][1].role, "admin");
    assert.equal(audit.calls.at(-1)[1].action, "user.role_change");
  });

  it("requires a reason on suspension", async () => {
    const res = await request(app)
      .post(`/api/admin/users/${TARGET}/suspend`)
      .set(AUTH)
      .send({});
    assert.equal(res.status, 400);
    assert.equal(accounts.banUser.calls.length, 0);
  });

  it("suspends, revokes sessions, and audits", async () => {
    model.getUserByIdText.setImpl(async () => targetUser("student"));
    model.setUserSuspension.setImpl(async () => ({
      ...targetUser("student"),
      suspended_at: new Date().toISOString(),
    }));

    const res = await request(app)
      .post(`/api/admin/users/${TARGET}/suspend`)
      .set(AUTH)
      .send({ reason: "harassment", until: "2030-01-01T00:00:00.000Z" });

    assert.equal(res.status, 200);
    assert.equal(accounts.banUser.calls[0][0], TARGET);
    assert.equal(accounts.revokeSessions.calls.length, 1);
    assert.equal(audit.calls.at(-1)[1].action, "user.suspend");
  });

  it("unsuspends and audits", async () => {
    model.getUserByIdText.setImpl(async () => ({
      ...targetUser("student"),
      suspended_at: "2026-01-01T00:00:00.000Z",
      suspended_until: "2030-01-01T00:00:00.000Z",
    }));
    model.clearUserSuspension.setImpl(async () => targetUser("student"));

    const res = await request(app)
      .post(`/api/admin/users/${TARGET}/unsuspend`)
      .set(AUTH)
      .send({ reason: "appeal accepted" });

    assert.equal(res.status, 200);
    assert.equal(accounts.unbanUser.calls.length, 1);
    assert.equal(audit.calls.at(-1)[1].action, "user.unsuspend");
  });

  it("keeps force sign-out superadmin-only", async () => {
    session.role = "admin";
    const forbidden = await request(app)
      .post(`/api/admin/users/${TARGET}/force-signout`)
      .set(AUTH)
      .send({ reason: "incident" });
    assert.equal(forbidden.status, 403);

    session.role = "superadmin";
    model.getUserByIdText.setImpl(async () => targetUser("student"));
    const ok = await request(app)
      .post(`/api/admin/users/${TARGET}/force-signout`)
      .set(AUTH)
      .send({ reason: "incident" });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.sessions_revoked, 2);
    assert.equal(audit.calls.at(-1)[1].action, "user.force_signout");
  });

  it("deletes the auth user and profile, then audits", async () => {
    model.getUserByIdText.setImpl(async () => targetUser("student"));
    model.deleteUser.setImpl(async () => targetUser("student"));

    const res = await request(app)
      .delete(`/api/admin/users/${TARGET}`)
      .set(AUTH)
      .send({ reason: "duplicate account" });

    assert.equal(res.status, 200);
    assert.equal(accounts.deleteAuthUser.calls.length, 1);
    assert.equal(model.deleteUser.calls.length, 1);
    assert.equal(audit.calls.at(-1)[1].action, "user.delete");
  });
});

describe("content, audit, and announcements", () => {
  it("validates content filters", async () => {
    const bad = await request(app).get("/api/admin/content?type=wizard").set(AUTH);
    assert.equal(bad.status, 400);

    model.listContent.setImpl(async () => ({ items: [], total: 0, next_cursor: null }));
    const ok = await request(app)
      .get("/api/admin/content?type=thesis&status=flagged&q=ai")
      .set(AUTH);
    assert.equal(ok.status, 200);
    assert.equal(model.listContent.calls.at(-1)[0].type, "thesis");
  });

  it("keeps the full audit log superadmin-only", async () => {
    session.role = "admin";
    const forbidden = await request(app).get("/api/admin/audit").set(AUTH);
    assert.equal(forbidden.status, 403);

    session.role = "superadmin";
    model.listAudit.setImpl(async () => ({ items: [], total: 0, next_cursor: null }));
    const ok = await request(app).get("/api/admin/audit?action=user.suspend").set(AUTH);
    assert.equal(ok.status, 200);
  });

  it("counts an announcement audience", async () => {
    model.getAnnouncementRecipients.setImpl(async () => [{ id: "u2" }, { id: "u3" }]);

    const res = await request(app)
      .get(`/api/admin/announcements/audience-count?type=department&department_id=${DEPT}`)
      .set(AUTH);
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 2);
  });

  it("sends an announcement, inserts notifications, and audits", async () => {
    model.getAnnouncementRecipients.setImpl(async () => [{ id: "u2" }]);
    model.createAnnouncementNotifications.setImpl(async () => 1);

    const res = await request(app)
      .post("/api/admin/announcements")
      .set(AUTH)
      .send({
        title: "Enrollment",
        body: "Opens Monday",
        audience: { type: "all" },
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.recipients, 1);
    assert.equal(model.createAnnouncementNotifications.calls.length, 1);
    assert.equal(audit.calls.at(-1)[1].action, "announcement.send");
  });

  it("rejects an announcement with no recipients", async () => {
    model.getAnnouncementRecipients.setImpl(async () => []);

    const res = await request(app)
      .post("/api/admin/announcements")
      .set(AUTH)
      .send({
        title: "Enrollment",
        body: "Opens Monday",
        audience: { type: "role", role: "student" },
      });
    assert.equal(res.status, 400);
  });
});
