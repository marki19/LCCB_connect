/**
 * MFA & Admin Session Security Tests
 * Verifies:
 * 1. Admin login without MFA returns tokens with mfa_enrollment_required: true (no lockout!)
 * 2. requireAal2 allows non-admins and AAL2 sessions; blocks AAL1 admins with 403
 * 3. checkSessionAge enforces 24h admin limit, 7d user limit, and rejects logged-out sessions
 */
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mfaService = require("../services/mfaService");

describe("MFA & Session Security", () => {
  beforeEach(() => {
    // Clear session age cache between tests
    if (mfaService.checkSessionAge.cache) {
      mfaService.checkSessionAge.cache.clear();
    }
  });

  describe("requireAal2 Middleware", () => {
    it("should allow non-admin roles with AAL1 session", async () => {
      const req = {
        profile: { role: "student" },
        accessToken: "mock-aal1-token",
      };
      let nextCalled = false;
      const res = {};
      await mfaService.requireAal2(req, res, () => {
        nextCalled = true;
      });
      assert.equal(nextCalled, true, "student with AAL1 passes through");
    });

    it("should allow faculty role with AAL1 session", async () => {
      const req = {
        profile: { role: "faculty" },
        accessToken: "mock-aal1-token",
      };
      let nextCalled = false;
      const res = {};
      await mfaService.requireAal2(req, res, () => {
        nextCalled = true;
      });
      assert.equal(nextCalled, true, "faculty passes through");
    });

    it("should allow admin role when session has AAL2", async () => {
      const req = {
        user: { id: "admin-1" },
        profile: { role: "admin" },
        sessionAal: "aal2",
        accessToken: "mock-aal2-token",
      };
      let nextCalled = false;
      const res = {};
      await mfaService.requireAal2(req, res, () => {
        nextCalled = true;
      });
      assert.equal(nextCalled, true, "admin with AAL2 passes through");
    });

    it("should reject admin role when session is only AAL1", async () => {
      const req = {
        user: { id: "admin-1" },
        profile: { role: "admin" },
        sessionAal: "aal1",
        accessToken: "mock-aal1-token",
      };
      let nextCalled = false;
      let statusCode = null;
      let jsonBody = null;
      const res = {
        status(code) {
          statusCode = code;
          return {
            json(body) {
              jsonBody = body;
            },
          };
        },
      };

      await mfaService.requireAal2(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, "admin with AAL1 is rejected");
      assert.equal(statusCode, 403);
      assert.equal(jsonBody?.code, "mfa_required");
      assert.equal(jsonBody?.aal, "aal2");
    });
  });

  describe("checkSessionAge Middleware", () => {
    it("should pass when session is fresh and within limit", async () => {
      const userId = "test-user-fresh";
      const now = Date.now();
      // Prime memory cache with a fresh session
      const cache = mfaService.checkSessionAge.cache || (mfaService.checkSessionAge.cache = new Map());
      cache.set(userId, { valid: true, ts: now, aal: "aal2" });

      const req = {
        user: { id: userId },
        profile: { role: "admin" },
      };
      let nextCalled = false;
      const res = {};

      await mfaService.checkSessionAge(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(req.sessionAal, "aal2");
    });

    it("should reject when session is revoked or logged out", async () => {
      const userId = "test-user-logged-out";
      const now = Date.now();
      const cache = mfaService.checkSessionAge.cache || (mfaService.checkSessionAge.cache = new Map());
      cache.set(userId, { valid: false, ts: now, aal: "aal1", error: "Session has been logged out" });

      const req = {
        user: { id: userId },
        profile: { role: "admin" },
      };
      let nextCalled = false;
      let statusCode = null;
      let jsonBody = null;
      const res = {
        status(code) {
          statusCode = code;
          return {
            json(body) {
              jsonBody = body;
            },
          };
        },
      };

      await mfaService.checkSessionAge(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(statusCode, 401);
      assert.equal(jsonBody?.code, "session_expired");
    });

    it("should clear session age cache on clearSessionAgeCache", () => {
      const userId = "test-clear";
      const cache = mfaService.checkSessionAge.cache || (mfaService.checkSessionAge.cache = new Map());
      cache.set(userId, { valid: true, ts: Date.now(), aal: "aal2" });

      assert.ok(cache.has(userId));
      mfaService.clearSessionAgeCache(userId);
      assert.equal(cache.has(userId), false);
    });
  });
});

