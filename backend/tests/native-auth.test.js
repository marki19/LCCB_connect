require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const bcrypt = require("bcrypt");

const { stub } = require("./stub.helper");
const nativeAuth = require("../services/nativeAuth");
const auth = require("../middleware/auth");
const userModel = require("../models/userModel");
const passwordResetModel = require("../models/passwordResetModel");
const mfaService = require("../services/mfaService");
const accountService = require("../services/accountService");
const { hashOtp } = require("../utils/otp");

const app = require("../app");

describe("Native Auth Service (Self-Hosted)", () => {
  describe("Password Hashing & Verification", () => {
    it("hashes and verifies plaintext passwords correctly", async () => {
      const password = "SuperSecretPassword123!";
      const hash = await nativeAuth.hashPassword(password);
      assert.ok(hash && hash.startsWith("$2"), "Hash should be a bcrypt string");

      const match = await nativeAuth.verifyPassword(password, hash);
      assert.strictEqual(match, true);

      const wrongMatch = await nativeAuth.verifyPassword("WrongPassword123!", hash);
      assert.strictEqual(wrongMatch, false);
    });

    it("rejects empty or invalid passwords safely", async () => {
      const match = await nativeAuth.verifyPassword("", "$2b$12$somehash");
      assert.strictEqual(match, false);
      const matchNull = await nativeAuth.verifyPassword(null, null);
      assert.strictEqual(matchNull, false);
    });
  });

  describe("Token Issuance and Verification", () => {
    const mockUser = {
      id: "11111111-2222-3333-4444-555555555555",
      email: "test.student@lccbonline.edu.ph",
      role: "student",
      full_name: "Test Student",
      username: "teststudent",
    };

    it("mints valid access and refresh tokens", async () => {
      const tokens = await nativeAuth.signTokens(mockUser, { aal: "aal1" });
      assert.ok(tokens.access_token);
      assert.ok(tokens.refresh_token);
      assert.ok(tokens.expires_at > Date.now() / 1000);

      // Verify access token
      const verified = nativeAuth.verifyAccessToken(tokens.access_token);
      assert.ok(verified);
      assert.strictEqual(verified.id, mockUser.id);
      assert.strictEqual(verified.email, mockUser.email);
      assert.strictEqual(verified.aal, "aal1");
      assert.strictEqual(verified.user_metadata.full_name, mockUser.full_name);
    });

    it("verifies refresh tokens independently", async () => {
      const tokens = await nativeAuth.signTokens(mockUser);
      const refreshVerified = nativeAuth.verifyRefreshToken(tokens.refresh_token);
      assert.ok(refreshVerified);
      assert.strictEqual(refreshVerified.sub, mockUser.id);
      assert.strictEqual(refreshVerified.token_type, "refresh");
    });

    it("rejects tampered or forged tokens", async () => {
      const tokens = await nativeAuth.signTokens(mockUser);
      const tampered = tokens.access_token.slice(0, -6) + "xxxxxx";
      const verified = nativeAuth.verifyAccessToken(tampered);
      assert.strictEqual(verified, null);
    });
  });

  describe("Middleware requireAuth Integration", () => {
    it("authenticates native tokens with 0ms overhead", async () => {
      const mockUser = {
        id: "22222222-3333-4444-5555-666666666666",
        email: "fast.student@lccbonline.edu.ph",
        role: "student",
      };

      stub(userModel, "getUserById", async (id) => {
        if (id === mockUser.id) return { ...mockUser, status: "active", profile_completed: true };
        return null;
      });

      const tokens = await nativeAuth.signTokens(mockUser);
      const res = await request(app)
        .get(`/api/users/${mockUser.id}`)
        .set("Authorization", `Bearer ${tokens.access_token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.email, mockUser.email);
    });
  });

  describe("POST /api/auth/login with Native Password", () => {
    it("logs in successfully using native bcrypt password_hash", async () => {
      const password = "ValidPassword123!";
      const hash = await bcrypt.hash(password, 10);
      const user = {
        id: "33333333-4444-5555-6666-777777777777",
        email: "native.user@lccbonline.edu.ph",
        role: "student",
        password_hash: hash,
        failed_login_attempts: 0,
      };

      stub(userModel, "getUserAuthByIdentifier", async (id) => {
        if (id === user.email) return user;
        return null;
      });
      stub(userModel, "isLocked", async () => false);
      stub(userModel, "resetFailedLogins", async () => {});
      stub(mfaService, "hasVerifiedTotp", async () => false);
      stub(mfaService, "recordLogin", async () => {});
      stub(accountService, "enforceSessionCap", async () => {});

      const res = await request(app)
        .post("/api/auth/login")
        .send({ identifier: user.email, password });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.access_token);
      assert.ok(res.body.refresh_token);

      // Verify the token is a valid native token
      const claims = nativeAuth.verifyAccessToken(res.body.access_token);
      assert.strictEqual(claims.id, user.id);
      assert.strictEqual(claims.email, user.email);
    });

    it("rejects incorrect native password", async () => {
      const password = "ValidPassword123!";
      const hash = await bcrypt.hash(password, 10);
      const user = {
        id: "44444444-5555-6666-7777-888888888888",
        email: "wrong.pass@lccbonline.edu.ph",
        role: "student",
        password_hash: hash,
        failed_login_attempts: 0,
      };

      stub(userModel, "getUserAuthByIdentifier", async () => user);
      stub(userModel, "isLocked", async () => false);
      stub(userModel, "incrementFailedLogins", async () => 1);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ identifier: user.email, password: "IncorrectPassword!" });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.error, "Invalid email, student ID, or password");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("issues fresh tokens with a valid refresh token", async () => {
      const user = {
        id: "55555555-6666-7777-8888-999999999999",
        email: "refresh.user@lccbonline.edu.ph",
        role: "student",
      };

      stub(userModel, "getUserById", async (id) => (id === user.id ? user : null));
      stub(userModel, "isLocked", async () => false);

      const initial = await nativeAuth.signTokens(user);
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refresh_token: initial.refresh_token });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.access_token);
      assert.ok(res.body.refresh_token);

      const verified = nativeAuth.verifyAccessToken(res.body.access_token);
      assert.strictEqual(verified.id, user.id);
    });

    it("rejects invalid refresh tokens", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refresh_token: "invalid-token" });

      assert.strictEqual(res.status, 401);
    });

    it("rotates refresh token and rejects reuse of old refresh token", async () => {
      const user = {
        id: "77777777-8888-9999-0000-111111111111",
        email: "rotate.user@lccbonline.edu.ph",
        role: "student",
      };

      stub(userModel, "getUserById", async (id) => (id === user.id ? user : null));
      stub(userModel, "isLocked", async () => false);

      const initial = await nativeAuth.signTokens(user);

      // First refresh succeeds and rotates
      const res1 = await request(app)
        .post("/api/auth/refresh")
        .send({ refresh_token: initial.refresh_token });

      assert.strictEqual(res1.status, 200);
      assert.ok(res1.body.access_token);
      assert.ok(res1.body.refresh_token);

      // Replay attempt with old refresh token should be rejected (revoked)
      const res2 = await request(app)
        .post("/api/auth/refresh")
        .send({ refresh_token: initial.refresh_token });

      assert.strictEqual(res2.status, 401);
    });
  });
});
