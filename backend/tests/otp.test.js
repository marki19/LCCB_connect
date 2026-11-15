const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

require("./env.helper");

const { generateOtp, hashOtp, verifyOtpHash, OTP_LENGTH, MAX_OTP_ATTEMPTS } = require("../utils/otp");

describe("generateOtp", () => {
  it("always produces a 6-digit zero-padded string", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateOtp();
      assert.match(code, /^\d{6}$/);
      assert.equal(code.length, OTP_LENGTH);
    }
  });
});

describe("hashOtp", () => {
  it("is stable for the same email and code", () => {
    assert.equal(hashOtp("a@lccbonline.edu.ph", "123456"), hashOtp("a@lccbonline.edu.ph", "123456"));
  });

  it("normalizes the email case", () => {
    assert.equal(hashOtp("A@LCCBonlINE.edu.ph", "123456"), hashOtp("a@lccbonline.edu.ph", "123456"));
  });

  it("changes with the code and with the email", () => {
    const base = hashOtp("a@lccbonline.edu.ph", "123456");
    assert.notEqual(base, hashOtp("a@lccbonline.edu.ph", "123457"));
    assert.notEqual(base, hashOtp("b@lccbonline.edu.ph", "123456"));
  });

  it("never returns the code itself", () => {
    assert.notEqual(hashOtp("a@lccbonline.edu.ph", "123456"), "123456");
    assert.match(hashOtp("a@lccbonline.edu.ph", "123456"), /^[a-f0-9]{64}$/);
  });
});

describe("verifyOtpHash", () => {
  const email = "a@lccbonline.edu.ph";
  const hash = hashOtp(email, "123456");

  it("accepts the matching code", () => {
    assert.equal(verifyOtpHash(email, "123456", hash), true);
  });

  it("rejects a different code", () => {
    assert.equal(verifyOtpHash(email, "654321", hash), false);
  });

  it("rejects a code presented for a different address", () => {
    assert.equal(verifyOtpHash("b@lccbonline.edu.ph", "123456", hash), false);
  });

  it("rejects malformed input without throwing", () => {
    assert.equal(verifyOtpHash(email, "12345", hash), false);
    assert.equal(verifyOtpHash(email, "abcdef", hash), false);
    assert.equal(verifyOtpHash(email, undefined, hash), false);
    assert.equal(verifyOtpHash(email, "123456", null), false);
    assert.equal(verifyOtpHash(email, "123456", "not-a-hash"), false);
  });
});

describe("OTP policy", () => {
  it("caps guesses at five", () => {
    assert.equal(MAX_OTP_ATTEMPTS, 5);
  });
});
