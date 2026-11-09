const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const {
  encryptTotpSecret,
  decryptTotpSecret,
  verifyTotpTimingSafe,
  hotp,
  base32ToBuffer,
  timingSafeEqual,
} = require("../utils/totpEncryption");

const originalEnv = process.env.TOTP_SECRET_KEY;

describe("totpEncryption", () => {
  before(() => {
    // Set a test key
    process.env.TOTP_SECRET_KEY = "test-totp-secret-key-32-bytes-long!!";
  });

  after(() => {
    process.env.TOTP_SECRET_KEY = originalEnv;
  });

  describe("encryptTotpSecret / decryptTotpSecret", () => {
    test("round-trip encrypt/decrypt preserves secret", () => {
      const secret = "JBSWY3DPEHPK3PXP"; // base32 "Hello!"
      const encrypted = encryptTotpSecret(secret);
      const decrypted = decryptTotpSecret(encrypted);
      assert.strictEqual(decrypted, secret);
    });

    test("different ciphertext each time (random IV)", () => {
      const secret = "JBSWY3DPEHPK3PXP";
      const enc1 = encryptTotpSecret(secret);
      const enc2 = encryptTotpSecret(secret);
      assert.notStrictEqual(enc1.ciphertext, enc2.ciphertext);
      assert.notStrictEqual(enc1.iv, enc2.iv);
      assert.notStrictEqual(enc1.tag, enc2.tag);
    });

    test("decrypt with wrong key fails", () => {
      const secret = "JBSWY3DPEHPK3PXP";
      const encrypted = encryptTotpSecret(secret);
      
      // Temporarily change the key
      const originalKey = process.env.TOTP_SECRET_KEY;
      process.env.TOTP_SECRET_KEY = "different-key-that-is-32-bytes!!";
      // Clear cache to force re-derivation
      require("../utils/totpEncryption").clearKeyCache();
      
      assert.throws(() => decryptTotpSecret(encrypted));
      
      process.env.TOTP_SECRET_KEY = originalKey;
      require("../utils/totpEncryption").clearKeyCache();
    });

    test("decrypt with tampered ciphertext fails", () => {
      const secret = "JBSWY3DPEHPK3PXP";
      const encrypted = encryptTotpSecret(secret);
      
      // Tamper with ciphertext
      const tampered = { ...encrypted, ciphertext: "YWJjZGVmZ2hpamtsbW5vcA==" };
      
      assert.throws(() => decryptTotpSecret(tampered));
    });

    test("decrypt with tampered tag fails", () => {
      const secret = "JBSWY3DPEHPK3PXP";
      const encrypted = encryptTotpSecret(secret);
      
      // Tamper with tag
      const tampered = { ...encrypted, tag: "YWJjZGVmZ2hpamtsbW5vcA==" };
      
      assert.throws(() => decryptTotpSecret(tampered));
    });
  });

  describe("verifyTotpTimingSafe", () => {
    const secret = "JBSWY3DPEHPK3PXP"; // base32 for "Hello!"
    const decoded = base32ToBuffer(secret);
    
    // Get the current counter step
    const period = 30;
    const now = Math.floor(Date.now() / 1000 / period);
    
    test("valid code at current step returns valid=true", () => {
      const token = hotp(decoded, now);
      const result = verifyTotpTimingSafe(secret, token, null);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.currentStep, now);
      assert.strictEqual(result.isReplay, false);
    });

    test("valid code at +1 step returns valid=true (clock drift)", () => {
      const token = hotp(decoded, now + 1);
      const result = verifyTotpTimingSafe(secret, token, null);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.currentStep, now + 1);
    });

    test("valid code at -1 step returns valid=true (clock drift)", () => {
      const token = hotp(decoded, now - 1);
      const result = verifyTotpTimingSafe(secret, token, null);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.currentStep, now - 1);
    });

    test("invalid code returns valid=false", () => {
      const result = verifyTotpTimingSafe(secret, "000000", null);
      assert.strictEqual(result.valid, false);
    });

    test("replay detection: same step returns isReplay=true", () => {
      const token = hotp(decoded, now);
      const result = verifyTotpTimingSafe(secret, token, now);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.isReplay, true);
    });

    test("replay detection: earlier step returns isReplay=true", () => {
      const token = hotp(decoded, now - 1);
      const result = verifyTotpTimingSafe(secret, token, now);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.isReplay, true);
    });

    test("replay detection: later step returns isReplay=false", () => {
      const token = hotp(decoded, now + 1);
      const result = verifyTotpTimingSafe(secret, token, now);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.isReplay, false);
    });

    test("null lastUsedStep never triggers replay", () => {
      const token = hotp(decoded, now);
      const result = verifyTotpTimingSafe(secret, token, null);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.isReplay, false);
    });

    test("handles missing secret/token gracefully", () => {
      assert.strictEqual(verifyTotpTimingSafe(null, "123456", null).valid, false);
      assert.strictEqual(verifyTotpTimingSafe(secret, null, null).valid, false);
      assert.strictEqual(verifyTotpTimingSafe("", "", null).valid, false);
    });

    test("invalid base32 secret returns invalid", () => {
      const result = verifyTotpTimingSafe("INVALID!!!", "123456", null);
      assert.strictEqual(result.valid, false);
    });
  });

  describe("timingSafeEqual", () => {
    test("equal strings return true", () => {
      assert.strictEqual(timingSafeEqual("abc", "abc"), true);
    });

    test("different strings return false", () => {
      assert.strictEqual(timingSafeEqual("abc", "abd"), false);
    });

    test("different lengths return false (no timing leak)", () => {
      assert.strictEqual(timingSafeEqual("abc", "abcd"), false);
    });

    test("empty strings return true", () => {
      assert.strictEqual(timingSafeEqual("", ""), true);
    });
  });
});