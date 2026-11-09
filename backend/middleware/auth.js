const { createClient } = require("@supabase/supabase-js");
const userModel = require("../models/userModel");
const mfaService = require("../services/mfaService");
const { normalizeRole, ROLES, ADMIN_ROLES, DEPARTMENT_ADMIN_ROLES, FACULTY_ROLES, ALL_ROLES } = require("../utils/roles");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.warn(
    "[auth] SUPABASE_URL / SUPABASE_ANON_KEY are not set. " +
      "Authenticated requests will fail. Copy backend/.env.example to backend/.env."
  );
}

// Anon client used ONLY to verify access tokens presented by callers.
// No session is persisted on the server.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || "missing-anon-key",
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const SUPABASE_ISSUER = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL.replace(/\/+$/, "")}/auth/v1`
  : null;

/**
 * Verifies a Supabase access token.
 *
 * `getUser` is authoritative, but it rejects tokens whose session was revoked
 * (including the session revocation performed when an account is suspended).
 * In that case, verify the JWT locally against Supabase's JWKS. The signature
 * and expiry still have to be valid, so a suspended caller can reach
 * `requireActiveAccount` and receive the 403 that drives the suspended screen,
 * instead of falling through as an unauthenticated 401.
 */
async function verifyAccessToken(token) {
  const { data, error } = await supabase.auth.getUser(token);
  if (!error && data?.user) return data.user;

  // Only fall back when Supabase rejected an otherwise-valid session. A forged
  // or malformed JWT must stay a hard 401.
  const message = error?.message || "";
  if (!/session.*(missing|not found|invalid)|banned|revoked/i.test(message)) {
    return null;
  }

  try {
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    const claims = claimsData?.claims;
    if (claimsError || !claims?.sub) return null;
    if (claims.aud && claims.aud !== "authenticated") return null;
    if (SUPABASE_ISSUER && claims.iss && claims.iss !== SUPABASE_ISSUER) {
      return null;
    }
    if (claims.exp && claims.exp * 1000 <= Date.now()) return null;

    // A deleted account can leave a valid JWT until it expires. Accept the
    // fallback only while a profile still exists; account deletion removes it.
    const profile = await userModel.getUserById(claims.sub);
    if (!profile) return null;

    return {
      id: claims.sub,
      email: claims.email || null,
      user_metadata: claims.user_metadata || {},
    };
  } catch {
    return null;
  }
}

/**
 * Verifies the caller's Supabase access token and attaches `req.user`.
 * Identity is derived ONLY from the verified token — never from the request body.
 */
async function requireAuth(req, res, next) {
  try {
    // Idempotent: several routers are mounted on the same path (e.g. /api/users
    // serves both profile CRUD and the social graph). Once any mount has
    // verified the token, later mounts reuse `req.user` instead of re-verifying
    // it against Supabase, so a request costs at most one token check.
    if (req.user) return next();

    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = await verifyAccessToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = user; // { id, email, ... } — authoritative identity
    req.accessToken = token;
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Optional authentication:
 * If a Bearer token is provided, verify it and attach req.user.
 * If no token is provided, proceed as guest (req.user = null).
 * If an invalid token is explicitly supplied, reject with 401.
 */
async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!token) {
      req.user = null;
      req.accessToken = null;
      return next();
    }

    const user = await verifyAccessToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = user;
    req.accessToken = token;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Loads the caller's `profiles` row into `req.profile`. */
async function loadProfile(req, res, next) {
  try {
    // Idempotent: several routers mount on the same path. Once any mount has
    // loaded the profile, later mounts reuse it instead of querying again.
    if (req.profile !== undefined) return next();

    if (!req.user || !req.user.id) {
      req.profile = null;
      return next();
    }
    req.profile = (await userModel.getUserById(req.user.id)) || null;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** True when the profile has a live suspension (an expired one is inactive). */
function isSuspendedProfile(profile) {
  if (!profile || !profile.suspended_at) return false;
  if (!profile.suspended_until) return true;
  const until = new Date(profile.suspended_until).getTime();
  return Number.isFinite(until) && until > Date.now();
}

/**
 * Rejects a suspended account on every authenticated API route.
 *
 * Mount after `loadProfile`. A missing profile is allowed through so the
 * one-time self-provisioning POST /users path can still create it. The check is
 * deliberately profile-only: it adds no query of its own.
 */
function requireActiveAccount(req, res, next) {
  // A suspended account must still be able to read its own profile so the app
  // can render the suspension reason and end date instead of a blank screen.
  if (req.method === "GET" && req.path === `/${req.user?.id}`) return next();

  if (!isSuspendedProfile(req.profile)) return next();

  return res.status(403).json({
    error: "Account suspended",
    code: "account_suspended",
    suspended_until: req.profile.suspended_until || null,
    reason: req.profile.suspension_reason || null,
  });
}

/** Inspection Predicates */
function getRole(req) {
  return req.profile?.role || null;
}

function hasExactRole(req, targetRole) {
  return normalizeRole(getRole(req)) === normalizeRole(targetRole);
}

function isSuperAdmin(req) {
  return normalizeRole(getRole(req)) === "superadmin";
}

function isAdmin(req) {
  const norm = normalizeRole(getRole(req));
  return norm === "admin" || norm === "superadmin";
}

function isDepartmentAdmin(req) {
  const norm = normalizeRole(getRole(req));
  return norm === "departmentadmin" || norm === "admin" || norm === "superadmin";
}

function isFaculty(req) {
  const norm = normalizeRole(getRole(req));
  return norm === "faculty" || norm === "departmentadmin" || norm === "admin" || norm === "superadmin";
}

function isStudent(req) {
  return normalizeRole(getRole(req)) === "student";
}

/**
 * Privilege ranking used for account management. Higher = more privileged.
 * An unrecognised or absent role ranks -1, so it can never manage anyone.
 */
const ROLE_RANK = {
  student: 0,
  guest: 0,
  faculty: 1,
  departmentadmin: 2,
  admin: 3,
  superadmin: 4,
};

/** Rank of an arbitrary role string (-1 when unrecognised). */
function rankOf(role) {
  const rank = ROLE_RANK[normalizeRole(role)];
  return typeof rank === "number" ? rank : -1;
}

/** The caller's own privilege rank. */
function getRank(req) {
  return rankOf(getRole(req));
}

/**
 * True when the caller may manage an account holding `targetRole`.
 *
 * Requires admin rights AND a strictly higher rank, so:
 *  - an `admin` cannot edit or delete a peer `admin` or a `superadmin`
 *  - a `departmentAdmin`/`faculty`/`student` cannot manage anyone else
 *  - nobody can manage an equal-ranked account
 *
 * Run `loadProfile` first, and look up the target's stored role before calling.
 */
function canManage(req, targetRole) {
  return isAdmin(req) && getRank(req) > rankOf(targetRole);
}

/**
 * Restricts a route to any of the given roles. Run `loadProfile` first.
 * Matches case-insensitively and allows camelCase/snake_case interchange.
 */
function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map(normalizeRole);
  return (req, res, next) => {
    if (!req.profile) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const userRole = normalizeRole(req.profile.role);
    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

/**
 * Blocks students who have not been verified from performing writes.
 *
 * Staff accounts (faculty, departmentAdmin, admin, superadmin) are never
 * gated: they are provisioned by an admin and must not be trapped in
 * onboarding (D12). The verification endpoints themselves are mounted
 * without this middleware, and profile edits stay open because bio, avatar,
 * and year level remain editable after approval (D11).
 */
function requireVerified(req, res, next) {
  const role = normalizeRole(getRole(req));
  if (role !== "student") return next();
  if (req.profile?.verification_status === "verified") return next();
  return res.status(403).json({
    error: "Verify your identity to do that",
    code: "not_verified",
  });
}

// Composable role security gates
const requireSuperAdmin = [requireAuth, loadProfile, requireRole("superadmin")];
const requireAdmin = [requireAuth, loadProfile, requireRole("admin", "superadmin")];
const requireDepartmentAdmin = [requireAuth, loadProfile, requireRole("departmentAdmin", "admin", "superadmin")];
const requireFaculty = [requireAuth, loadProfile, requireRole("faculty", "departmentAdmin", "admin", "superadmin")];
const requireStudent = [requireAuth, loadProfile, requireRole("student")];


/**
 * Middleware to enforce AAL2 (multi-factor authentication) for admin roles.
 * Must run after requireAuth + loadProfile.
 */
function requireAal2(req, res, next) {
  const role = req.profile?.role?.toLowerCase().replace(/[-_]/g, "");
  if (role !== "admin" && role !== "superadmin") {
    return next(); // Non-admins: AAL1 is fine
  }
  const aal = mfaService.getAalFromToken(req.accessToken);
  if (aal !== "aal2") {
    return res.status(403).json({
      error: "Multi-factor authentication required",
      code: "mfa_required",
      aal: "aal2",
    });
  }
  next();
}

/**
 * Middleware to enforce session age limits.
 * - All roles: 7 days max
 * - Admin/superadmin: 8 hours max
 * Caches session lookup in memory for 60 seconds per user.
 */
async function checkSessionAge(req, res, next) {
  if (!req.user?.id) return next();

  const now = Date.now();
  const cache = checkSessionAge.cache || (checkSessionAge.cache = new Map());
  const cached = cache.get(req.user.id);
  if (cached && now - cached.ts < 60000) {
    if (!cached.valid) {
      return res.status(401).json({
        error: "Session expired",
        code: "session_expired",
      });
    }
    return next();
  }

  try {
    const { getSupabaseAdmin } = require("../services/supabaseAdmin");
    const supabase = getSupabaseAdmin();
    // Get the session's created_at from session_events table
    const { data: events, error } = await supabase
      .from("session_events")
      .select("created_at, event_type, aal")
      .eq("user_id", req.user.id)
      .eq("event_type", "login")
      .order("created_at", { ascending: false })
      .limit(1);

    let valid = true;
    if (!error && events?.length > 0) {
      const loginTime = new Date(events[0].created_at).getTime();
      const ageMs = now - loginTime;
      const role = req.profile?.role?.toLowerCase().replace(/[-_]/g, "");
      const maxAgeMs = (role === "admin" || role === "superadmin")
        ? 8 * 60 * 60 * 1000 // 8 hours
        : 7 * 24 * 60 * 60 * 1000; // 7 days
      valid = ageMs <= maxAgeMs;
    }

    cache.set(req.user.id, { valid, ts: now });

    if (!valid) {
      return res.status(401).json({
        error: "Session expired. Please sign in again.",
        code: "session_expired",
      });
    }
    next();
  } catch (err) {
    // On error, allow through but log
    console.error("[session-age] Check failed:", err.message);
    next();
  }
}

/**
 * Clear session age cache for a user (e.g., on logout or force signout).
 */
function clearSessionAgeCache(userId) {
  const cache = checkSessionAge.cache;
  if (cache) cache.delete(userId);
}


module.exports = {
  requireAuth,
  optionalAuth,
  loadProfile,
  requireActiveAccount,
  requireRole,
  // Role constants and normalization
  ROLES,
  normalizeRole,
  ADMIN_ROLES,
  DEPARTMENT_ADMIN_ROLES,
  FACULTY_ROLES,
  ALL_ROLES,
  // Inspection helpers
  getRole,
  hasExactRole,
  isSuperAdmin,
  isAdmin,
  isDepartmentAdmin,
  isFaculty,
  isStudent,
  isSuspendedProfile,
  requireVerified,
  // Privilege ranking (account management)
  ROLE_RANK,
  rankOf,
  getRank,
  canManage,
  // Ready-to-use middleware gates
  requireSuperAdmin,
  requireAdmin,
  requireDepartmentAdmin,
  requireFaculty,
  requireStudent,
  supabase,
  // MFA & Session middleware
  requireAal2,
  checkSessionAge,
  clearSessionAgeCache,
};
