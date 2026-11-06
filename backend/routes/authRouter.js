const express = require("express");
const router = express.Router();
const { login, verifySignup, resendSignup, requestSignup } = require("../controllers/authController");
const { loginIpLimiter, loginIdentifierLimiter, resendSignupLimiter, requestSignupLimiter } = require("../middleware/loginLimits");
const {
  validate,
  loginIdentifierSchema,
  verifySignupSchema,
  resendSignupSchema,
  requestSignupSchema,
} = require("../validation");

/**
 * POST /api/auth/login
 *
 * Signs in with either an email address (contains '@') or a student ID.
 * Mounted before authenticated routers, no requireAuth.
 */
router.post(
  "/login",
  loginIpLimiter,
  loginIdentifierLimiter,
  validate(loginIdentifierSchema),
  login
);

/**
 * POST /api/auth/verify-signup
 *
 * Exchanges the 6-digit signup code for a session and creates the profile.
 * Public by necessity: the caller has no session until this succeeds.
 */
router.post(
  "/verify-signup",
  loginIpLimiter,
  loginIdentifierLimiter,
  validate(verifySignupSchema),
  verifySignup
);

/**
 * POST /api/auth/resend-signup
 *
 * Resends the 6-digit signup OTP to the provided email.
 * Rate limited: 3 requests per 10 minutes per email.
 */
router.post(
  "/resend-signup",
  resendSignupLimiter,
  validate(resendSignupSchema),
  resendSignup
);

/**
 * POST /api/auth/request-signup
 *
 * Initiates signup by creating Auth user and sending OTP email.
 * Backend-owned: never exposes anon key to client.
 * Rate limited: 3 requests per 10 minutes per email.
 */
router.post(
  "/request-signup",
  requestSignupLimiter,
  validate(requestSignupSchema),
  requestSignup
);

module.exports = router;
