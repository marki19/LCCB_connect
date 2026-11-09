const express = require("express");
const router = express.Router();
const {
  login,
  verifySignup,
  resendSignup,
  requestSignup,
  googleAuth,
  mfaEnroll,
  mfaEnrollVerify,
  mfaChallenge,
  mfaUnenroll,
  mfaList,
  logout,
} = require("../controllers/authController");
const {
  loginIpLimiter,
  loginIdentifierLimiter,
  resendSignupLimiter,
  requestSignupLimiter,
  requestSignupEmailLimiter,
  googleAuthLimiter,
} = require("../middleware/loginLimits");
const {
  validate,
  loginIdentifierSchema,
  verifySignupSchema,
  resendSignupSchema,
  requestSignupSchema,
  mfaChallengeSchema,
} = require("../validation");
const { requireAuth, loadProfile } = require("../middleware/auth");

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
 * Starts a signup by storing a pending record and emailing a code.
 * The response is identical whether or not the address is already registered.
 * Rate limited: 5 requests per 15 minutes per IP, 3 per hour per address.
 */
router.post(
  "/request-signup",
  requestSignupLimiter,
  requestSignupEmailLimiter,
  validate(requestSignupSchema),
  requestSignup
);

/**
 * POST /api/auth/google
 *
 * Exchanges a Google ID token for a session (Supabase signInWithIdToken).
 * Public by necessity: the caller has no session until this succeeds.
 * Rate limited: 10 requests per minute per IP.
 */
router.post("/google", googleAuthLimiter, googleAuth);

/**
 * POST /api/auth/mfa/challenge
 * Verifies a TOTP code during login and returns session tokens.
 * Public endpoint - requires the challenge_token from the first-factor login.
 * Rate limited by loginIpLimiter and loginIdentifierLimiter.
 */
router.post(
  "/mfa/challenge",
  loginIpLimiter,
  loginIdentifierLimiter,
  validate(mfaChallengeSchema),
  mfaChallenge
);

/**
 * MFA Routes (require authentication)
 */
router.use("/mfa", requireAuth, loadProfile);

/**
 * POST /api/auth/mfa/enroll
 * Initiates TOTP enrollment. Returns secret, URI, and QR code URL.
 */
router.post("/mfa/enroll", mfaEnroll);

/**
 * POST /api/auth/mfa/enroll/verify
 * Verifies the TOTP code and activates the factor.
 */
router.post("/mfa/enroll/verify", mfaEnrollVerify);

/**
 * POST /api/auth/mfa/unenroll
 * Removes a TOTP factor. Requires the current TOTP code for confirmation.
 */
router.post("/mfa/unenroll", mfaUnenroll);

/**
 * GET /api/auth/mfa/list
 * Lists all MFA factors for the current user.
 */
router.get("/mfa/list", mfaList);

/**
 * POST /api/auth/logout
 * Records logout event and returns success.
 * Requires authenticated user.
 */
router.post("/logout", logout);

module.exports = router;
