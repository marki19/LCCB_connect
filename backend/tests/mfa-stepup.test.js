require("./env.helper");

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const authController = require("../controllers/authController");
const mfaService = require("../services/mfaService");
const db = require("../db");
const { stub } = require("./stub.helper");

describe("MFA Step-Up Re-Authentication", () => {
  let listFactorsStub;
  let decryptStub;
  let verifyTotpStub;
  let recordSessionEventStub;
  let clearCacheStub;
  let recordMfaChallengeStub;
  let dbQueryStub;

  beforeEach(() => {
    listFactorsStub = stub(mfaService, "listFactors", async () => []);
    decryptStub = stub(mfaService, "decryptTotpSecret", () => "JBSWY3DPEHPK3PXP");
    verifyTotpStub = stub(mfaService, "verifyTotpTimingSafe", () => ({
      valid: true,
      currentStep: 12345,
      isReplay: false,
    }));
    recordSessionEventStub = stub(mfaService, "recordSessionEvent", async () => {});
    clearCacheStub = stub(mfaService, "clearSessionAgeCache", () => {});
    recordMfaChallengeStub = stub(mfaService, "recordMfaChallenge", async () => {});
    dbQueryStub = stub(db, "query", async () => ({ rows: [] }));
  });

  afterEach(() => {
    listFactorsStub.restore();
    decryptStub.restore();
    verifyTotpStub.restore();
    recordSessionEventStub.restore();
    clearCacheStub.restore();
    recordMfaChallengeStub.restore();
    dbQueryStub.restore();
  });

  it("rejects non-admin roles with 403", async () => {
    const req = {
      user: { id: "user-student" },
      profile: { role: "student" },
      body: { code: "123456" },
    };
    let statusCode = 200;
    let jsonBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: (data) => { jsonBody = data; } };
      },
    };

    await authController.mfaStepUp(req, res, () => {});
    assert.equal(statusCode, 403);
    assert.match(jsonBody.error, /reserved for administrators/i);
  });

  it("rejects invalid 6-digit code with 400", async () => {
    const req = {
      user: { id: "user-admin" },
      profile: { role: "admin" },
      body: { code: "abc" },
    };
    let statusCode = 200;
    let jsonBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: (data) => { jsonBody = data; } };
      },
    };

    await authController.mfaStepUp(req, res, () => {});
    assert.equal(statusCode, 400);
    assert.match(jsonBody.error, /6-digit/i);
  });

  it("rejects when no verified factor exists with 400", async () => {
    listFactorsStub.setImpl(async () => []);

    const req = {
      user: { id: "user-admin" },
      profile: { role: "admin" },
      body: { code: "123456" },
    };
    let statusCode = 200;
    let jsonBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: (data) => { jsonBody = data; } };
      },
    };

    await authController.mfaStepUp(req, res, () => {});
    assert.equal(statusCode, 400);
    assert.match(jsonBody.error, /No verified authenticator app/i);
  });

  it("rejects wrong TOTP code with 401", async () => {
    listFactorsStub.setImpl(async () => [
      { id: "factor-1", type: "totp", status: "verified", secret: '{"ciphertext":"abc"}' },
    ]);
    verifyTotpStub.setImpl(() => ({ valid: false, isReplay: false }));

    const req = {
      user: { id: "user-admin" },
      profile: { role: "superadmin" },
      body: { code: "999999" },
    };
    let statusCode = 200;
    let jsonBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: (data) => { jsonBody = data; } };
      },
    };

    await authController.mfaStepUp(req, res, () => {});
    assert.equal(statusCode, 401);
    assert.match(jsonBody.error, /Invalid or expired code/i);
    assert.equal(recordMfaChallengeStub.calls.length, 1);
  });

  it("successfully elevates session on valid code", async () => {
    listFactorsStub.setImpl(async () => [
      { id: "factor-1", type: "totp", status: "verified", secret: '{"ciphertext":"abc"}' },
    ]);
    verifyTotpStub.setImpl(() => ({ valid: true, currentStep: 55555, isReplay: false }));

    const req = {
      user: { id: "user-admin" },
      profile: { role: "admin" },
      body: { code: "123456" },
      ip: "127.0.0.1",
      headers: { "user-agent": "test-agent" },
    };
    let jsonBody = null;
    const res = {
      json: (data) => {
        jsonBody = data;
      },
    };

    await authController.mfaStepUp(req, res, () => {});
    assert.equal(jsonBody.ok, true);
    assert.equal(jsonBody.aal, "aal2");
    assert.equal(recordSessionEventStub.calls.length, 1);
    assert.equal(clearCacheStub.calls.length, 1);
  });

  it("checks admin session status correctly", async () => {
    // 1. Non-admin returns false
    const reqStudent = { user: { id: "u1" }, profile: { role: "student" } };
    let resData = null;
    await authController.checkAdminSession(reqStudent, { json: (d) => { resData = d; } }, () => {});
    assert.equal(resData.isAdmin, false);
    assert.equal(resData.valid, false);

    // 2. Admin with recent event returns valid: true
    const recentDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    dbQueryStub.setImpl(async () => ({
      rows: [{ created_at: recentDate, event_type: "mfa_challenge", aal: "aal2" }],
    }));

    const reqAdmin = { user: { id: "u2" }, profile: { role: "admin" } };
    await authController.checkAdminSession(reqAdmin, { json: (d) => { resData = d; } }, () => {});
    assert.equal(resData.isAdmin, true);
    assert.equal(resData.valid, true);
    assert.ok(resData.remainingMs > 0);

    // 3. Admin with expired event (>24h) returns valid: false
    const oldDate = new Date(Date.now() - 90000000).toISOString(); // ~25 hours ago
    dbQueryStub.setImpl(async () => ({
      rows: [{ created_at: oldDate, event_type: "login", aal: "aal1" }],
    }));

    await authController.checkAdminSession(reqAdmin, { json: (d) => { resData = d; } }, () => {});
    assert.equal(resData.isAdmin, true);
    assert.equal(resData.valid, false);
    assert.equal(resData.remainingMs, 0);
  });
});

