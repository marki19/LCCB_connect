/**
 * Role normalization utility - no dependencies to avoid circular imports.
 */

/**
 * Normalizes a role string to lowercase alphanumeric (stripping underscores/dashes)
 * so "superAdmin", "superadmin", "department_admin", "departmentAdmin" match consistently.
 */
function normalizeRole(role) {
  if (!role || typeof role !== "string") return "";
  return role.toLowerCase().replace(/[-_]/g, "");
}

const ROLES = {
  SUPER_ADMIN: "superadmin",
  ADMIN: "admin",
  DEPARTMENT_ADMIN: "departmentAdmin",
  FACULTY: "faculty",
  STUDENT: "student",
};

const ADMIN_ROLES = ["admin", "superadmin", "superAdmin"];
const DEPARTMENT_ADMIN_ROLES = [
  "departmentAdmin",
  "department_admin",
  "admin",
  "superadmin",
  "superAdmin",
];
const FACULTY_ROLES = [
  "faculty",
  "departmentAdmin",
  "department_admin",
  "admin",
  "superadmin",
  "superAdmin",
];
const ALL_ROLES = [
  "student",
  "faculty",
  "departmentAdmin",
  "department_admin",
  "admin",
  "superadmin",
  "superAdmin",
];

module.exports = {
  normalizeRole,
  ROLES,
  ADMIN_ROLES,
  DEPARTMENT_ADMIN_ROLES,
  FACULTY_ROLES,
  ALL_ROLES,
};