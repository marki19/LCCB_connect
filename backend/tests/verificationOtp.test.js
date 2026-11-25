// Role-specific verification with an emailed code.
//
// Auth, the models, the mailer, the audit log and the notification fan-out are
// all stubbed, so this exercises the HTTP contract: who may ask for a code, who
// may act on a request, and what the code gates.
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const auth = require("../middleware/auth");
const verificationModel = require("../models/verificationModel");
const verificationOtpModel = require("../models/verificationOtpModel");
const userModel = require("../models/userModel");
const departmentModel = require("../models/departmentModel");
const emailService = require("../services/emailService");
const auditService = require("../services/auditService");
const notificationService = require("../services/notificationService");

const USER = "11111111-1111-4111-8111-111111111111";
const DEPT_A = "22222222-2222-4222-8222-222222222222";
const DEPT_B = "33333333-3333-4333-8333-333333333333";
const COURSE_A = "44444444-4444-4444-8444-444444444444";
const REQUEST_ID = "55555555-5555-4555-8555-555555555555";

let profile;

const baseProfile = (over = {}) => ({
  id: USER,
  role: "student",
  email: "ana@lccbonline.edu.ph",
  full_name: "Ana Cruz",
  student_id: null,
  department_id: DEPT_A,
  course_id: COURSE_A,
  year_level: "3rd Year",
  verification_status: "unverified",
  ...over,
});

stub(auth, "requireAuth", (req, res, next) => {
  if (!(req.headers.authorization || "").startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: USER };
  return next();
});
stub(auth, "loadProfile", (req, res, next) => {
  req.profile = profile;
  return next();
});
stub(auth, "requireActiveAccount", (req, res, next) => next());

const model = {
  getLatestForUser: stub(verificationModel, "getLatestForUser"),
  getById: stub(verificationModel, "getById"),
  createPending: stub(verificationModel, "createPending"),
  updatePending: stub(verificationModel, "updatePending"),
  listQueue: stub(verificationModel, "listQueue"),
  resolveReviewers: stub(verificationModel, "resolveReviewers"),
  markEscalated: stub(verificationModel, "markEscalated"),
  approve: stub(verificationModel, "approve"),
  decline: stub(verificationModel, "decline"),
};
const otp = {
  issue: stub(verificationOtpModel, "issue"),
  verifyAndConsume: stub(verificationOtpModel, "verifyAndConsume"),
};
const mail = stub(emailService, "sendOtpEmail", async () => {});
const audit = stub(auditService, "recordRequest", async () => {});
const notify = {
  createNotifications: stub(notificationService, "createNotifications", async () => {}),
  notifyUser: stub(notificationService, "notifyUser", async () => {}),
};
const users = stub(userModel, "updateUser", async () => ({}));
const catalog = {
  getActiveDepartmentById: stub(departmentModel, "getActiveDepartmentById", async () => ({
    id: DEPT_A,
  })),
  getActiveCourseById: stub(departmentModel, "getActiveCourseById", async () => ({
    id: COURSE_A,
    department_id: DEPT_A,
  })),
};

const app = require("../app");
const AUTH = { Authorization: "Bearer test-token" };

const studentBody = {
  full_name: "Ana Cruz",
  student_id: "2023-12345",
  department_id: DEPT_A,
  course_id: COURSE_A,
  year_level: "3rd Year",
  birthdate: "2003-05-14",
  otp_code: "123456",
};

const pendingRequest = (over = {}) => ({
  id: REQUEST_ID,
  user_id: USER,
  role: "student",
  status: "pending",
  full_name: "Ana Cruz",
  student_id: "2023-12345",
  department_id: DEPT_A,
  course_id: COURSE_A,
  year_level: "3rd Year",
  ...over,
});

beforeEach(() => {
  profile = baseProfile();
  for (const fn of [
    ...Object.values(model),
    ...Object.values(otp),
    ...Object.values(notify),
  ]) {
    fn.calls.length = 0;
    fn.setImpl(() => undefined);
  }
  mail.calls.length = 0;
  audit.calls.length = 0;
  users.calls.length = 0;
  catalog.getActiveDepartmentById.setImpl(async () => ({ id: DEPT_A }));
  catalog.getActiveCourseById.setImpl(async () => ({
    id: COURSE_A,
    department_id: DEPT_A,
  }));
  otp.verifyAndConsume.setImpl(async () => ({ ok: true }));
});

describe("POST /api/verification/otp", () => {
  it("refuses a superadmin: they never verify", async () => {
    profile = baseProfile({ role: "superadmin" });

    const res = await request(app).post("/api/verification/otp").set(AUTH).send({});

    assert.equal(res.status, 403);
    assert.match(res.body.error, /does not verify/);
    assert.equal(otp.issue.calls.length, 0);
  });

  it("issues a code to an account that has not chosen a role yet", async () => {
    profile = baseProfile({ role: "user" });
    otp.issue.setImpl(async () => ({
      code: "654321",
      expiresAt: "2026-11-12T10:10:00.000Z",
    }));

    const res = await request(app).post("/api/verification/otp").set(AUTH).send({});

    assert.equal(res.status, 202);
    assert.equal(otp.issue.calls.length, 1);
  });

  it("emails a code to other users (non-school accounts)", async () => {
    profile = baseProfile({ email: "ana@gmail.com" });
    otp.issue.setImpl(async () => ({
      code: "654321",
      expiresAt: "2026-11-12T10:10:00.000Z",
    }));

    const res = await request(app).post("/api/verification/otp").set(AUTH).send({});

    assert.equal(res.status, 202);
    assert.equal(otp.issue.calls.length, 1);
    assert.equal(mail.calls.length, 1);
    assert.equal(mail.calls[0][0].to, "ana@gmail.com");
    assert.equal(mail.calls[0][0].otpCode, "654321");
  });

  it("emails a code to the caller's own school address", async () => {
    otp.issue.setImpl(async () => ({
      code: "654321",
      expiresAt: "2026-11-12T10:10:00.000Z",
    }));

    const res = await request(app).post("/api/verification/otp").set(AUTH).send({});

    assert.equal(res.status, 202);
    assert.equal(otp.issue.calls[0][0].email, "ana@lccbonline.edu.ph");
    assert.equal(mail.calls.length, 1);
    assert.equal(mail.calls[0][0].to, "ana@lccbonline.edu.ph");
    assert.equal(mail.calls[0][0].otpCode, "654321");
  });
});

describe("POST /api/verification", () => {
  it("rejects a submission without a code for other users", async () => {
    profile = baseProfile({ email: "ana@gmail.com" });
    const { otp_code, ...body } = studentBody;

    const res = await request(app).post("/api/verification").set(AUTH).send(body);

    assert.equal(res.status, 400);
    assert.equal(model.createPending.calls.length, 0);
  });

  it("accepts a submission without a code for lccb accounts", async () => {
    profile = baseProfile({ email: "ana@lccbonline.edu.ph" });
    model.createPending.setImpl(async () => pendingRequest());
    model.resolveReviewers.setImpl(async () => [{ id: "dept-admin" }]);

    const { otp_code, ...body } = studentBody;
    const res = await request(app).post("/api/verification").set(AUTH).send(body);

    assert.equal(res.status, 201);
    assert.equal(model.createPending.calls.length, 1);
  });

  it("rejects a body that tries to set its own role", async () => {
    const res = await request(app)
      .post("/api/verification")
      .set(AUTH)
      .send({ ...studentBody, role: "admin" });

    assert.equal(res.status, 400);
    assert.equal(model.createPending.calls.length, 0);
  });

  it("refuses a wrong code and writes nothing", async () => {
    otp.verifyAndConsume.setImpl(async () => ({
      ok: false,
      reason: "mismatch",
      attemptsLeft: 3,
    }));

    const res = await request(app).post("/api/verification").set(AUTH).send(studentBody);

    assert.equal(res.status, 400);
    assert.equal(res.body.attempts_left, 3);
    assert.equal(model.createPending.calls.length, 0);
  });

  it("stops after too many wrong codes", async () => {
    otp.verifyAndConsume.setImpl(async () => ({ ok: false, reason: "too_many" }));

    const res = await request(app).post("/api/verification").set(AUTH).send(studentBody);

    assert.equal(res.status, 429);
    assert.equal(model.createPending.calls.length, 0);
  });

  it("treats an expired code as expired, not incorrect", async () => {
    otp.verifyAndConsume.setImpl(async () => ({ ok: false, reason: "expired" }));

    const res = await request(app).post("/api/verification").set(AUTH).send(studentBody);

    assert.equal(res.status, 400);
    assert.match(res.body.error, /expired/i);
  });

  it("stores the role from the profile and notifies that role's reviewers", async () => {
    model.createPending.setImpl(async () => pendingRequest());
    model.resolveReviewers.setImpl(async () => [{ id: "dept-admin", department_name: "CCS" }]);

    const res = await request(app).post("/api/verification").set(AUTH).send(studentBody);

    assert.equal(res.status, 201);
    assert.equal(model.createPending.calls[0][1].role, "student");
    assert.equal(otp.verifyAndConsume.calls[0][0].code, "123456");

    const reviewerQuery = model.resolveReviewers.calls[0][0];
    assert.deepEqual(reviewerQuery.campusRoles, []);
    assert.deepEqual(reviewerQuery.departmentRoles, ["departmentAdmin"]);
    assert.equal(reviewerQuery.departmentId, DEPT_A);

    assert.equal(notify.createNotifications.calls.length, 1);
    assert.deepEqual(notify.createNotifications.calls[0][0], ["dept-admin"]);
  });

  it("refuses a student who omits their course", async () => {
    const { course_id, ...body } = studentBody;

    const res = await request(app).post("/api/verification").set(AUTH).send(body);

    assert.equal(res.status, 400);
    assert.equal(model.createPending.calls.length, 0);
  });

  it("409s when a request is already under review", async () => {
    model.createPending.setImpl(async () => {
      const err = new Error("duplicate");
      err.code = "23505";
      throw err;
    });

    const res = await request(app).post("/api/verification").set(AUTH).send(studentBody);

    assert.equal(res.status, 409);
  });

  describe("an account that has not chosen a role", () => {
    beforeEach(() => {
      profile = baseProfile({ role: "user" });
    });

    it("files the request under the role it picked", async () => {
      model.createPending.setImpl(async () => pendingRequest({ role: "faculty" }));
      model.resolveReviewers.setImpl(async () => [{ id: "dept-admin" }]);

      const res = await request(app)
        .post("/api/verification")
        .set(AUTH)
        .send({ ...studentBody, role: "faculty" });

      assert.equal(res.status, 201);
      assert.equal(model.createPending.calls[0][1].role, "faculty");
    });

    it("is told to choose when it sends no role", async () => {
      const res = await request(app).post("/api/verification").set(AUTH).send(studentBody);

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Choose an account type/);
      assert.equal(model.createPending.calls.length, 0);
    });

    it("cannot ask for superadmin", async () => {
      const res = await request(app)
        .post("/api/verification")
        .set(AUTH)
        .send({ ...studentBody, role: "superadmin" });

      assert.equal(res.status, 400);
      assert.equal(model.createPending.calls.length, 0);
    });
  });

  it("escalates to campus reviewers when the department has none", async () => {
    profile = baseProfile({ role: "user" });
    model.createPending.setImpl(async () => pendingRequest());
    model.markEscalated.setImpl(async () => pendingRequest({ escalated_at: "2026-11-14T00:00:00Z" }));
    model.resolveReviewers.setImpl(async (query) =>
      query.campusRoles.length > 0 ? [{ id: "campus-admin" }] : []
    );

    const res = await request(app)
      .post("/api/verification")
      .set(AUTH)
      .send({ ...studentBody, role: "student" });

    assert.equal(res.status, 201);
    assert.equal(model.markEscalated.calls.length, 1);
    assert.equal(model.markEscalated.calls[0][0], REQUEST_ID);

    const escalatedQuery = model.resolveReviewers.calls[1][0];
    assert.deepEqual(escalatedQuery.campusRoles, ["admin", "superadmin"]);
    assert.deepEqual(notify.createNotifications.calls[0][0], ["campus-admin"]);
  });
});

describe("PUT /api/verification/mine", () => {
  it("404s when nothing is pending", async () => {
    model.getLatestForUser.setImpl(async () => undefined);

    const res = await request(app).put("/api/verification/mine").set(AUTH).send(studentBody);

    assert.equal(res.status, 404);
    assert.equal(model.updatePending.calls.length, 0);
  });

  it("updates a pending request after the code checks out", async () => {
    model.getLatestForUser.setImpl(async () => pendingRequest());
    model.updatePending.setImpl(async () => pendingRequest());

    const res = await request(app).put("/api/verification/mine").set(AUTH).send(studentBody);

    assert.equal(res.status, 200);
    assert.equal(otp.verifyAndConsume.calls.length, 1);
    assert.equal(model.updatePending.calls[0][1].role, "student");
  });

  it("updates a pending request without a code for lccb accounts", async () => {
    profile = baseProfile({ email: "ana@lccbonline.edu.ph" });
    model.getLatestForUser.setImpl(async () => pendingRequest());
    model.updatePending.setImpl(async () => pendingRequest());

    const { otp_code, ...body } = studentBody;
    const res = await request(app).put("/api/verification/mine").set(AUTH).send(body);

    assert.equal(res.status, 200);
    assert.equal(model.updatePending.calls.length, 1);
  });

  it("keeps the role the pending request was filed under", async () => {
    profile = baseProfile({ role: "user" });
    model.getLatestForUser.setImpl(async () => pendingRequest({ role: "faculty" }));
    model.updatePending.setImpl(async () => pendingRequest({ role: "faculty" }));

    const res = await request(app)
      .put("/api/verification/mine")
      .set(AUTH)
      .send({ ...studentBody, role: "student" });

    assert.equal(res.status, 200);
    assert.equal(model.updatePending.calls[0][1].role, "faculty");
  });
});

describe("GET /api/verification/mine", () => {
  it("offers the selectable roles to an account that has not chosen one", async () => {
    profile = baseProfile({ role: "user" });
    model.getLatestForUser.setImpl(async () => undefined);

    const res = await request(app).get("/api/verification/mine").set(AUTH);

    assert.equal(res.status, 200);
    assert.equal(res.body.role, null);
    assert.equal(res.body.fields, null);
    assert.deepEqual(res.body.selectable_roles, ["student", "faculty", "departmentAdmin", "admin"]);
  });

  it("previews the form shape for a role it is considering", async () => {
    profile = baseProfile({ role: "user" });
    model.getLatestForUser.setImpl(async () => undefined);

    const res = await request(app).get("/api/verification/mine?role=student").set(AUTH);

    assert.equal(res.status, 200);
    assert.equal(res.body.role, "student");
    assert.deepEqual(res.body.fields, { department: true, course: true, yearLevel: true });
  });

  it("withholds the picker from an account that already has a role", async () => {
    model.getLatestForUser.setImpl(async () => undefined);

    const res = await request(app).get("/api/verification/mine").set(AUTH);

    assert.equal(res.status, 200);
    assert.equal(res.body.role, "student");
    assert.equal(res.body.selectable_roles, null);
  });

  it("ignores a role preview on an account whose role is already fixed", async () => {
    model.getLatestForUser.setImpl(async () => undefined);

    const res = await request(app).get("/api/verification/mine?role=admin").set(AUTH);

    assert.equal(res.status, 200);
    assert.equal(res.body.role, "student");
    assert.deepEqual(res.body.fields, { department: true, course: true, yearLevel: true });
  });
});

describe("GET /api/verification/queue", () => {
  const queueFor = async (role, departmentId = null) => {
    profile = baseProfile({ role, department_id: departmentId });
    model.listQueue.setImpl(async () => []);
    return request(app).get("/api/verification/queue").set(AUTH);
  };

  it("403s for a student", async () => {
    const res = await queueFor("student");
    assert.equal(res.status, 403);
  });

  it("a department admin sees only student and faculty requests in their department", async () => {
    const res = await queueFor("departmentAdmin", DEPT_A);

    assert.equal(res.status, 200);
    assert.deepEqual(model.listQueue.calls[0][0].roles, ["faculty", "student"]);
    assert.equal(model.listQueue.calls[0][0].departmentId, DEPT_A);
  });

  it("an admin sees department-admin requests campus-wide", async () => {
    const res = await queueFor("admin");

    assert.equal(res.status, 200);
    assert.deepEqual(model.listQueue.calls[0][0].roles, ["departmentAdmin"]);
    assert.equal(model.listQueue.calls[0][0].departmentId, null);
  });

  it("a superadmin sees admin and department-admin requests", async () => {
    const res = await queueFor("superadmin");

    assert.equal(res.status, 200);
    assert.deepEqual(model.listQueue.calls[0][0].roles, ["admin", "departmentAdmin"]);
  });

  it("403s a department admin with no department assigned", async () => {
    const res = await queueFor("departmentAdmin", null);
    assert.equal(res.status, 403);
    assert.equal(model.listQueue.calls.length, 0);
  });
});

describe("POST /api/verification/:id/approve", () => {
  it("403s an admin trying to approve a student", async () => {
    profile = baseProfile({ role: "admin", department_id: null });
    model.getById.setImpl(async () => pendingRequest({ role: "student" }));

    const res = await request(app)
      .post(`/api/verification/${REQUEST_ID}/approve`)
      .set(AUTH);

    assert.equal(res.status, 403);
    assert.equal(model.approve.calls.length, 0);
  });

  it("403s a department admin approving outside their department", async () => {
    profile = baseProfile({ role: "departmentAdmin", department_id: DEPT_A });
    model.getById.setImpl(async () => pendingRequest({ department_id: DEPT_B }));

    const res = await request(app)
      .post(`/api/verification/${REQUEST_ID}/approve`)
      .set(AUTH);

    assert.equal(res.status, 403);
    assert.equal(model.approve.calls.length, 0);
  });

  it("lets a superadmin approve an admin", async () => {
    profile = baseProfile({ role: "superadmin", department_id: null });
    model.getById.setImpl(async () =>
      pendingRequest({ role: "admin", department_id: null, course_id: null, year_level: null })
    );
    model.approve.setImpl(async () => pendingRequest({ role: "admin", status: "approved" }));

    const res = await request(app)
      .post(`/api/verification/${REQUEST_ID}/approve`)
      .set(AUTH);

    assert.equal(res.status, 200);
    assert.equal(model.approve.calls.length, 1);
    assert.equal(notify.notifyUser.calls[0][0].type, "verification_approved");
  });

  it("409s when the catalog has moved on", async () => {
    profile = baseProfile({ role: "departmentAdmin", department_id: DEPT_A });
    model.getById.setImpl(async () => pendingRequest());
    catalog.getActiveCourseById.setImpl(async () => undefined);

    const res = await request(app)
      .post(`/api/verification/${REQUEST_ID}/approve`)
      .set(AUTH);

    assert.equal(res.status, 409);
    assert.equal(model.approve.calls.length, 0);
  });

  it("404s for a missing request", async () => {
    profile = baseProfile({ role: "admin", department_id: null });
    model.getById.setImpl(async () => undefined);

    const res = await request(app)
      .post(`/api/verification/${REQUEST_ID}/approve`)
      .set(AUTH);

    assert.equal(res.status, 404);
  });
});

describe("POST /api/verification/:id/decline", () => {
  it("records the note and tells the requester", async () => {
    profile = baseProfile({ role: "departmentAdmin", department_id: DEPT_A });
    model.getById.setImpl(async () => pendingRequest());
    model.decline.setImpl(async () => pendingRequest({ status: "declined" }));

    const res = await request(app)
      .post(`/api/verification/${REQUEST_ID}/decline`)
      .set(AUTH)
      .send({ note: "ID photo is unreadable" });

    assert.equal(res.status, 200);
    assert.equal(model.decline.calls[0][2], "ID photo is unreadable");
    assert.match(notify.notifyUser.calls[0][0].message, /unreadable/);
  });

  it("403s a department admin declining another department's request", async () => {
    profile = baseProfile({ role: "departmentAdmin", department_id: DEPT_A });
    model.getById.setImpl(async () => pendingRequest({ department_id: DEPT_B }));

    const res = await request(app)
      .post(`/api/verification/${REQUEST_ID}/decline`)
      .set(AUTH)
      .send({ note: "wrong department" });

    assert.equal(res.status, 403);
    assert.equal(model.decline.calls.length, 0);
  });
});
