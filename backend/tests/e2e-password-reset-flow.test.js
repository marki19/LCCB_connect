// Password reset contract: request -> verify.
//
// The password reset flow stores a pending row (code hash), emails a code,
// and updates the user's password in Supabase Auth via admin client once verified.
// Every request endpoint answers identically whether or not the address is
// registered, so it cannot be used to enumerate accounts.
//
// Supabase Auth, the models, and the email service are stubbed.
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const passwordResetModel = require("../models/passwordResetModel");
const emailService = require("../services/emailService");
const supabaseAdmin = require("../services/supabaseAdmin");
const { hashOtp } = require("../utils/otp");

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REGISTERED_EMAIL = "student.reset@lccbonline.edu.ph";
const UNREGISTERED_EMAIL = "nobody.reset@lccbonline.edu.ph";
const NON_LCCB_EMAIL = "attacker@gmail.com";
const CODE = "654321";
const NEW_PASSWORD = "BrandNewPassword123";

let updateUserByIdImpl;

stub(supabaseAdmin, "getSupabaseAdmin", () => ({
  auth: {
    admin: {
      updateUserById: async (userId, data) => updateUserByIdImpl(userId, data),
    },
  },
}));

const getProfileByEmail = stub(passwordResetModel, "getProfileByEmail", async () => null);
const createPasswordReset = stub(passwordResetModel, "createPasswordReset", async (row) => row);
const getPasswordResetByEmail = stub(passwordResetModel, "getPasswordResetByEmail", async () => null);
const markPasswordResetUsed = stub(passwordResetModel, "markPasswordResetUsed", async () => ({ email: REGISTERED_EMAIL }));
const deletePasswordReset = stub(passwordResetModel, "deletePasswordReset", async () => ({ email: REGISTERED_EMAIL }));
const incrementPasswordResetAttempts = stub(passwordResetModel, "incrementPasswordResetAttempts", async () => 1);
const updateUserPassword = stub(passwordResetModel, "updateUserPassword", async (userId, pwd) => {
  const supabase = supabaseAdmin.getSupabaseAdmin();
  const { error } = await supabase.auth.admin.updateUserById(userId, { password: pwd });
  if (error) throw error;
  return true;
});

const sendPasswordResetOtpEmail = stub(emailService, "sendPasswordResetOtpEmail", async () => ({ dev: true }));

// Imported only after stubs are installed.
const app = require("../app");

function resetRow(email, code = CODE, overrides = {}) {
  return {
    id: "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr",
    user_id: USER_ID,
    email,
    otp_hash: hashOtp(email, code),
    otp_attempts: 0,
    otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    used_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  updateUserByIdImpl = async () => ({ data: { user: { id: USER_ID } }, error: null });

  getProfileByEmail.setImpl(async () => null);
  getPasswordResetByEmail.setImpl(async () => null);
  incrementPasswordResetAttempts.setImpl(async () => 1);

  for (const fn of [
    createPasswordReset,
    markPasswordResetUsed,
    deletePasswordReset,
    incrementPasswordResetAttempts,
    sendPasswordResetOtpEmail,
  ]) {
    fn.calls.length = 0;
  }
});

describe("POST /api/auth/request-password-reset", () => {
  it("stores a reset row and emails a code for a registered user, returning 202", async () => {
    getProfileByEmail.setImpl(async () => ({ id: USER_ID, email: REGISTERED_EMAIL, full_name: "John Doe" }));

    const res = await request(app)
      .post("/api/auth/request-password-reset")
      .send({ email: REGISTERED_EMAIL });

    assert.equal(res.status, 202);
    assert.match(res.body.message, /if that address is registered/i);

    assert.equal(createPasswordReset.calls.length, 1);
    const stored = createPasswordReset.calls[0][0];
    assert.equal(stored.email, REGISTERED_EMAIL);
    assert.equal(stored.userId, USER_ID);
    assert.match(stored.otpHash, /^[a-f0-9]{64}$/);

    assert.equal(sendPasswordResetOtpEmail.calls.length, 1);
    const mailed = sendPasswordResetOtpEmail.calls[0][0];
    assert.equal(mailed.to, REGISTERED_EMAIL);
    assert.equal(mailed.fullName, "John Doe");
    assert.equal(stored.otpHash, hashOtp(REGISTERED_EMAIL, mailed.otpCode));
  });

  it("answers 202 for an unregistered email and sends a code email anyway (anti-enumeration)", async () => {
    getProfileByEmail.setImpl(async () => null);

    const res = await request(app)
      .post("/api/auth/request-password-reset")
      .send({ email: UNREGISTERED_EMAIL });

    assert.equal(res.status, 202);
    assert.equal(createPasswordReset.calls.length, 1);
    const stored = createPasswordReset.calls[0][0];
    assert.equal(stored.userId, null);

    assert.equal(sendPasswordResetOtpEmail.calls.length, 1);
  });

  it("returns identical response for registered and unregistered addresses", async () => {
    getProfileByEmail.setImpl(async () => ({ id: USER_ID, email: REGISTERED_EMAIL, full_name: "John Doe" }));
    const registered = await request(app)
      .post("/api/auth/request-password-reset")
      .send({ email: REGISTERED_EMAIL });

    getProfileByEmail.setImpl(async () => null);
    const unregistered = await request(app)
      .post("/api/auth/request-password-reset")
      .send({ email: UNREGISTERED_EMAIL });

    assert.equal(registered.status, unregistered.status);
    assert.deepEqual(registered.body, unregistered.body);
  });

  it("rejects non-LCCB domain with 400", async () => {
    const res = await request(app)
      .post("/api/auth/request-password-reset")
      .send({ email: NON_LCCB_EMAIL });

    assert.equal(res.status, 400);
    assert.equal(createPasswordReset.calls.length, 0);
  });
});

describe("POST /api/auth/verify-password-reset", () => {
  it("updates password via admin client and returns 200 on valid code", async () => {
    getPasswordResetByEmail.setImpl(async () => resetRow(REGISTERED_EMAIL));

    const res = await request(app)
      .post("/api/auth/verify-password-reset")
      .send({ email: REGISTERED_EMAIL, token: CODE, password: NEW_PASSWORD });

    assert.equal(res.status, 200);
    assert.match(res.body.message, /password updated/i);

    assert.equal(markPasswordResetUsed.calls.length, 1);
  });

  it("answers failure for invalid code, expired row, or already used row", async () => {
    // 1. Bad code
    getPasswordResetByEmail.setImpl(async () => resetRow(REGISTERED_EMAIL));
    const badCode = await request(app)
      .post("/api/auth/verify-password-reset")
      .send({ email: REGISTERED_EMAIL, token: "000000", password: NEW_PASSWORD });

    // 2. Expired row
    getPasswordResetByEmail.setImpl(async () =>
      resetRow(REGISTERED_EMAIL, CODE, { otp_expires_at: new Date(Date.now() - 1000).toISOString() })
    );
    const expired = await request(app)
      .post("/api/auth/verify-password-reset")
      .send({ email: REGISTERED_EMAIL, token: CODE, password: NEW_PASSWORD });

    // 3. Already used
    getPasswordResetByEmail.setImpl(async () =>
      resetRow(REGISTERED_EMAIL, CODE, { used_at: new Date().toISOString() })
    );
    const used = await request(app)
      .post("/api/auth/verify-password-reset")
      .send({ email: REGISTERED_EMAIL, token: CODE, password: NEW_PASSWORD });

    for (const res of [badCode, expired, used]) {
      assert.equal(res.status, 401);
      assert.equal(res.body.code, "code_invalid");
    }
  });

  it("burns the row at MAX_OTP_ATTEMPTS", async () => {
    getPasswordResetByEmail.setImpl(async () => resetRow(REGISTERED_EMAIL));
    incrementPasswordResetAttempts.setImpl(async () => 5);

    await request(app)
      .post("/api/auth/verify-password-reset")
      .send({ email: REGISTERED_EMAIL, token: "000000", password: NEW_PASSWORD });

    assert.equal(incrementPasswordResetAttempts.calls.length, 1);
    assert.equal(deletePasswordReset.calls.length, 1);
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/auth/verify-password-reset")
      .send({ email: REGISTERED_EMAIL, token: CODE, password: "short" });

    assert.equal(res.status, 400);
    assert.equal(res.body.fields?.[0]?.path, "password");
  });
});