const { normalizeRole, ROLES } = require("../utils/roles");

/**
 * Verification policy: who may be verified, what each role must prove, and who
 * reviews the result.
 *
 * Three tables, one home. The queue, the notification fan-out and the
 * approve/decline gate all read from here, so they cannot drift apart:
 *
 *   ROLE_FIELDS      which form a role fills in (and what it must supply)
 *   REVIEWER_SCOPE   who may act on a request raised by each role
 *   canReview()      the single-row version of REVIEWER_SCOPE, used per request
 *
 * Roles are stored canonically ('departmentAdmin', not 'departmentadmin') because
 * the database CHECK constraint in 042 uses those exact strings. Comparisons
 * normalize, so 'department_admin' still matches.
 */

const CANONICAL_ROLE = new Map(Object.values(ROLES).map((role) => [normalizeRole(role), role]));

/** Canonical spelling of a role, or null if it is not one we know. */
function canonicalRole(role) {
  return CANONICAL_ROLE.get(normalizeRole(role)) || null;
}

/** Only school accounts may verify, so only they can be used in the app. */
const SCHOOL_EMAIL_DOMAIN = "@lccbonline.edu.ph";

function isSchoolAccount(email) {
  return (
    typeof email === "string" && email.trim().toLowerCase().endsWith(SCHOOL_EMAIL_DOMAIN)
  );
}

/**
 * The fields each role's verification form carries.
 *
 * Students prove a full academic identity; staff prove employment. `department`
 * is part of every staff form because it scopes who reviews them. Admin and
 * superadmin forms carry no catalog fields at all — and superadmin is absent
 * entirely, because superadmins never verify.
 */
const ROLE_FIELDS = {
  [ROLES.STUDENT]: { department: true, course: true, yearLevel: true },
  [ROLES.FACULTY]: { department: true, course: false, yearLevel: false },
  [ROLES.DEPARTMENT_ADMIN]: { department: true, course: false, yearLevel: false },
  [ROLES.ADMIN]: { department: false, course: false, yearLevel: false },
};

/** The form shape for a role, or null when the role never verifies. */
function fieldsFor(role) {
  return ROLE_FIELDS[canonicalRole(role)] || null;
}

/**
 * Who reviews whom.
 *
 *   superadmin        never verifies; reviews admin and department-admin requests
 *   admin             reviewed by superadmins
 *   departmentAdmin   reviewed by superadmins and admins
 *   faculty           reviewed by department admins, own department only
 *   student           reviewed by department admins, own department only
 *
 * The sets are exclusive, exactly as the policy states: an admin's request is
 * only a superadmin's to decide, so one admin can never clear another. The same
 * table drives the notification fan-out, so nobody is told about a request they
 * cannot act on.
 *
 * `byDepartment: true` means the reviewer must share the requester's department.
 */
const REVIEWER_SCOPE = {
  [ROLES.SUPER_ADMIN]: {
    roles: [ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN],
    byDepartment: false,
  },
  [ROLES.ADMIN]: { roles: [ROLES.DEPARTMENT_ADMIN], byDepartment: false },
  [ROLES.DEPARTMENT_ADMIN]: {
    roles: [ROLES.FACULTY, ROLES.STUDENT],
    byDepartment: true,
  },
};

/** The scope a reviewer role operates under, or null if it reviews nothing. */
function scopeFor(role) {
  return REVIEWER_SCOPE[canonicalRole(role)] || null;
}

/**
 * Canonical roles a reviewer may act on, or null when the role reviews nothing.
 * Drives the queue filter.
 */
function reviewableRolesFor(reviewerRole) {
  const scope = scopeFor(reviewerRole);
  return scope ? scope.roles : null;
}

/** True when this reviewer's queue is confined to their own department. */
function reviewsByDepartment(reviewerRole) {
  const scope = scopeFor(reviewerRole);
  return scope ? scope.byDepartment : false;
}

/** May this reviewer act on a request raised by `requestRole`? */
function canReview({ reviewerRole, reviewerDepartmentId, requestRole, requestDepartmentId }) {
  const scope = scopeFor(reviewerRole);
  if (!scope) return false;

  const target = canonicalRole(requestRole);
  if (!target || !scope.roles.includes(target)) return false;

  if (scope.byDepartment) {
    return Boolean(reviewerDepartmentId) && reviewerDepartmentId === requestDepartmentId;
  }
  return true;
}

/**
 * The reviewer groups for a request, split by how they are scoped so the model
 * can resolve them in one query:
 *
 *   campusRoles      every profile with one of these roles, anywhere
 *   departmentRoles  profiles with one of these roles *and* the requester's
 *                    department
 */
function reviewersForRequest(requestRole) {
  const target = canonicalRole(requestRole);
  const groups = Object.entries(REVIEWER_SCOPE).filter(([, scope]) =>
    scope.roles.includes(target)
  );

  return {
    campusRoles: groups.filter(([, s]) => !s.byDepartment).map(([role]) => role),
    departmentRoles: groups.filter(([, s]) => s.byDepartment).map(([role]) => role),
  };
}

module.exports = {
  SCHOOL_EMAIL_DOMAIN,
  isSchoolAccount,
  canonicalRole,
  ROLE_FIELDS,
  fieldsFor,
  REVIEWER_SCOPE,
  scopeFor,
  reviewableRolesFor,
  reviewsByDepartment,
  canReview,
  reviewersForRequest,
};
