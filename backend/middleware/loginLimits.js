const rateLimit = require("express-rate-limit");

/**
 * Rate limits for login (plan §5 Phase 3.2).
 * - IP-based: 10 requests per 15 min per IP
 * - Identifier-based: 5 requests per 15 min per identifier (email or student ID)
 *
 * Identifier-based limits prevent targeted credential stuffing on a known ID,
 * while IP limits mitigate generic brute force.
 */

const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window per IP
  message: { error: "Too many requests. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginIdentifierLimiter = rateLimit({
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
const resendSignupLimiter = rateLimit({
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

module.exports = {
  loginIpLimiter,
  loginIdentifierLimiter,
  resendSignupLimiter,
};