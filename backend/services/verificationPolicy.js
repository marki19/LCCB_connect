const { normalizeRole, ROLES, SELECTABLE_ROLES, DECLARATION_ROLES } = require("../utils/roles");

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

// ---- choosing a role --------------------------------------------------------

/**
 * True when this account has not picked what it is yet.
 *
 * New accounts start at `'user'` (migration 047) precisely so the choice is made
 * during onboarding, with a verification request behind it, rather than guessed
 * at signup. A null role is the same state: nothing chosen.
 */
function needsRoleChoice(role) {
  const canonical = canonicalRole(role);
  if (canonical === ROLES.GUEST) return false;
  return canonical === null || canonical === ROLES.USER;
}

/** True when `role` is one a new account is allowed to choose. */
function isSelectable(role) {
  return SELECTABLE_ROLES.includes(canonicalRole(role));
}

/**
 * True when this account has a verification path ahead of it, whether or not it
 * has chosen the role yet. Used by the OTP gate, which runs before the role is
 * known: the code proves control of the mailbox either way.
 */
function canVerify(role) {
  return needsRoleChoice(role) || Boolean(fieldsFor(role));
}

/**
 * The role a verification request is filed under.
 *
 * A `'user'` account supplies the role it wants; every other account is fixed by
 * its profile, so a request may repeat that role but never change it.
 *
 * Returns `{ role }` or `{ error }`.
 */
function resolveRequestRole(profileRole, requestedRole) {
  if (!needsRoleChoice(profileRole)) {
    const fixed = canonicalRole(profileRole);
    if (requestedRole != null && canonicalRole(requestedRole) !== fixed) {
      return { error: "Your account type is already set" };
    }
    return { role: fixed };
  }

  const chosen = canonicalRole(requestedRole);
  if (!chosen || !isSelectable(chosen)) {
    return { error: "Choose an account type to verify" };
  }
  return { role: chosen };
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
    roles: [ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN, ROLES.GUEST],
    byDepartment: false,
  },
  [ROLES.ADMIN]: { roles: [ROLES.DEPARTMENT_ADMIN, ROLES.GUEST], byDepartment: false },
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

/**
 * Requests that fall through to campus reviewers when their department has no
 * one who can decide them.
 */
const ESCALATABLE_ROLES = Object.freeze([ROLES.STUDENT, ROLES.FACULTY]);

/** Campus roles that pick up an escalated request. */
const ESCALATION_REVIEWER_ROLES = Object.freeze([ROLES.ADMIN, ROLES.SUPER_ADMIN]);

/** May this reviewer act on a request raised by `requestRole`? */
function canReview({
  reviewerRole,
  reviewerDepartmentId,
  requestRole,
  requestDepartmentId,
  requestEscalated = false,
}) {
  const scope = scopeFor(reviewerRole);
  if (!scope) return false;

  const target = canonicalRole(requestRole);
  if (!target) return false;

  if (scope.roles.includes(target)) {
    if (scope.byDepartment) {
      return Boolean(reviewerDepartmentId) && reviewerDepartmentId === requestDepartmentId;
    }
    return true;
  }

  // A request stranded by an unstaffed department climbs to campus reviewers.
  // Without the escalation stamp it stays out of their queue and out of their
  // reach, so a department that never hired an admin cannot silently swallow it.
  return (
    requestEscalated &&
    ESCALATABLE_ROLES.includes(target) &&
    ESCALATION_REVIEWER_ROLES.includes(canonicalRole(reviewerRole))
  );
}

/**
 * The extra request roles this reviewer picks up once a request is escalated.
 * Empty for everyone who is not a campus reviewer, and for department admins,
 * whose own queue already holds their department's requests.
 */
function escalationRolesFor(reviewerRole) {
  return ESCALATION_REVIEWER_ROLES.includes(canonicalRole(reviewerRole))
    ? ESCALATABLE_ROLES
    : [];
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
  SELECTABLE_ROLES,
  DECLARATION_ROLES,
  needsRoleChoice,
  isSelectable,
  canVerify,
  resolveRequestRole,
  REVIEWER_SCOPE,
  scopeFor,
  reviewableRolesFor,
  reviewsByDepartment,
  canReview,
  ESCALATABLE_ROLES,
  ESCALATION_REVIEWER_ROLES,
  escalationRolesFor,
  reviewersForRequest,
};
