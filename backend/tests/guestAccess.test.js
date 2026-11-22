require("./env.helper");

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const guestDeclarationController = require("../controllers/guestDeclarationController");
const guestAccessModel = require("../models/guestAccessModel");
const verificationController = require("../controllers/verificationController");
const { requireContentAccess, requireVerified } = require("../middleware/auth");

function makeReq(overrides = {}) {
  return {
    user: { id: overrides.userId || "test-user-id", email: overrides.email || "guest@gmail.com" },
    profile: {
      id: overrides.userId || "test-user-id",
      email: overrides.email || "guest@gmail.com",
      role: "user",
      verification_status: "unverified",
      ...(overrides.profile || {}),
    },
    body: overrides.body || {},
    params: overrides.params || {},
    query: overrides.query || {},
    headers: overrides.headers || {},
  };
}

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
}

function makeNext() {
  let called = false;
  let error = null;
  const next = (err) => {
    called = true;
    error = err;
  };
  next.isCalled = () => called;
  next.getError = () => error;
  return next;
}

describe("POST /auth/guest declaration", () => {
  it("rejects school-account emails with school_account", async () => {
    const req = makeReq({
      email: "student@lccbonline.edu.ph",
      profile: { email: "student@lccbonline.edu.ph", role: "user" },
      body: {
        purpose: "Research thesis",
        affiliation_type: "student_elsewhere",
        affiliation_name: "UP Diliman",
      },
    });
    const res = makeRes();
    const next = makeNext();

    await guestDeclarationController.declare(req, res, next);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "school_account");
  });

  it("rejects when role already set (role_already_set)", async () => {
    const req = makeReq({
      email: "researcher@gmail.com",
      profile: { email: "researcher@gmail.com", role: "guest" },
      body: {
        purpose: "Research thesis",
        affiliation_type: "researcher",
        affiliation_name: "DOST",
      },
    });
    const res = makeRes();
    const next = makeNext();

    await guestDeclarationController.declare(req, res, next);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "role_already_set");
  });
});

describe("requireContentAccess middleware", () => {
  it("returns 403 guest_pending for pending guest", () => {
    const req = makeReq({
      profile: { role: "guest", verification_status: "pending" },
    });
    const res = makeRes();
    const next = makeNext();

    requireContentAccess(req, res, next);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, "guest_pending");
    assert.equal(next.isCalled(), false);
  });

  it("passes approved guest", () => {
    const req = makeReq({
      profile: { role: "guest", verification_status: "approved" },
    });
    const res = makeRes();
    const next = makeNext();

    requireContentAccess(req, res, next);
    assert.equal(next.isCalled(), true);
  });

  it("passes regular verified user or staff", () => {
    const req = makeReq({
      profile: { role: "student", verification_status: "verified" },
    });
    const res = makeRes();
    const next = makeNext();

    requireContentAccess(req, res, next);
    assert.equal(next.isCalled(), true);
  });
});

describe("requireVerified copy for guests", () => {
  it("returns 403 guest_read_only when guest tries write actions", () => {
    const req = makeReq({
      profile: { role: "guest", verification_status: "approved" },
    });
    const res = makeRes();
    const next = makeNext();

    requireVerified(req, res, next);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, "guest_read_only");
    assert.equal(next.isCalled(), false);
  });
});

describe("Admin review permissions for guest requests", () => {
  it("GET /verification/requests?kind=guest forbids non-admin", async () => {
    const req = makeReq({
      profile: { role: "departmentAdmin", department_id: "dept-1" },
      query: { kind: "guest" },
    });
    const res = makeRes();
    const next = makeNext();

    await verificationController.queue(req, res, next);
    assert.equal(res.statusCode, 403);
  });

  it("POST /verification/:id/approve?kind=guest forbids non-admin", async () => {
    const req = makeReq({
      profile: { role: "departmentAdmin", department_id: "dept-1" },
      query: { kind: "guest" },
      params: { id: "00000000-0000-0000-0000-000000000000" },
    });
    const res = makeRes();
    const next = makeNext();

    await verificationController.approve(req, res, next);
    assert.equal(res.statusCode, 403);
  });
});
