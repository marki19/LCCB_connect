// Signup contract: request -> verify -> session.
//
// The signup flow stores a pending row (password + code hash), emails a code,
// and only creates the Auth user and profile once that code is verified. Every
// signup endpoint answers identically whether or not the address is already
// registered, so none of them can be used to enumerate accounts.
//
// Supabase Auth, the models, and the email service are stubbed, so this asserts
// the HTTP contract without a database or network.
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const userModel = require("../models/userModel");
const emailService = require("../services/emailService");
const supabaseAdmin = require("../services/supabaseAdmin");
const { hashOtp } = require("../utils/otp");
const bcrypt = require("bcrypt");

const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SESSION = { access_token: "at-e2e", refresh_token: "rt-e2e", expires_at: 456 };

const NEW_EMAIL = "new.student@lccbonline.edu.ph";
const EXISTING_EMAIL = "existing.student@lccbonline.edu.ph";
const NON_LCCB_EMAIL = "notlccb@gmail.com";
const CODE = "123456";
const PENDING_PASSWORD = "SecurePass123";
// Cost 4 keeps the fixture fast; the endpoint is what hashes at cost 12.
const PENDING_PASSWORD_HASH = bcrypt.hashSync(PENDING_PASSWORD, 4);

let createUserAuthImpl;
let emailImpl;

stub(supabaseAdmin, "getSupabaseAdmin", () => ({
  auth: {
    signInWithPassword: async () => ({ data: { session: SESSION }, error: null }),
    admin: {
      createUser: async (args) => createUserAuthImpl(args),
    },
  },
}));

const findProfileIdByEmail = stub(userModel, "findProfileIdByEmail", async () => null);
const getPendingSignupByEmail = stub(userModel, "getPendingSignupByEmail", async () => null);
const createPendingSignup = stub(userModel, "createPendingSignup", async (row) => row);
const deletePendingSignup = stub(userModel, "deletePendingSignup", async () => ({ email: NEW_EMAIL }));
const incrementOtpAttempts = stub(userModel, "incrementOtpAttempts", async () => 1);
const createUser = stub(userModel, "createUser", async (data) => ({
  id: data.id,
  role: "student",
  ...data,
}));

const sendOtpEmail = stub(emailService, "sendOtpEmail", async (args) => {
  emailImpl(args);
  return { dev: true };
});
const sendAccountExistsEmail = stub(emailService, "sendAccountExistsEmail", async () => ({ dev: true }));

// Imported only after the stubs are installed.
const app = require("../app");

/** A fresh pending row carrying the hash the endpoint will verify. */
function pendingRow(email, code = CODE, overrides = {}) {
  return {
    email,
    password_hash: PENDING_PASSWORD_HASH,
    full_name: "Ana Cruz",
    otp_hash: hashOtp(email, code),
    otp_attempts: 0,
    otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    verified_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  createUserAuthImpl = async (args) => ({
    data: { user: { id: USER_ID, email: args.email } },
    error: null,
  });
  emailImpl = () => {};
  findProfileIdByEmail.setImpl(async () => null);
  getPendingSignupByEmail.setImpl(async () => null);
  incrementOtpAttempts.setImpl(async () => 1);

  for (const fn of [
    createUser,
    deletePendingSignup,
    createPendingSignup,
    incrementOtpAttempts,
    sendOtpEmail,
    sendAccountExistsEmail,
  ]) {
    fn.calls.length = 0;
  }
});

describe("POST /api/auth/request-signup", () => {
  it("stores a pending row with only a hash of the code and returns 202", async () => {
    const res = await request(app)
      .post("/api/auth/request-signup")
      .send({ email: NEW_EMAIL, password: "SecurePass123", full_name: "Ana Cruz" });

    assert.equal(res.status, 202);
    assert.match(res.body.message, /if that address can be registered/i);
    assert.ok(res.body.retry_after > 0);

    assert.equal(createPendingSignup.calls.length, 1);
    const stored = createPendingSignup.calls[0][0];
    assert.equal(stored.email, NEW_EMAIL);
    assert.equal(stored.fullName, "Ana Cruz");
    assert.notEqual(stored.otpHash, CODE, "the code itself is never stored");
    assert.match(stored.otpHash, /^[a-f0-9]{64}$/, "stored value is an HMAC");

    assert.equal(sendOtpEmail.calls.length, 1);
    const mailed = sendOtpEmail.calls[0][0];
    assert.match(mailed.otpCode, /^\d{6}$/);
    assert.equal(stored.otpHash, hashOtp(NEW_EMAIL, mailed.otpCode), "hash matches the mailed code");
  });

  it("answers 202 for an existing account and sends no code", async () => {
    findProfileIdByEmail.setImpl(async () => ({ id: USER_ID, role: "student" }));

    const res = await request(app)
      .post("/api/auth/request-signup")
      .send({ email: EXISTING_EMAIL, password: "SecurePass123", full_name: "Ana Cruz" });

    assert.equal(res.status, 202);
    assert.equal(createPendingSignup.calls.length, 0, "no pending row for an existing account");
    assert.equal(sendOtpEmail.calls.length, 0);
    assert.equal(sendAccountExistsEmail.calls.length, 1);
    assert.equal(sendAccountExistsEmail.calls[0][0].to, EXISTING_EMAIL);
  });

  it("returns the same body for a new and an existing address", async () => {
    const fresh = await request(app)
      .post("/api/auth/request-signup")
      .send({ email: NEW_EMAIL, password: "SecurePass123", full_name: "Ana Cruz" });

    findProfileIdByEmail.setImpl(async () => ({ id: USER_ID, role: "student" }));
    const existing = await request(app)
      .post("/api/auth/request-signup")
      .send({ email: EXISTING_EMAIL, password: "SecurePass123", full_name: "Ana Cruz" });

    assert.equal(fresh.status, existing.status);
    assert.deepEqual(fresh.body, existing.body);
  });

  it("rejects a non-LCCB email with 400", async () => {
    const res = await request(app)
      .post("/api/auth/request-signup")
      .send({ email: NON_LCCB_EMAIL, password: "SecurePass123", full_name: "Ana Cruz" });

    assert.equal(res.status, 400);
    assert.equal(res.body.fields?.[0]?.path, "email");
    assert.equal(createPendingSignup.calls.length, 0);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/auth/request-signup")
      .send({ email: NEW_EMAIL, password: "short", full_name: "Ana Cruz" });

    assert.equal(res.status, 400);
    assert.equal(res.body.fields?.[0]?.path, "password");
  });

  it("rejects a full name shorter than 2 characters", async () => {
    const res = await request(app)
      .post("/api/auth/request-signup")
      .send({ email: NEW_EMAIL, password: "SecurePass123", full_name: "A" });

    assert.equal(res.status, 400);
    assert.equal(res.body.fields?.[0]?.path, "full_name");
  });
});

describe("POST /api/auth/verify-signup", () => {
  it("creates the profile and returns a session for a valid code", async () => {
    getPendingSignupByEmail.setImpl(async () => pendingRow(NEW_EMAIL));

    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: NEW_EMAIL, token: CODE, password: PENDING_PASSWORD });

    assert.equal(res.status, 201);
    assert.equal(res.body.access_token, SESSION.access_token);
    assert.equal(res.body.refresh_token, SESSION.refresh_token);

    assert.equal(createUser.calls.length, 1);
    const created = createUser.calls[0][0];
    assert.equal(created.id, USER_ID);
    assert.equal(created.email, NEW_EMAIL);
    assert.equal(created.role, "student", "role never comes from the request");
    assert.equal(created.full_name, "Ana Cruz", "name comes from the pending row");

    assert.equal(deletePendingSignup.calls.length, 1, "pending row is cleaned up");
  });

  it("answers every failure identically", async () => {
    const wrongCode = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: NEW_EMAIL, token: "999999", password: PENDING_PASSWORD });

    getPendingSignupByEmail.setImpl(async () => pendingRow(NEW_EMAIL));
    const wrongCodeWithRow = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: NEW_EMAIL, token: "999999", password: PENDING_PASSWORD });

    getPendingSignupByEmail.setImpl(async () => pendingRow(NEW_EMAIL, CODE, { verified_at: new Date().toISOString() }));
    const alreadyUsed = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: NEW_EMAIL, token: CODE, password: PENDING_PASSWORD });

    getPendingSignupByEmail.setImpl(async () =>
      pendingRow(NEW_EMAIL, CODE, { otp_expires_at: new Date(Date.now() - 1000).toISOString() })
    );
    const expired = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: NEW_EMAIL, token: CODE, password: PENDING_PASSWORD });

    for (const res of [wrongCode, wrongCodeWithRow, alreadyUsed, expired]) {
      assert.equal(res.status, 401);
      assert.equal(res.body.code, "code_invalid");
      assert.match(res.body.error, /incorrect or has expired/i);
    }
    assert.equal(createUser.calls.length, 0, "no profile for any failure");
  });

  it("counts a wrong guess and burns the row at the cap", async () => {
    getPendingSignupByEmail.setImpl(async () => pendingRow(NEW_EMAIL));

    await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: NEW_EMAIL, token: "999999", password: PENDING_PASSWORD });

    assert.equal(incrementOtpAttempts.calls.length, 1);
    assert.equal(deletePendingSignup.calls.length, 0, "record survives a single miss");

    incrementOtpAttempts.setImpl(async () => 5);
    await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: NEW_EMAIL, token: "999999", password: PENDING_PASSWORD });

    assert.equal(deletePendingSignup.calls.length, 1, "record is burned at the cap");
  });

  it("rejects a non-6-digit token with 400", async () => {
    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: NEW_EMAIL, token: "12345", password: PENDING_PASSWORD });

    assert.equal(res.status, 400);
    assert.equal(createUser.calls.length, 0);
  });

  it("rejects a password that does not match the pending record", async () => {
    getPendingSignupByEmail.setImpl(async () => pendingRow(NEW_EMAIL));

    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: NEW_EMAIL, token: CODE, password: "SomeOtherPass123" });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "code_invalid", "same body as a bad code");
    assert.equal(createUser.calls.length, 0);
  });

  it("stores a bcrypt hash rather than the password", async () => {
    await request(app)
      .post("/api/auth/request-signup")
      .send({ email: NEW_EMAIL, password: PENDING_PASSWORD, full_name: "Ana Cruz" });

    const stored = createPendingSignup.calls[0][0].passwordHash;
    assert.match(stored, /^\$2[aby]\$/, "stored value is a bcrypt hash");
    assert.notEqual(stored, PENDING_PASSWORD);
  });

  it("rejects a non-LCCB email with 400", async () => {
    const res = await request(app)
      .post("/api/auth/verify-signup")
      .send({ email: NON_LCCB_EMAIL, token: CODE, password: PENDING_PASSWORD });

    assert.equal(res.status, 400);
    assert.equal(res.body.fields?.[0]?.path, "email");
  });
});

describe("POST /api/auth/resend-signup", () => {
  it("rotates the code hash and returns 202", async () => {
    getPendingSignupByEmail.setImpl(async () => pendingRow(NEW_EMAIL));

    const res = await request(app).post("/api/auth/resend-signup").send({ email: NEW_EMAIL });

    assert.equal(res.status, 202);
    assert.equal(createPendingSignup.calls.length, 1);

    const stored = createPendingSignup.calls[0][0];
    assert.equal(stored.passwordHash, PENDING_PASSWORD_HASH, "password is carried over");
    assert.match(stored.otpHash, /^[a-f0-9]{64}$/);

    const mailed = sendOtpEmail.calls[0][0].otpCode;
    assert.equal(stored.otpHash, hashOtp(NEW_EMAIL, mailed), "new hash matches the new code");
  });

  it("answers 202 when no pending signup exists", async () => {
    const res = await request(app)
      .post("/api/auth/resend-signup")
      .send({ email: "nobody@lccbonline.edu.ph" });

    assert.equal(res.status, 202);
    assert.equal(createPendingSignup.calls.length, 0);
    assert.equal(sendOtpEmail.calls.length, 0);
  });
});

describe("GET /api/auth/check-email", () => {
  it("no longer exists", async () => {
    const res = await request(app).get("/api/auth/check-email?email=someone@lccbonline.edu.ph");

    assert.equal(res.status, 404, "the enumeration endpoint was removed");
  });
});
