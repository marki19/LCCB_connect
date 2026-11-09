const rateLimit = require("express-rate-limit");

const isTest = process.env.NODE_ENV === "test";

function createLimiter(options) {
  if (isTest) {
    return (req, res, next) => next();
  }
  return rateLimit(options);
}

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

module.exports = {
  loginIpLimiter,
  loginIdentifierLimiter,
  resendSignupLimiter,
  requestSignupLimiter,
  requestSignupEmailLimiter,
  googleAuthLimiter,
};