// E2E test for signup flow: OTP verification creates profile, returns session,
// and sets up proper state for onboarding and subsequent login.
//
// Covers: verify-signup endpoint, resend-signup endpoint, request-signup endpoint,
// profile creation, and error mapping for expired/used/invalid OTPs.
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const userModel = require("../models/userModel");
const accountService = require("../services/accountService");
const supabaseAdmin = require("../services/supabaseAdmin");

const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SESSION = { access_token: "at-e2e", refresh_token: "rt-e2e", expires_at: 456 };

// Valid email without @ in the local part (regex: ^[^\s@]+@lccbonline\.edu\.ph$)
const TEST_EMAIL = "e2e-user@lccbonline.edu.ph";
const EXPIRED_EMAIL = "expired_user@lccbonline.edu.ph";
const USED_EMAIL = "used_user@lccbonline.edu.ph";
const INVALID_EMAIL = "invalid_user@lccbonline.edu.ph";
const NON_LCCB_EMAIL = "notlccb@gmail.com";
const RESEND_EMAIL = "resend_user@lccbonline.edu.ph";

// Behavior is swapped per test through these bindings.
let signInImpl;
let verifyOtpImpl;
let resendImpl;
let listUsersImpl;
let createUserAuthImpl;
let currentUserMetadata;

const getSupabaseAdminStub = stub(supabaseAdmin, "getSupabaseAdmin", () => ({
  auth: {
    signInWithPassword: async (args) => {
      return signInImpl(args);
    },
    verifyOtp: async (args) => verifyOtpImpl(args),
    resend: async (args) => resendImpl(args),
    admin: {
      listUsers: async () => listUsersImpl(),
      createUser: async (args) => createUserAuthImpl(args),
    },
  },
}));

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

const okVerifyOtp = (email) => ({
  data: {
    user: {
      id: USER_ID,
      email,
      user_metadata: currentUserMetadata || { full_name: "E2E Test User" },
    },
    session: SESSION,
  },
  error: null,
});

const okResend = () => ({
  data: { user: { id: USER_ID } },
  error: null,
});

beforeEach(() => {
  signInImpl = async () => ({ data: { user: null, session: null } });
  verifyOtpImpl = async () => okVerifyOtp(TEST_EMAIL);
  resendImpl = async () => okResend();
  listUsersImpl = async () => ({ data: { users: [] }, error: null });
  createUserAuthImpl = async (args) => ({
    data: { user: { id: USER_ID, email: args.email } },
    error: null,
  });
  currentUserMetadata = { full_name: "E2E Test User" };
  createUser.calls.length = 0;
  revokeSessions.calls.length = 0;
});

describe("POST /api/auth/verify-signup (E2E)", () => {
  it("creates a student profile on successful OTP verification", async () => {
    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: TEST_EMAIL, token: "123456" });

    assert.equal(res.status, 201, "Should return 201 for successful verification");
    assert.equal(res.body.access_token, SESSION.access_token);
    assert.equal(res.body.refresh_token, SESSION.refresh_token);

    assert.equal(createUser.calls.length, 1, "Profile must be created exactly once");
    const created = createUser.calls[0][0];
    assert.equal(created.id, USER_ID);
    assert.equal(created.email, TEST_EMAIL);
    assert.equal(created.role, "student", "Role must be student, never from request");
    assert.equal(created.full_name, "E2E Test User", "Name comes from user_metadata");
  });

  it("returns code_expired for expired OTP", async () => {
    verifyOtpImpl = async () => ({
      data: { user: null, session: null },
      error: { message: "Token has expired" },
    });

    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: EXPIRED_EMAIL, token: "999999" });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "code_expired");
    assert.match(res.body.error, /expired|invalid/i);
    assert.equal(createUser.calls.length, 0, "No profile created for failed verification");
  });

  it("returns code_used for already-used OTP", async () => {
    verifyOtpImpl = async () => ({
      data: { user: null, session: null },
      error: { message: "OTP already used" },
    });

    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: USED_EMAIL, token: "111111" });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "code_used");
    assert.equal(createUser.calls.length, 0);
  });

  it("returns code_invalid for incorrect OTP", async () => {
    verifyOtpImpl = async () => ({
      data: { user: null, session: null },
      error: { message: "Invalid OTP" },
    });

    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: INVALID_EMAIL, token: "000000" });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "code_invalid");
    assert.equal(createUser.calls.length, 0);
  });

  it("rejects non-LCCB email with 400 validation error", async () => {
    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: NON_LCCB_EMAIL, token: "123456" });

    assert.equal(res.status, 400);
    assert.equal(res.body.fields?.[0]?.path, "email");
    assert.equal(createUser.calls.length, 0);
  });

  it("rejects token that is not 6 digits", async () => {
    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: TEST_EMAIL, token: "12345" });

    assert.equal(res.status, 400);
  });

  it("returns 401 with generic error for unknown OTP error", async () => {
    verifyOtpImpl = async () => ({
      data: { user: null, session: null },
      error: { message: "Some other error" },
    });

    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: INVALID_EMAIL, token: "123456" });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "invalid_code");
    assert.equal(createUser.calls.length, 0);
  });
});

describe("POST /api/auth/resend-signup (E2E)", () => {
  it("triggers OTP resend and returns 202 with retry_after", async () => {
    const res = await request(app)
      .post("/api/auth/resend-signup")
      .send({ email: RESEND_EMAIL });

    assert.equal(res.status, 202);
    assert.equal(res.body.message, "Code sent");
    assert.ok(res.body.retry_after > 0, "Should include retry_after seconds");
  });

  it("rejects non-LCCB email with 400", async () => {
    const res = await request(app)
      .post("/api/auth/resend-signup")
      .send({ email: NON_LCCB_EMAIL });

    assert.equal(res.status, 400);
  });

  it("handles Supabase resend failure gracefully", async () => {
    resendImpl = async () => ({
      data: {},
      error: { message: "User not found" },
    });

    const res = await request(app)
      .post("/api/auth/resend-signup")
      .send({ email: "noseresend@lccbonline.edu.ph" });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "resend_failed");
  });
});

describe("POST /api/auth/request-signup (E2E)", () => {
  const REQUEST_SIGNUP_EMAIL = "request_user@lccbonline.edu.ph";
  const REQUEST_EXISTS_EMAIL = "exists_user@lccbonline.edu.ph";
  const REQUEST_SIGNUP_EMAIL_2 = "request_user2@lccbonline.edu.ph";
  const REQUEST_SIGNUP_EMAIL_3 = "request_user3@lccbonline.edu.ph";
  const REQUEST_SIGNUP_EMAIL_4 = "request_user4@lccbonline.edu.ph";
  const REQUEST_SIGNUP_EMAIL_5 = "request_user5@lccbonline.edu.ph";
  const REQUEST_SIGNUP_EMAIL_6 = "request_user6@lccbonline.edu.ph";
  const REQUEST_SIGNUP_EMAIL_7 = "request_user7@lccbonline.edu.ph";

  beforeEach(() => {
    listUsersImpl = async () => ({ data: { users: [] }, error: null });
    createUserAuthImpl = async (args) => ({
      data: { user: { id: USER_ID, email: args.email } },
      error: null,
    });
  });

  it("creates Auth user and sends OTP, returns 202", async () => {
    const res = await request(app)
      .post("/api/auth/request-signup")
      .send({
        email: REQUEST_SIGNUP_EMAIL,
        password: "SecurePass123",
        full_name: "Test User",
      });

    assert.equal(res.status, 202);
    assert.equal(res.body.message, "Account created. Check your email for the verification code.");
    assert.ok(res.body.retry_after > 0, "Should include retry_after seconds");
  });

  it("rejects non-LCCB email with 400 validation error", async () => {
    const res = await request(app)
      .post("/api/auth/request-signup")
      .send({
        email: NON_LCCB_EMAIL,
        password: "SecurePass123",
        full_name: "Test User",
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.fields?.[0]?.path, "email");
  });

  it("rejects password shorter than 8 chars with 400", async () => {
    const res = await request(app)
      .post("/api/auth/request-signup")
      .send({
        email: REQUEST_SIGNUP_EMAIL_2,
        password: "short",
        full_name: "Test User",
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.fields?.[0]?.path, "password");
  });

  it("rejects full_name shorter than 2 chars with 400", async () => {
    const res = await request(app)
      .post("/api/auth/request-signup")
      .send({
        email: REQUEST_SIGNUP_EMAIL_3,
        password: "SecurePass123",
        full_name: "A",
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.fields?.[0]?.path, "full_name");
  });

  it("returns account_exists (409) when email already registered", async () => {
    listUsersImpl = async () => ({
      data: { users: [{ email: REQUEST_EXISTS_EMAIL }] },
      error: null,
    });

    const res = await request(app)
      .post("/api/auth/request-signup")
      .send({
        email: REQUEST_EXISTS_EMAIL,
        password: "SecurePass123",
        full_name: "Test User",
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.code, "account_exists");
  });

  it("handles Supabase createUser failure gracefully", async () => {
    createUserAuthImpl = async () => ({
      data: { user: null },
      error: { message: "Weak password" },
    });

    const res = await request(app)
      .post("/api/auth/request-signup")
      .send({
        email: REQUEST_SIGNUP_EMAIL_4,
        password: "WeakPass123", // valid length but Supabase rejects it
        full_name: "Test User",
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "creation_failed");
  });

  it("handles listUsers failure with service_unavailable", async () => {
    listUsersImpl = async () => ({
      data: { users: [] },
      error: { message: "DB error" },
    });

    const res = await request(app)
      .post("/api/auth/request-signup")
      .send({
        email: REQUEST_SIGNUP_EMAIL_5,
        password: "SecurePass123",
        full_name: "Test User",
      });

    assert.equal(res.status, 503);
    assert.equal(res.body.code, "service_unavailable");
  });
});