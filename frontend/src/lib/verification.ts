/**
 * Verification types and client-side helpers.
 *
 * The backend owns the authoritative form shape in
 * `services/verificationPolicy.js` (ROLE_FIELDS, fieldsFor). The client fetches
 * that shape from `GET /api/verification/mine` → `fields` and renders exactly
 * what the server says the role proves. No duplicate tables, no drift.
 */

import type { Department, Course } from "../types";

/** The canonical role vocabulary the server uses. */
export type VerificationRole =
  | "student"
  | "faculty"
  | "departmentAdmin"
  | "admin"
  | "superadmin";

/** Which fields a role's form carries. Mirrors `ROLE_FIELDS` on the server. */
export interface VerificationFields {
  department: boolean;
  course: boolean;
  yearLevel: boolean;
}

/** Full payload the server returns from GET /verification/mine. */
export interface VerificationMineResponse {
  request: VerificationRequest | null;
  can_resubmit: boolean;
  /** The authoritative form shape for the caller's role. */
  fields: VerificationFields | null;
  /** True when the caller's email ends with @lccbonline.edu.ph. */
  school_account: boolean;
}

/** A stored verification request (what the queue and /mine return). */
export interface VerificationRequest {
  id: string;
  user_id: string;
  role: VerificationRole;
  full_name: string;
  student_id: string;
  department_id?: string | null;
  department_name?: string | null;
  course_id?: string | null;
  course_name?: string | null;
  year_level?: string | null;
  birthdate?: string | null;
  status: "pending" | "approved" | "declined";
  note?: string | null;
  submitted_at: string;
  decided_at?: string | null;
  decided_by_name?: string | null;
}

/** Submit payload (body for POST /verification and PUT /verification/mine). */
export interface VerificationSubmitPayload {
  full_name: string;
  student_id: string;
  department_id?: string | null;
  course_id?: string | null;
  year_level?: string | null;
  birthdate: string;
  otp_code: string;
}

/** One field definition the form renders. */
export interface VerificationFieldDef {
  key: keyof VerificationSubmitPayload;
  label: string;
  placeholder: string;
  required: boolean;
  /** Regex the value must match (for the ID fields). */
  pattern?: RegExp;
  /** Human-readable pattern hint for the error message. */
  patternHint?: string;
  /** SelectField options — populated at render time for department/course/year. */
  options?: { label: string; value: string }[];
  /** Keyboard/type specifics. */
  keyboardType?: "default" | "numbers-and-punctuation" | "email-address";
  autoCapitalize?: "words" | "characters" | "none";
  /** Whether the field is disabled because it's locked from the profile. */
  locked?: boolean;
  /** Hint shown under the field when locked. */
  lockHint?: string;
}

/**
 * Builds the field definitions for a role, using the server's `fields` object
 * and the live catalog data (departments/courses). The caller decides whether
 * a field is locked (e.g. full_name locked after first submission).
 */
export function buildFieldDefs(
  fields: VerificationFields | null,
  role: VerificationRole,
  depts: Department[],
  courses: Course[],
  academicLevels: string[],
  lockedFullName = false
): VerificationFieldDef[] {
  if (!fields) return [];

  const defs: VerificationFieldDef[] = [];

  // Full name — always required, locked after first verification
  defs.push({
    key: "full_name",
    label: "Full name",
    placeholder: "Juan Dela Cruz",
    required: true,
    autoCapitalize: "words",
    locked: lockedFullName,
    lockHint: lockedFullName
      ? "Locked to the name on your school record."
      : undefined,
  });

  // Student ID / Staff ID — label and pattern depend on role
  const isStudent = role === "student";
  const isStaff = role === "faculty" || role === "departmentAdmin";

  defs.push({
    key: "student_id",
    label: isStudent ? "Student ID" : isStaff ? "School ID" : "ID number",
    placeholder: isStudent ? "2023-12345" : isStaff ? "ADM-00123" : "ADM-00123",
    required: true,
    pattern: isStudent
      ? /^[A-Za-z0-9-]{4,20}$/
      : /^[A-Z]{2,4}-\d{4,8}$/,
    patternHint: isStudent
      ? "4–20 letters, numbers, or hyphens"
      : "Format like ADM-00123",
    autoCapitalize: "characters",
  });

  // Department — required for student, faculty, departmentAdmin
  if (fields.department) {
    defs.push({
      key: "department_id",
      label: "Department",
      placeholder: "Select department",
      required: true,
      options: depts.map((d) => ({ label: d.name, value: d.id })),
    });
  }

  // Course — required for student only
  if (fields.course) {
    defs.push({
      key: "course_id",
      label: "Course",
      placeholder: "Select course",
      required: true,
      options: courses.map((c) => ({ label: c.name, value: c.id })),
    });
  }

  // Year level — required for student only
  if (fields.yearLevel) {
    defs.push({
      key: "year_level",
      label: "Year level",
      placeholder: "Select year level",
      required: true,
      options: academicLevels.map((l) => ({ label: l, value: l })),
    });
  }

  // Birthdate — always required
  defs.push({
    key: "birthdate",
    label: "Birthdate",
    placeholder: "2000-01-15",
    required: true,
    keyboardType: "numbers-and-punctuation",
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    patternHint: "Format: YYYY-MM-DD",
    autoCapitalize: "none",
  });

  return defs;
}

/**
 * Validates a single field value against its definition. Returns an error
 * message or null if valid.
 */
export function validateField(def: VerificationFieldDef, value: string): string | null {
  const trimmed = value.trim();

  if (def.required && !trimmed) {
    return `${def.label} is required`;
  }
  if (!trimmed) return null;

  if (def.pattern && !def.pattern.test(trimmed)) {
    return `${def.label} ${def.patternHint ? `(${def.patternHint})` : "is invalid"}`;
  }

  // Birthdate calendar validation
  if (def.key === "birthdate") {
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return "Birthdate must be YYYY-MM-DD";
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    if (month < 1 || month > 12) return "Invalid month (01–12)";
    if (day < 1 || day > 31) return "Invalid day (01–31)";
    const testDate = new Date(year, month - 1, day);
    if (
      testDate.getFullYear() !== year ||
      testDate.getMonth() !== month - 1 ||
      testDate.getDate() !== day
    ) {
      return "Invalid calendar date (e.g. Feb 30 does not exist)";
    }
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear - 5) {
      return `Year must be between 1900 and ${currentYear - 5}`;
    }
  }

  return null;
}

/**
 * Validates the entire submit payload. Returns an object of fieldKey → error
 * for any invalid fields; empty object means all valid.
 */
export function validateAll(
  defs: VerificationFieldDef[],
  values: Partial<VerificationSubmitPayload>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const def of defs) {
    const err = validateField(def, values[def.key] ?? "");
    if (err) errors[def.key] = err;
  }
  return errors;
}