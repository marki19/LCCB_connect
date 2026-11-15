// Login and signup verification are backend-owned now: the route must refuse an
// Auth account whose profile is gone (deleted), block suspended accounts before
// tokens are issued, and create the profile during OTP verification.
//
// Supabase Auth, the models, and session revocation are stubbed, so the HTTP
// contract is asserted without a database or network.
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const userModel = require("../models/userModel");
const accountService = require("../services/accountService");
const mfaService = require("../services/mfaService");
const supabaseAdmin = require("../services/supabaseAdmin");
const bcrypt = require("bcrypt");
const { hashOtp } = require("../utils/otp");
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION = { access_token: "at-123", refresh_token: "rt-123", expires_at: 123 };

// Behaviour is swapped per test through these bindings.
let signInImpl;
let lastSignInEmail;

stub(supabaseAdmin, "getSupabaseAdmin", () => ({
  auth: {
    signInWithPassword: async (args) => {
      lastSignInEmail = args.email;
      return signInImpl(args);
    },
    admin: {
      createUser: async (args) => ({
        data: {
          user: { id: USER_ID, email: args.email },
        },
        error: null,
      }),
    },
  },
}));

const getLoginEmailByStudentId = stub(
  userModel,
  "getLoginEmailByStudentId",
  async () => null
);
const getUserById = stub(userModel, "getUserById", async () => undefined);
const createUser = stub(userModel, "createUser", async (data) => ({
  id: data.id,
  role: "student",
  ...data,
}));
const getPendingSignupByEmail = stub(
  userModel,
  "getPendingSignupByEmail",
  async () => null
);
const deletePendingSignup = stub(
  userModel,
  "deletePendingSignup",
  async () => ({ email: "test@lccbonline.edu.ph" })
);
const incrementOtpAttempts = stub(
  userModel,
  "incrementOtpAttempts",
  async () => 1
);
const revokeSessions = stub(accountService, "revokeSessions", async () => ({
  sessions: 0,
  refresh_tokens: 0,
}));
const hasVerifiedTotp = stub(mfaService, "hasVerifiedTotp", async () => false);
const getUserByEmailForLockout = stub(
  userModel,
  "getUserByEmailForLockout",
  async () => null
);
const isLocked = stub(userModel, "isLocked", async () => false);
const resetFailedLogins = stub(userModel, "resetFailedLogins", async () => {});

// Imported only after the stubs are installed.
const app = require("../app");

const okSignIn = (email) => ({
  data: {
    user: { id: USER_ID, email },
    session: SESSION,
  },
  error: null,
});

// Hash for the pending-signup fixture. Cost 4 keeps tests fast; the endpoint
// hashes at BCRYPT_COST.
const TEST_PASSWORD = "TestPass123";
const ENCRYPTED_PASSWORD = bcrypt.hashSync(TEST_PASSWORD, 4);

// Default pending signup record for successful verification. Only the HMAC of
// the code is stored, so the fixture holds the hash the endpoint will compare.
const PENDING_EMAIL = "new.student@lccbonline.edu.ph";
const defaultPendingSignup = {
  email: PENDING_EMAIL,
  password_hash: ENCRYPTED_PASSWORD,
  full_name: "Ana Cruz",
  otp_hash: hashOtp(PENDING_EMAIL, "123456"),
  otp_attempts: 0,
  otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  verified_at: null,
};

beforeEach(() => {
  signInImpl = async (args) => okSignIn(args.email);
  getLoginEmailByStudentId.setImpl(async () => null);
  getUserById.setImpl(async () => ({ id: USER_ID, role: "student" }));
  createUser.setImpl(async (data) => ({ id: data.id, role: "student", ...data }));
  getPendingSignupByEmail.setImpl(async () => defaultPendingSignup);
  deletePendingSignup.setImpl(async () => ({ email: defaultPendingSignup.email }));
  createUser.calls.length = 0;
  revokeSessions.calls.length = 0;
  deletePendingSignup.calls.length = 0;
  incrementOtpAttempts.calls.length = 0;
  hasVerifiedTotp.calls.length = 0;
  lastSignInEmail = null;
});

describe("POST /api/auth/login", () => {
  it("returns a session for an email whose profile exists", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "ana@lccbonline.edu.ph", password: "secret123" });

    assert.equal(res.status, 200);
    assert.equal(res.body.access_token, SESSION.access_token);
    assert.equal(res.body.refresh_token, SESSION.refresh_token);
    assert.equal(lastSignInEmail, "ana@lccbonline.edu.ph");
  });

  it("resolves a student ID to its account email", async () => {
    getLoginEmailByStudentId.setImpl(async () => ({
      id: USER_ID,
      email: "ana@lccbonline.edu.ph",
    }));

    const res = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "2023-00123", password: "secret123" });

    assert.equal(res.status, 200);
    assert.equal(lastSignInEmail, "ana@lccbonline.edu.ph");
    assert.equal(getLoginEmailByStudentId.calls.length, 1);
  });

  it("refuses a deleted account and revokes the fresh session", async () => {
    getUserById.setImpl(async () => undefined);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "deleted@lccbonline.edu.ph", password: "secret123" });

    assert.equal(res.status, 403);
    assert.equal(res.body.code, "account_deleted");
    assert.match(res.body.error, /deleted/i);
    assert.equal(revokeSessions.calls.length, 1);
    assert.equal(revokeSessions.calls[0][0], USER_ID);
    assert.equal(res.body.access_token, undefined);
  });

  it("refuses a suspended account before issuing tokens", async () => {
    getUserById.setImpl(async () => ({
      id: USER_ID,
      role: "student",
      suspended_at: new Date().toISOString(),
      suspended_until: new Date(Date.now() + 86_400_000).toISOString(),
      suspension_reason: "Spam",
    }));

    const res = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "suspended@lccbonline.edu.ph", password: "secret123" });

    assert.equal(res.status, 403);
    assert.equal(res.body.code, "account_suspended");
    assert.equal(res.body.reason, "Spam");
    assert.equal(res.body.access_token, undefined);
  });

  it("401s a wrong password without revealing which part failed", async () => {
    signInImpl = async () => ({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "wrong@lccbonline.edu.ph", password: "nope" });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, "Invalid email, student ID, or password");
  });
});

describe("POST /api/auth/verify-signup", () => {
  it("creates the profile during verification and returns a session", async () => {
    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: "new.student@lccbonline.edu.ph", token: "123456", password: TEST_PASSWORD });

    assert.equal(res.status, 201);
    assert.equal(res.body.access_token, SESSION.access_token);

    assert.equal(createUser.calls.length, 1);
    const created = createUser.calls[0][0];
    assert.equal(created.id, USER_ID);
    assert.equal(created.role, "student", "role must never come from the caller");
    assert.equal(created.full_name, "Ana Cruz", "name comes from pending signup");
    assert.equal(created.email, "new.student@lccbonline.edu.ph");

    assert.equal(deletePendingSignup.calls.length, 1);
  });

  it("rejects a wrong code without creating a profile", async () => {
    getPendingSignupByEmail.setImpl(async () => ({
      ...defaultPendingSignup,
      otp_hash: hashOtp(defaultPendingSignup.email, "654321"),
    }));

    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: "expired@lccbonline.edu.ph", token: "999999", password: TEST_PASSWORD });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "code_invalid");
    assert.equal(createUser.calls.length, 0);
    assert.equal(incrementOtpAttempts.calls.length, 1, "an attempt is counted");
  });

  it("drops the pending record once the attempt cap is reached", async () => {
    getPendingSignupByEmail.setImpl(async () => ({
      ...defaultPendingSignup,
      otp_hash: hashOtp(defaultPendingSignup.email, "654321"),
    }));
    incrementOtpAttempts.setImpl(async () => 5);

    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: "expired@lccbonline.edu.ph", token: "999999", password: TEST_PASSWORD });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "code_invalid");
    assert.equal(deletePendingSignup.calls.length, 1, "record is burned");
  });

  it("rejects an expired code with the same generic body", async () => {
    getPendingSignupByEmail.setImpl(async () => ({
      ...defaultPendingSignup,
      otp_expires_at: new Date(Date.now() - 1000).toISOString(), // Expired
    }));

    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: "expired@lccbonline.edu.ph", token: "123456", password: TEST_PASSWORD });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "code_invalid");
    assert.equal(createUser.calls.length, 0);
  });

  it("rejects a non-LCCB email address", async () => {
    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: "someone@gmail.com", token: "123456", password: TEST_PASSWORD });

    assert.equal(res.status, 400);
    assert.equal(createUser.calls.length, 0);
  });

  it("rejects when no pending signup exists", async () => {
    getPendingSignupByEmail.setImpl(async () => null);

    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: "none@lccbonline.edu.ph", token: "123456", password: TEST_PASSWORD });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "code_invalid");
    assert.equal(createUser.calls.length, 0);
  });

  it("rejects when pending signup already verified", async () => {
    getPendingSignupByEmail.setImpl(async () => ({
      ...defaultPendingSignup,
      verified_at: new Date().toISOString(),
    }));

    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: "verified@lccbonline.edu.ph", token: "123456", password: TEST_PASSWORD });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "code_invalid");
    assert.equal(createUser.calls.length, 0);
  });
});
