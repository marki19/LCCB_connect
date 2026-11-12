const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const isTest = process.env.NODE_ENV === "test";

function createLimiter(options) {
  if (isTest) {
    return (req, res, next) => next();
  }
  return rateLimit(options);
}

const parseLimit = (raw, fallback) => {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Rate limits for login (plan §5 Phase 3.2).
 * - IP-based: 10 requests per 15 min per IP
 * - Identifier-based: 5 requests per 15 min per identifier (email or student ID)
 *
 * Identifier-based limits prevent targeted credential stuffing on a known ID,
 * while IP limits mitigate generic brute force.
 */

const loginIpLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window per IP
  message: { error: "Too many requests. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginIdentifierLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window per identifier
  message: { error: "Too many attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: function (req) {
    // Normalize the identifier from the body for consistent keying. Signup
    // verification identifies by email, so both key shapes share one limiter.
    const id = req.body?.identifier || req.body?.email || "";
    if (typeof id === "string" && id.length > 0) {
      return id.trim().toUpperCase();
    }
    return "unknown";
  },
  skipSuccessfulRequests: false, // Always count, even failed attempts.
});

/**
 * Resend signup OTP limiter: 3 requests per 10 minutes per email.
 * Stricter than login to prevent email flooding.
 */
const resendSignupLimiter = createLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // 3 resends per window per email
  message: { error: "Too many resend requests. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: function (req) {
    const email = req.body?.email || "";
    if (typeof email === "string" && email.length > 0) {
      return email.trim().toLowerCase();
    }
    return "unknown";
  },
  skipSuccessfulRequests: false,
});

/**
 * Initial signup request limiter: 5 requests per 15 minutes per IP.
 * Prevents unauthenticated OTP email flooding.
 */
const requestSignupLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 signup requests per window per IP
  message: { error: "Too many signup attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Per-address signup limiter: 3 requests per hour per email.
 * The IP limiter alone lets a distributed caller mail-bomb one mailbox, and
 * lets a single IP rotate through many addresses.
 */
const requestSignupEmailLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: "Too many signup attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: function (req) {
    const email = req.body?.email || "";
    if (typeof email === "string" && email.length > 0) {
      return email.trim().toLowerCase();
    }
    return "unknown";
  },
});

/**
 * Google token exchange limiter: 10 requests per minute per IP.
 * Each call costs a network round trip to Supabase and can mint a session, so
 * it should not be free.
 */
const googleAuthLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: "Too many sign-in attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * MFA challenge limiter.
 *
 * The challenge body is `{ challenge_token, code }` — there is no identifier to
 * key on, and a shared "unknown" bucket would lock every user out after a
 * handful of attempts. Key on the token itself (hashed, so the raw token is
 * never held as a map key) with an IP fallback for malformed requests.
 *
 * 5 attempts per 15 minutes per challenge is enough for clock drift and stops
 * an online TOTP brute force.
 */
const mfaChallengeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: parseLimit(process.env.RATE_LIMIT_MFA_CHALLENGE_MAX, 5),
  message: { error: "Too many attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: function (req) {
    const token = req.body?.challenge_token;
    if (typeof token === "string" && token.length > 0) {
      return `mfa:${crypto.createHash("sha256").update(token).digest("hex")}`;
    }
    return rateLimit.ipKeyGenerator(req.ip);
  },
});

/**
 * Password reset request limiter: 5 requests per 15 minutes per IP.
 */
const requestPasswordResetLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many reset requests. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Password reset verification limiter: 5 attempts per 15 minutes per email.
 */
const verifyPasswordResetLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many verification attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: function (req) {
    const email = req.body?.email || "";
    if (typeof email === "string" && email.length > 0) {
      return email.trim().toLowerCase();
    }
    return "unknown";
  },
  skipSuccessfulRequests: false,
});

module.exports = {
  loginIpLimiter,
  loginIdentifierLimiter,
  mfaChallengeLimiter,
  resendSignupLimiter,
  requestSignupLimiter,
  requestSignupEmailLimiter,
  googleAuthLimiter,
  requestPasswordResetLimiter,
  verifyPasswordResetLimiter,
};