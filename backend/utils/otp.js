/**
 * One-time signup codes.
 *
 * The code is never stored. Only an HMAC of `email:code` goes to the database,
 * so a dump of `pending_signups` cannot be used to complete someone's signup.
 * The pepper is a server secret; losing it only invalidates in-flight codes.
 */

const crypto = require("crypto");

const OTP_LENGTH = 6;
const MAX_OTP_ATTEMPTS = 5;
const DEV_PEPPER = "lccb-development-otp-pepper";

let warnedAboutFallback = false;

function pepper() {
  const value = process.env.OTP_PEPPER;
  if (typeof value === "string" && value.length >= 16) return value;

  if (process.env.NODE_ENV === "production") {
    throw new Error("OTP_PEPPER must be set to at least 16 characters in production");
  }

  if (!warnedAboutFallback) {
    console.warn("[otp] OTP_PEPPER is not set; using the development fallback");
    warnedAboutFallback = true;
  }
  return DEV_PEPPER;
}

/** Cryptographically random 6-digit code, zero-padded. */
function generateOtp() {
  return String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/** Stable HMAC for an email/code pair. Never throws on bad input. */
function hashOtp(email, code) {
  return crypto
    .createHmac("sha256", pepper())
    .update(`${String(email).toLowerCase()}:${String(code)}`)
    .digest("hex");
}

/** Constant-time comparison of a submitted code against a stored hash. */
function verifyOtpHash(email, code, expectedHash) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return false;
  if (typeof expectedHash !== "string" || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
    return false;
  }

  const actual = Buffer.from(hashOtp(email, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = {
  OTP_LENGTH,
  MAX_OTP_ATTEMPTS,
  generateOtp,
  hashOtp,
  verifyOtpHash,
};
