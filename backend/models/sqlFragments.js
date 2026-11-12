/**
 * SQL predicates shared by the admin console and announcement audiences.
 *
 * Both surfaces answer the same question — "which active profiles match this
 * filter?" — so the definition lives here rather than in either model. All
 * three assume the profiles table is aliased `p`.
 */

/** Currently suspended: has a suspension that has not lapsed. */
const SUSPENDED_SQL = `(p.suspended_at IS NOT NULL AND (p.suspended_until IS NULL OR p.suspended_until > NOW()))`;

/** Currently active: never suspended, or the suspension has lapsed. */
const ACTIVE_SQL = `(p.suspended_at IS NULL OR (p.suspended_until IS NOT NULL AND p.suspended_until <= NOW()))`;

/** Role comparison form — `departmentAdmin`, `department_admin` and `department-admin` all match. */
const ROLE_NORMALIZED_SQL = `LOWER(REPLACE(REPLACE(p.role, '_', ''), '-', ''))`;

module.exports = { SUSPENDED_SQL, ACTIVE_SQL, ROLE_NORMALIZED_SQL };
