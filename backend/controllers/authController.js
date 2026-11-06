const userModel = require("../models/userModel");
const accountService = require("../services/accountService");
const { getSupabaseAdmin } = require("../services/supabaseAdmin");
const { isSuspendedProfile } = require("../middleware/auth");

const GENERIC_LOGIN_ERROR = "Invalid email, student ID, or password";

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

function sendTokens(res, session, status = 200) {
  return res.status(status).json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  });
}

/**
 * Signs in with an email address or a student ID.
 *
 * Every identifier goes through here. Identity is still Supabase's decision —
 * this only adds the account check the client cannot do: an Auth user with no
 * `profiles` row is a deleted account and must not receive tokens.
 *
 * The student ID lookup happens server-side so the client never sees which
 * email owns which ID. Unknown IDs, wrong passwords, and a missing profile all
 * answer with the same 401 shape, so the endpoint cannot enumerate accounts.
 */
async function login(req, res, next) {
  try {
    const { identifier, password } = req.body;

    const isEmail = identifier.includes("@");
    let email = isEmail ? identifier.toLowerCase() : null;

    if (!email) {
      const resolved = await userModel.getLoginEmailByStudentId(
        identifier.toUpperCase()
      );
      if (!resolved?.email) {
        return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
      }
      email = resolved.email;
    }

    const supabase = adminClientOr503(res);
    if (!supabase) return;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (/not confirmed|not_confirmed/i.test(error.message)) {
        return res.status(403).json({
          error: "Confirm your email first",
          code: "email_not_confirmed",
        });
      }
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    const profile = await userModel.getUserById(data.user.id);
    if (!profile) {
      // The Auth user outlived its profile: this account was deleted. Drop the
      // session we just minted so it cannot be used elsewhere.
      await accountService.revokeSessions(data.user.id).catch(() => undefined);
      return res.status(403).json({
        error: "This account has been deleted. Contact the administrator if you think this is a mistake.",
        code: "account_deleted",
      });
    }

    if (isSuspendedProfile(profile)) {
      return res.status(403).json({
        error: "Account suspended",
        code: "account_suspended",
        suspended_until: profile.suspended_until || null,
        reason: profile.suspension_reason || null,
      });
    }

    return sendTokens(res, data.session);
  } catch (err) {
    next(err);
  }
}

/**
 * Exchanges a signup OTP for a session AND creates the profile.
 *
 * Profile creation used to be a lazy side effect of the first profile fetch,
 * which made "profile missing" ambiguous: it meant either "signup in progress"
 * or "account deleted". Creating it here means a missing profile is always a
 * deleted account, so login can safely refuse it.
 *
 * `full_name` comes from the Auth user's metadata (set at signUp), never from
 * the request body, so it cannot be forged. Role is always `student`; staff
 * accounts are provisioned by an administrator.
 */
async function verifySignup(req, res, next) {
  try {
    const { email, token } = req.body;

    const supabase = adminClientOr503(res);
    if (!supabase) return;

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    });

    if (error || !data?.session || !data?.user) {
      // Map specific Supabase OTP errors to user-friendly messages
      if (error) {
        const errMsg = error.message?.toLowerCase() || "";
        if (errMsg.includes("expired") || errMsg.includes("outdated")) {
          return res.status(401).json({
            error: "The code has expired. Request a new one.",
            code: "code_expired",
          });
        }
        if (errMsg.includes("already used") || errMsg.includes("already been")) {
          return res.status(401).json({
            error: "This code was already used. Request a new one.",
            code: "code_used",
          });
        }
        if (errMsg.includes("invalid") || errMsg.includes("wrong") || errMsg.includes("incorrect")) {
          return res.status(401).json({
            error: "That code is incorrect.",
            code: "code_invalid",
          });
        }
      }
      return res.status(401).json({
        error: "That code is wrong or expired.",
        code: "invalid_code",
      });
    }

    const user = data.user;

    await userModel.createUser({
      id: user.id,
      email: user.email || email,
      full_name: user.user_metadata?.full_name ?? null,
      role: "student",
    });

    return sendTokens(res, data.session, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * Resends the signup OTP to the provided email.
 * Rate limited: 3 requests per 10 minutes per email (handled by middleware).
 * Uses service-role client to trigger Supabase to send the OTP email.
 */
async function resendSignup(req, res, next) {
  try {
    const { email } = req.body;

    const supabase = adminClientOr503(res);
    if (!supabase) return;

    // Trigger Supabase to resend the signup OTP
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      // Log but don't expose internal details
      console.error("[auth] Resend signup failed:", error.message);
      return res.status(400).json({
        error: "Could not resend the code. Try again in a moment.",
        code: "resend_failed",
      });
    }

    return res.status(202).json({
      message: "Code sent",
      retry_after: 60,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  verifySignup,
  resendSignup,
};
