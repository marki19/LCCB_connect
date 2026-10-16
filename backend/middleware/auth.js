const { createClient } = require("@supabase/supabase-js");
const userModel = require("../models/userModel");

/**
 * Supported Roles in LCCB Connect
 * - superAdmin: System-wide owner (all access)
 * - admin: Institution administrator (content & user management)
 * - departmentAdmin: Academic department head/dean (theses & capstone reviews)
 * - faculty: Academic adviser/faculty reviewer
 * - student: Undergraduate/graduate student researcher
 */
const ROLES = {
  SUPER_ADMIN: "superadmin",
  ADMIN: "admin",
  DEPARTMENT_ADMIN: "departmentAdmin",
  FACULTY: "faculty",
  STUDENT: "student",
};

/**
 * Normalizes a role string to lowercase alphanumeric (stripping underscores/dashes)
 * so "superAdmin", "superadmin", "department_admin", "departmentAdmin" match consistently.
 */
function normalizeRole(role) {
  if (!role || typeof role !== "string") return "";
  return role.toLowerCase().replace(/[-_]/g, "");
}

const ADMIN_ROLES = ["admin", "superadmin", "superAdmin"];
const DEPARTMENT_ADMIN_ROLES = ["departmentAdmin", "department_admin", "admin", "superadmin", "superAdmin"];
const FACULTY_ROLES = ["faculty", "departmentAdmin", "department_admin", "admin", "superadmin", "superAdmin"];
const ALL_ROLES = ["student", "faculty", "departmentAdmin", "department_admin", "admin", "superadmin", "superAdmin"];

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

/**
 * Verifies the caller's Supabase access token and attaches `req.user`.
 * Identity is derived ONLY from the verified token — never from the request body.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = data.user; // { id, email, ... } — authoritative identity
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

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = data.user;
    req.accessToken = token;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Loads the caller's `profiles` row into `req.profile`. */
async function loadProfile(req, res, next) {
  try {
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
      return res.status(403).json({ error: "Forbidden: profile not loaded" });
    }
    const userRole = normalizeRole(req.profile.role);
    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        error: "Forbidden: insufficient role permission",
        required: allowedRoles,
        actual: req.profile.role || "student",
      });
    }
    return next();
  };
}

// Composable role security gates
const requireSuperAdmin = [requireAuth, loadProfile, requireRole("superadmin")];
const requireAdmin = [requireAuth, loadProfile, requireRole("admin", "superadmin")];
const requireDepartmentAdmin = [requireAuth, loadProfile, requireRole("departmentAdmin", "admin", "superadmin")];
const requireFaculty = [requireAuth, loadProfile, requireRole("faculty", "departmentAdmin", "admin", "superadmin")];
const requireStudent = [requireAuth, loadProfile, requireRole("student")];

module.exports = {
  requireAuth,
  optionalAuth,
  loadProfile,
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
};
