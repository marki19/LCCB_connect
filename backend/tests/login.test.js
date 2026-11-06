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
const supabaseAdmin = require("../services/supabaseAdmin");

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION = { access_token: "at-123", refresh_token: "rt-123", expires_at: 123 };

// Behaviour is swapped per test through these bindings.
let signInImpl;
let verifyOtpImpl;
let lastSignInEmail;

stub(supabaseAdmin, "getSupabaseAdmin", () => ({
  auth: {
    signInWithPassword: async (args) => {
      lastSignInEmail = args.email;
      return signInImpl(args);
    },
    verifyOtp: async (args) => verifyOtpImpl(args),
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
const revokeSessions = stub(accountService, "revokeSessions", async () => ({
  sessions: 0,
  refresh_tokens: 0,
}));

// Imported only after the stubs are installed.
const app = require("../app");

const okSignIn = (email) => ({
  data: {
    user: { id: USER_ID, email },
    session: SESSION,
  },
  error: null,
});

beforeEach(() => {
  signInImpl = async (args) => okSignIn(args.email);
  verifyOtpImpl = async () => ({
    data: {
      user: {
        id: USER_ID,
        email: "new.student@lccbonline.edu.ph",
        user_metadata: { full_name: "Ana Cruz" },
      },
      session: SESSION,
    },
    error: null,
  });
  getLoginEmailByStudentId.setImpl(async () => null);
  getUserById.setImpl(async () => ({ id: USER_ID, role: "student" }));
  createUser.setImpl(async (data) => ({ id: data.id, role: "student", ...data }));
  createUser.calls.length = 0;
  revokeSessions.calls.length = 0;
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
      .send({ email: "new.student@lccbonline.edu.ph", token: "123456" });

    assert.equal(res.status, 201);
    assert.equal(res.body.access_token, SESSION.access_token);

    assert.equal(createUser.calls.length, 1);
    const created = createUser.calls[0][0];
    assert.equal(created.id, USER_ID);
    assert.equal(created.role, "student", "role must never come from the caller");
    assert.equal(created.full_name, "Ana Cruz", "name comes from auth metadata");
    assert.equal(created.email, "new.student@lccbonline.edu.ph");
  });

  it("rejects a wrong or expired code without creating a profile", async () => {
    verifyOtpImpl = async () => ({
      data: { user: null, session: null },
      error: { message: "Token has expired or is invalid" },
    });

    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: "expired@lccbonline.edu.ph", token: "999999" });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "code_expired");
    assert.equal(createUser.calls.length, 0);
  });

  it("rejects a non-LCCB email address", async () => {
    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: "someone@gmail.com", token: "123456" });

    assert.equal(res.status, 400);
    assert.equal(createUser.calls.length, 0);
  });
});
