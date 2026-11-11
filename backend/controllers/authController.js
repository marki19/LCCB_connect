const bcrypt = require("bcrypt");
const userModel = require("../models/userModel");
const accountService = require("../services/accountService");
const { getSupabaseAdmin } = require("../services/supabaseAdmin");
const { sendOtpEmail, sendAccountExistsEmail } = require("../services/emailService");
const { generateOtp, hashOtp, verifyOtpHash, MAX_OTP_ATTEMPTS } = require("../utils/otp");
const { isSuspendedProfile } = require("../middleware/auth");
const mfaService = require("../services/mfaService");
const { record, ACTIONS } = require("../services/auditService");
const { lockoutIntervalFor } = require("../utils/lockout");

const GENERIC_LOGIN_ERROR = "Invalid email, student ID, or password";
const GENERIC_CODE_ERROR = "That code is incorrect or has expired. Request a new one.";
const BCRYPT_COST = 12;
const OTP_EXPIRY_MINUTES = 10;

/**
 * The service-role client is required for every sign-in path now that login is
 * backend-owned. When it is not configured the endpoint is unavailable rather
 * than silently falling back to the client.
 */
function adminClientOr503(res) {
  try {
    return getSupabaseAdmin();
  } catch {
    res.status(503).json({
      error: "Sign-in is temporarily unavailable. Try again later.",
      code: "auth_unavailable",
    });
    return null;
  }
}

function sendTokens(res, session, status = 200, extra = {}) {
  return res.status(status).json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    ...extra,
  });
}

/**
 * Signs in with an email address, student ID, or username.
 *
 * Every identifier goes through here. Identity is still Supabase's decision --
 * this only adds the account check the client cannot do: an Auth user with no
 * `profiles` row is a deleted account and must not receive tokens.
 *
 * The student ID/username lookup happens server-side so the client never sees which
 * email owns which ID. Unknown IDs, wrong passwords, and a missing profile all
 * answer with the same 401 shape, so the endpoint cannot enumerate accounts.
 *
 * Account lockout: after 5 failed attempts, account is locked for 15 minutes.
 * Lockout is tracked per user and audited.
 */
async function login(req, res, next) {
  try {
    const { identifier, password } = req.body;

    const isEmail = identifier.includes("@");
        const isStudentId = /^\d{4}-\d{4,}$/.test(identifier); // 2023-12345 or 2023-00123 format
        const isUsername = !isEmail && !isStudentId; // alphanumeric username

        let email = null;
        let profile = null;
        let identifierType = isEmail ? "email" : isStudentId ? "student_id" : "username";

        if (isEmail) {
          email = identifier.toLowerCase();

          // Email login: check lockout early by looking up profile by email.
          // Same generic response for locked AND unknown accounts to prevent enumeration.
          const existing = await userModel.getUserByEmailForLockout(email);
          if (existing && (await userModel.isLocked(existing.id))) {
            return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
          }
        } else if (isStudentId) {
          // Student ID login: resolve to email and get profile
          const resolved = await userModel.getLoginEmailByStudentId(
            identifier.toUpperCase()
          );
          if (!resolved?.email) {
            return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
          }
          email = resolved.email;
          // Get profile for lockout check (getLoginEmailByStudentId only returns id, email)
          profile = await userModel.getUserById(resolved.id);

          // Check lockout before Supabase auth
          // Same generic response for locked AND unknown accounts to prevent enumeration.
          if (await userModel.isLocked(resolved.id)) {
            return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
          }
        } else if (isUsername) {
          // Username login: resolve to email and get profile
          const resolved = await userModel.getLoginEmailByUsername(identifier);
          if (!resolved?.email) {
            return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
          }
          email = resolved.email;
          // Get profile for lockout check (getLoginEmailByUsername only returns id, email)
          profile = await userModel.getUserById(resolved.id);

          // Check lockout before Supabase auth
          // Same generic response for locked AND unknown accounts to prevent enumeration.
          if (await userModel.isLocked(resolved.id)) {
            return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
          }
        }

        const supabase = adminClientOr503(res);
    if (!supabase) return;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // On auth failure (wrong password), check if user exists and increment failed attempts
      if (!/not confirmed|not_confirmed/i.test(error.message)) {
        if (!profile) {
          // For email login, look up profile by email to increment failed attempts
          // We still return the same generic error to prevent enumeration
          const existing = await userModel.getUserByEmailForLockout(email);
          if (existing) {
            const attempts = await userModel.incrementFailedLogins(existing.id);
            const interval = lockoutIntervalFor(attempts);
            if (interval) {
              await userModel.lockAccount(existing.id, interval);
              await record({
                actor: { id: existing.id, role: existing.role },
                action: ACTIONS.LOGIN_FAILED_LOCKOUT,
                targetType: "user",
                targetId: existing.id,
                metadata: {
                  ip: req.ip,
                  identifier_type: identifierType,
                  attempts,
                  lock_interval: interval,
                },
              });
            }
          }
        } else {
          // For student ID/username login, we already have profile
          const attempts = await userModel.incrementFailedLogins(profile.id);
          const interval = lockoutIntervalFor(attempts);
          if (interval) {
            await userModel.lockAccount(profile.id, interval);
            await record({
              actor: { id: profile.id, role: profile.role },
              action: ACTIONS.LOGIN_FAILED_LOCKOUT,
              targetType: "user",
              targetId: profile.id,
              metadata: {
                ip: req.ip,
                identifier_type: identifierType,
                attempts,
                lock_interval: interval,
              },
            });
          }
        }
      }
      if (/not confirmed|not_confirmed/i.test(error.message)) {
        return res.status(403).json({
          error: "Confirm your email first",
          code: "email_not_confirmed",
        });
      }
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    // Get profile if we don't have it yet (email login path)
    if (!profile) {
      profile = await userModel.getUserById(data.user.id);
    }
    if (!profile) {
      // The Auth user outlived its profile: this account was deleted. Drop the
      // session we just minted so it cannot be used elsewhere.
      await accountService.revokeSessions(data.user.id).catch(() => undefined);
      return res.status(403).json({
        error: "This account has been deleted. Contact the administrator if you think this is a mistake.",
        code: "account_deleted",
      });
    }

    // A lock that is still active must look identical to a wrong password, or
    // the endpoint becomes an account-existence oracle. Revoke the session we
    // just minted so a locked account never holds a usable token.
    if (await userModel.isLocked(data.user.id)) {
      await accountService.revokeSessions(data.user.id).catch(() => undefined);
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    if (isSuspendedProfile(profile)) {
          return res.status(403).json({
            error: "Account suspended",
            code: "account_suspended",
            suspended_until: profile.suspended_until || null,
            reason: profile.suspension_reason || null,
          });
        }

    // Check if user has verified MFA
    const hasMfa = await mfaService.hasVerifiedTotp(data.user.id);

    // Admin/superadmin must have MFA enrolled
    const role = profile?.role?.toLowerCase().replace(/[-_]/g, "");
    const isAdmin = role === "admin" || role === "superadmin";

    // Reset failed login attempts on successful login
    await userModel.resetFailedLogins(data.user.id);

    // Admin without MFA gets an initial session with mfa_enrollment_required: true
    // so they can authenticate to /api/auth/mfa/enroll while /api/admin/* remains locked
    if (isAdmin && !hasMfa) {
      await mfaService.recordLogin({
        userId: data.user.id,
        req,
        aal: "aal1",
        mfaChallenged: false,
      });

      return sendTokens(res, data.session, 200, {
        mfa_enrollment_required: true,
        message: "Admin accounts require MFA. Please complete MFA enrollment.",
      });
    }

    if (hasMfa) {
      // User has MFA enrolled - hand back a signed challenge token bound to
      // the first-factor session.
      const challengeToken = mfaService.createMfaChallenge(data.user.id, data.session);

      // Record the MFA challenge initiation
      await mfaService.recordSessionEvent({
        userId: data.user.id,
        eventType: "mfa_challenge",
        aal: "aal1",
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
        metadata: { mfa_challenged: true },
      });

      return res.status(200).json({
        mfa_required: true,
        challenge_token: challengeToken,
        message: "Multi-factor authentication required",
      });
    }

    // No MFA - return tokens directly
    await mfaService.recordLogin({
      userId: data.user.id,
      req,
      aal: "aal1",
      mfaChallenged: false,
    });

    return sendTokens(res, data.session);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/mfa/challenge
 * Verifies a TOTP code during login and returns session tokens.
 * Public endpoint - requires the challenge_token from the first-factor login.
 */
async function mfaChallenge(req, res, next) {
  try {
    const { challenge_token, code } = req.body;

    // Verify the signed challenge and confirm a pending first-factor session
    // exists for it. A forged token has no `jti` entry, so it never reaches
    // TOTP verification.
    const challenge = mfaService.resolveMfaChallenge(challenge_token);
    if (!challenge) {
      return res.status(401).json({
        error: "Invalid or expired challenge. Please sign in again.",
        code: "challenge_invalid",
      });
    }
    const userId = challenge.userId;

    // Get user profile
    const profile = await userModel.getUserById(userId);
    if (!profile) {
      return res.status(401).json({
        error: "Invalid or expired challenge. Please sign in again.",
        code: "challenge_invalid",
      });
    }

    // Check if account is locked
    if (await userModel.isLocked(userId)) {
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    // Check if suspended
    if (isSuspendedProfile(profile)) {
      return res.status(403).json({
        error: "Account suspended",
        code: "account_suspended",
        suspended_until: profile.suspended_until || null,
        reason: profile.suspension_reason || null,
      });
    }

    // Verify user still has MFA enrolled
    const hasMfa = await mfaService.hasVerifiedTotp(userId);
    if (!hasMfa) {
      return res.status(401).json({
        error: "Invalid or expired challenge. Please sign in again.",
        code: "challenge_invalid",
      });
    }

    // Get the verified TOTP factor
    const factors = await mfaService.listFactors(userId);
    const verifiedFactor = factors.find(
      (f) => f.type === "totp" && f.status === "verified"
    );
    if (!verifiedFactor) {
      return res.status(401).json({
        error: "Invalid or expired challenge. Please sign in again.",
        code: "challenge_invalid",
      });
    }

    // Decrypt the secret
    let decryptedSecret;
    try {
      const encryptedSecret = JSON.parse(verifiedFactor.secret);
      decryptedSecret = mfaService.decryptTotpSecret(encryptedSecret);
    } catch (e) {
      console.error("[mfa] Failed to decrypt TOTP secret for challenge:", e.message);
      return res.status(500).json({ error: "Factor configuration error" });
    }

    // Verify TOTP with timing-safe comparison and replay protection
    const { valid, currentStep, isReplay } = mfaService.verifyTotpTimingSafe(
      decryptedSecret,
      code,
      verifiedFactor.last_used_step
    );

    if (!valid || isReplay) {
      await mfaService.recordMfaChallenge({ userId, req, success: false });
      return res.status(401).json({ error: "Invalid code" });
    }

    // Update the factor's last_used_step
    const supabase = getSupabaseAdmin();
    await supabase
      .from("mfa_factors")
      .update({ last_used_step: currentStep })
      .eq("id", verifiedFactor.id);

    // Claim the pending session. It is single-use, so a replayed challenge
    // token cannot mint a second pair of tokens.
    const pending = mfaService.consumeMfaChallenge(challenge.jti);
    if (!pending) {
      return res.status(401).json({
        error: "Invalid or expired challenge. Please sign in again.",
        code: "challenge_invalid",
      });
    }

    // Record successful login with AAL2 elevation
    await mfaService.recordLogin({
      userId,
      req,
      aal: "aal2",
      mfaChallenged: true,
    });
    mfaService.clearSessionAgeCache(userId);

    // Record audit event
    await mfaService.recordMfaChallenge({ userId, req, success: true });

    return sendTokens(res, pending.session);
  } catch (err) {
    next(err);
  }
}

/**
 * Verifies a signup OTP and creates the Auth user + profile.
 *
 * Reverse signup flow:
 * 1. Find pending signup by email
 * 2. Check not already verified, not expired
 * 3. Compare the submitted code against the stored HMAC
 * 4. Decrypt password from pending record
 * 5. Create Auth user with the decrypted password
 * 6. Create profile with full_name from pending record
 * 7. Delete pending record
 * 8. Return session
 *
 * Every rejection returns the same body. Distinguishing "no pending signup",
 * "expired", "already used", and "wrong code" would turn this endpoint into a
 * signup-state oracle for any address.
 */
async function verifySignup(req, res, next) {
  try {
    const { email, token, password } = req.body;

    const normalizedEmail = email.toLowerCase();

    const invalidCode = () =>
      res.status(401).json({ error: GENERIC_CODE_ERROR, code: "code_invalid" });

    // Find pending signup
    const pending = await userModel.getPendingSignupByEmail(normalizedEmail);
    if (!pending || pending.verified_at) {
      return invalidCode();
    }

    // Check expiry. The record is useless after this point either way.
    if (new Date(pending.otp_expires_at) < new Date()) {
      await userModel.deletePendingSignup(normalizedEmail);
      return invalidCode();
    }

    // Verify OTP against the stored HMAC.
    if (!verifyOtpHash(normalizedEmail, token, pending.otp_hash)) {
      const attempts = await userModel.incrementOtpAttempts(normalizedEmail);
      // Six digits give an attacker ~1-in-200k per guess. Past the cap, drop
      // the record so the window cannot be ground down indefinitely.
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await userModel.deletePendingSignup(normalizedEmail);
      }
      return invalidCode();
    }

    const supabase = adminClientOr503(res);
    if (!supabase) return;

    // The password captured at request time is only a bcrypt hash. Compare the
    // re-submitted value against it, then hand the plaintext straight to
    // Supabase — nothing recoverable was ever stored.
    const passwordMatches = await bcrypt.compare(password, pending.password_hash);
    if (!passwordMatches) {
      return invalidCode();
    }

    // Create Auth user with the real password
    const { data, error } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true, // OTP verified, so confirm immediately
      user_metadata: {
        full_name: pending.full_name,
      },
    });

    if (error || !data?.user) {
      console.error("[auth] Create user after OTP failed:", error?.message);
      return res.status(500).json({
        error: "Could not complete signup. Try again in a moment.",
        code: "creation_failed",
      });
    }

    const user = data.user;

    // Create profile
    await userModel.createUser({
      id: user.id,
      email: user.email,
      full_name: pending.full_name,
      role: "student",
    });

    // Delete pending record
    await userModel.deletePendingSignup(normalizedEmail);

    // Create session for the new user
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (sessionError || !sessionData?.session) {
      console.error("[auth] Session creation after signup failed:", sessionError?.message);
      // User is created, they can log in manually
      return res.status(201).json({
        message: "Account created successfully. Please log in.",
        code: "signup_complete_manual_login",
      });
    }

    return sendTokens(res, sessionData.session, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * Resends the signup OTP to the provided email.
 * Rate limited: 3 requests per 10 minutes per email (handled by middleware).
 * Always answers 202 so the response cannot be used to probe for pending
 * signups.
 */
async function resendSignup(req, res, next) {
  try {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase();

    const accepted = () =>
      res.status(202).json({
        message: "If that address has a pending signup, a code is on its way.",
        retry_after: 60,
      });

    // Find pending signup
    const pending = await userModel.getPendingSignupByEmail(normalizedEmail);
    if (!pending || pending.verified_at) {
      return accepted();
    }

    // Generate new OTP and replace the stored hash. The password and name are
    // carried over unchanged; only the code rotates.
    const newOtp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await userModel.createPendingSignup({
      email: normalizedEmail,
      passwordHash: pending.password_hash,
      fullName: pending.full_name,
      otpHash: hashOtp(normalizedEmail, newOtp),
      otpExpiresAt,
    });

    // Send OTP email
    await sendOtpEmail({
      to: normalizedEmail,
      otpCode: newOtp,
      fullName: pending.full_name,
      expiresMinutes: OTP_EXPIRY_MINUTES,
    });

    return accepted();
  } catch (err) {
    next(err);
  }
}


/**
 * Requests signup: stores pending record with the encrypted password and an
 * OTP hash, then sends the code.
 *
 * Reverse signup flow (Phase 1):
 * 1. Reject only if the address already has a profile; answer 202 anyway and
 *    send an "account exists" email instead of a code.
 * 2. Encrypt password with AES-256-GCM
 * 3. Generate 6-digit OTP and store only its HMAC
 * 4. Upsert into pending_signups (email, password_hash, full_name, otp_hash,
 *    otp_expires_at = NOW() + 10 min)
 * 5. Send OTP email via custom email service
 * 6. Return 202 Accepted
 *
 * Rate limited: 3 requests per 10 minutes per email (handled by middleware).
 * Auth user and profile are created ONLY after successful OTP verification.
 *
 * The response is identical in every case, so this endpoint cannot be used to
 * discover which addresses are registered.
 */
async function requestSignup(req, res, next) {
  try {
    const { email, password, full_name } = req.body;
    const normalizedEmail = email.toLowerCase();

    const accepted = () =>
      res.status(202).json({
        message: "If that address can be registered, a code is on its way.",
        retry_after: 60,
      });

    // Indexed lookup. The previous admin.listUsers() call only saw the first
    // page, so older accounts read as "available".
    const existingProfile = await userModel.findProfileIdByEmail(normalizedEmail);

    if (existingProfile) {
      // Sending anything different here would turn this into an enumeration
      // oracle. The owner still needs to know why no code arrived.
      await sendAccountExistsEmail({ to: normalizedEmail }).catch((err) => {
        console.error("[auth] Account-exists email failed:", err.message);
      });
      return accepted();
    }

    // Generate OTP
    const otpCode = generateOtp();
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store pending signup. An expired pending row is replaced; an active one
    // is replaced too, because the requester proved nothing by retrying and
    // the code still goes only to the mailbox owner.
    await userModel.createPendingSignup({
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      fullName: full_name,
      otpHash: hashOtp(normalizedEmail, otpCode),
      otpExpiresAt,
    });

    // Send OTP email
    await sendOtpEmail({
      to: normalizedEmail,
      otpCode,
      fullName: full_name,
      expiresMinutes: OTP_EXPIRY_MINUTES,
    });

    return accepted();
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/mfa/enroll
 * Initiates TOTP enrollment. Returns secret, URI, and QR code URL.
 * Requires authenticated user.
 * The secret is only returned once during enrollment and is encrypted at rest.
 */
async function mfaEnroll(req, res, next) {
  try {
    const userId = req.user.id;
    const email = req.user.email;

    // Check if user already has a verified TOTP factor
    const hasVerified = await mfaService.hasVerifiedTotp(userId);
    if (hasVerified) {
      return res.status(409).json({
        error: "MFA is already enrolled. Unenroll first to set up a new device.",
        code: "mfa_already_enrolled",
      });
    }

    const { secret, encryptedSecret, uri, qrCodeDataUrl } = await mfaService.generateTotpSecret(userId, email);

    // Store unverified factor with encrypted secret
    const factor = await mfaService.createTotpFactor(userId, encryptedSecret);

    return res.json({
      factor_id: factor.id,
      secret,
      uri,
      qr_code_url: qrCodeDataUrl,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/mfa/enroll/verify
 * Verifies the TOTP code and activates the factor.
 * Requires authenticated user.
 */
async function mfaEnrollVerify(req, res, next) {
  try {
    const userId = req.user.id;
    const { factor_id, code } = req.body;

    if (!factor_id || !code) {
      return res.status(400).json({ error: "factor_id and code are required" });
    }

    const factor = await mfaService.verifyTotpFactor(userId, factor_id, code);

    // Elevate current session to AAL2
    await mfaService.recordLogin({
      userId,
      req,
      aal: "aal2",
      mfaChallenged: true,
    });
    mfaService.clearSessionAgeCache(userId);

    // Audit
    await mfaService.recordMfaEnroll({ userId, req, factorId: factor.id });

    return res.json({
      message: "MFA enrolled successfully",
      factor_id: factor.id,
      verified_at: factor.verified_at,
    });
  } catch (err) {
    if (err.status === 401) {
      await mfaService.recordMfaChallenge({ userId: req.user.id, req, success: false });
      return res.status(401).json({ error: err.message });
    }
    next(err);
  }
}

/**
 * POST /api/auth/mfa/unenroll
 * Removes a TOTP factor. Requires the current TOTP code for confirmation.
 * Requires authenticated user.
 * Uses timing-safe verification with replay protection.
 */
async function mfaUnenroll(req, res, next) {
  try {
    const userId = req.user.id;
    const { factor_id, code } = req.body;

    if (!factor_id || !code) {
      return res.status(400).json({ error: "factor_id and code are required" });
    }

    // Verify the code first
    const supabase = getSupabaseAdmin();
    const { data: factor, error: fetchError } = await supabase
      .from("mfa_factors")
      .select("*")
      .eq("id", factor_id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !factor) {
      return res.status(404).json({ error: "Factor not found" });
    }

    // Decrypt secret and verify with timing-safe comparison
    let decryptedSecret;
    try {
      const encryptedSecret = JSON.parse(factor.secret);
      decryptedSecret = mfaService.decryptTotpSecret(encryptedSecret);
    } catch (e) {
      console.error("[mfa] Failed to decrypt TOTP secret for unenroll:", e.message);
      return res.status(500).json({ error: "Factor configuration error" });
    }

    const { valid, isReplay } = mfaService.verifyTotpTimingSafe(decryptedSecret, code, factor.last_used_step);

    if (!valid || isReplay) {
      await mfaService.recordMfaChallenge({ userId, req, success: false });
      return res.status(401).json({ error: "Invalid code" });
    }

    // Delete the factor
    await mfaService.deleteFactor(userId, factor_id);

    // Audit
    await mfaService.recordMfaUnenroll({ userId, req, factorId: factor_id });

    return res.json({ message: "MFA unenrolled successfully" });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/mfa/list
 * Lists all MFA factors for the current user.
 * Requires authenticated user.
 */
async function mfaList(req, res, next) {
  try {
    const userId = req.user.id;
    const factors = await mfaService.listFactors(userId);

    // Don't return secrets
    const safeFactors = factors.map((f) => ({
      id: f.id,
      type: f.type,
      name: f.name,
      status: f.status,
      created_at: f.created_at,
      verified_at: f.verified_at,
    }));

    return res.json({ factors: safeFactors });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Records logout event and returns success.
 * Requires authenticated user.
 */
async function logout(req, res, next) {
  try {
    const userId = req.user.id;

    // Record logout
    await mfaService.recordLogout({ userId, req });

    // Clear session age cache
    mfaService.clearSessionAgeCache(userId);

    return res.json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/google
 * Exchanges a Google ID token for a session (Supabase signInWithIdToken).
 * Creates the profile if it doesn't exist.
 * Public by necessity: the caller has no session until this succeeds.
 */
async function googleAuth(req, res, next) {
  try {
    const { id_token } = req.body;

    if (!id_token) {
      return res.status(400).json({ error: "Google ID token is required" });
    }

    const supabase = adminClientOr503(res);
    if (!supabase) return;

    // Verify the Google ID token with Supabase
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: id_token,
    });

    if (error || !data?.session || !data?.user) {
      console.error("[auth] Google sign-in failed:", error?.message);
      return res.status(401).json({
        error: "Google sign-in failed. Try again.",
        code: "google_signin_failed",
      });
    }

    const user = data.user;
    const email = user.email?.toLowerCase();

    // Enforce LCCB email domain for signups (Phase 1 domain trigger)
    if (email && !email.endsWith("@lccbonline.edu.ph")) {
      // Sign out the user we just created
      await supabase.auth.admin.deleteUser(user.id);
      return res.status(403).json({
        error: "Only @lccbonline.edu.ph accounts are allowed.",
        code: "domain_not_allowed",
      });
    }

    // Check if profile exists
    let profile = await userModel.getUserById(user.id);
    const googleAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

    if (!profile) {
      // Create profile for new Google user with Google avatar as default
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || null;
      await userModel.createUser({
        id: user.id,
        email: user.email,
        full_name: fullName,
        avatar_url: googleAvatar,
        role: "student",
        verification_status: "verified", // Google already verified the email
        verified_at: new Date().toISOString(),
      });
      profile = await userModel.getUserById(user.id);
    } else if (!profile.avatar_url && googleAvatar) {
      // Default to Google avatar if user has not yet set a custom profile photo
      await userModel.updateUser(user.id, { avatar_url: googleAvatar });
      profile.avatar_url = googleAvatar;
    }

    // Check for suspension
    if (isSuspendedProfile(profile)) {
      return res.status(403).json({
        error: "Account suspended",
        code: "account_suspended",
        suspended_until: profile.suspended_until || null,
        reason: profile.suspension_reason || null,
      });
    }

    // Check if user has verified MFA
    const hasMfa = await mfaService.hasVerifiedTotp(user.id);

    // Record successful login
    await mfaService.recordLogin({
      userId: user.id,
      req,
      aal: hasMfa ? "aal2" : "aal1",
      mfaChallenged: hasMfa,
    });

    return sendTokens(res, data.session);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  verifySignup,
  resendSignup,
  requestSignup,
  // Google OAuth
  googleAuth,
  // MFA endpoints
  mfaEnroll,
  mfaEnrollVerify,
  mfaChallenge,
  mfaUnenroll,
  mfaList,
  // Session endpoints
  logout,
};
