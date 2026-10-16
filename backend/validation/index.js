const { z } = require("zod");

/**
 * Request body schemas + a `validate` middleware.
 *
 * Rules (see Security_plan.md Phase 4):
 *  - every write endpoint declares an explicit shape;
 *  - unknown keys are rejected (`.strict()`), which blocks attempts to inject
 *    `author_id` / `user_id` / `uploader_id` / `role` / `id`;
 *  - identity is never accepted from the body — it is derived from the verified
 *    token in the controllers.
 */

/** http(s) URL only (blocks `javascript:`, `data:`, etc.). */
const HttpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be a valid http(s) URL");

/**
 * A URL that points inside THIS project's Supabase Storage. File columns
 * (`image_url`, `avatar_url`, `pdf_url`) must not accept arbitrary external
 * URLs — otherwise a caller can point them at any host (and a later consumer
 * might fetch it, turning that into SSRF).
 */
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const StorageUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) =>
      SUPABASE_URL !== "" && value.startsWith(`${SUPABASE_URL}/storage/v1/object/`),
    "Must be a URL in this project's storage"
  );

const optionalText = (max) => z.string().trim().max(max).nullable().optional();
const optionalUrl = () => HttpUrl.nullable().optional();
const optionalStorageUrl = () => StorageUrl.nullable().optional();
const stringArray = (maxItems, maxLen) =>
  z.array(z.string().trim().max(maxLen)).max(maxItems).nullable().optional();

/** UUID shape (catalog + profile references). */
const optionalUuid = () => z.string().uuid().nullable().optional();
const requiredUuid = () => z.string().uuid();

const previewMetadataSchema = z
  .object({
    title: z.string().max(300).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    image: HttpUrl.nullable().optional(),
    url: HttpUrl,
  })
  .strict()
  .nullable()
  .optional();

// ---- posts -----------------------------------------------------------------
const postFields = {
  content: z.string().max(5000).nullable().optional(),
  type: z.enum(["text", "image", "project", "capstone", "website"]).optional(),
  title: optionalText(200),
  technologies: stringArray(30, 40),
  github_url: optionalUrl(),
  image_url: optionalStorageUrl(),
  preview_metadata: previewMetadataSchema,
};

const createPostSchema = z.object(postFields).strict();
const updatePostSchema = z.object(postFields).strict();

// ---- comments --------------------------------------------------------------
const createCommentSchema = z
  .object({ content: z.string().trim().min(1).max(2000) })
  .strict();

// ---- theses ----------------------------------------------------------------
// `department` is deliberately absent: it is derived server-side from the
// uploader's profile, so a caller cannot attribute a thesis to another
// department (`.strict()` rejects an attempted `department` field).
const thesisFields = {
  title: z.string().trim().min(1).max(300),
  abstract: z.string().trim().min(1).max(10000),
  category: z.string().trim().min(1).max(100),
  pdf_url: StorageUrl,
};

const createThesisSchema = z.object(thesisFields).strict();
const updateThesisSchema = z.object(thesisFields).partial().strict();

// ---- catalog: departments & courses (admin-managed runtime data) -----------
const departmentFields = {
  name: z.string().trim().min(1).max(200),
  code: optionalText(20),
  sort_order: z.number().int().min(0).max(100000).optional(),
};

const createDepartmentSchema = z.object(departmentFields).strict();
const updateDepartmentSchema = z.object(departmentFields).partial().strict();

const courseFields = {
  department_id: requiredUuid(),
  name: z.string().trim().min(1).max(200),
  code: optionalText(20),
  sort_order: z.number().int().min(0).max(100000).optional(),
};

const createCourseSchema = z.object(courseFields).strict();
const updateCourseSchema = z
  .object({
    department_id: requiredUuid().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    code: optionalText(20),
    sort_order: z.number().int().min(0).max(100000).optional(),
  })
  .strict();

// ---- profiles --------------------------------------------------------------
const profileFields = {
  username: optionalText(50),
  full_name: optionalText(200),
  avatar_url: optionalStorageUrl(),
  bio: optionalText(1000),
  course: optionalText(100),
  year_level: optionalText(50),
  skills: stringArray(30, 40),
  // Catalog references. A non-admin may CLAIM these once while unset (the
  // profile-completion gate); changing an existing value is admin-only, which
  // the controller enforces.
  department_id: optionalUuid(),
  course_id: optionalUuid(),
};

// Self-provisioning: no `role`/`id` accepted (server assigns them).
const createProfileSchema = z.object(profileFields).strict();

// Profile edit: `role` is allowed through the schema so admins can change it;
// the controller strips it for non-admins.
const updateProfileSchema = z
  .object({
    ...profileFields,
    role: z
      .enum([
        "student",
        "faculty",
        "departmentAdmin",
        "department_admin",
        "admin",
        "superadmin",
        "superAdmin",
      ])
      .optional(),
    // Per-user "who can message me" preference (Messaging_plan.md §4).
    message_policy: z.enum(["everyone", "department", "selected", "nobody"]).optional(),
  })
  .strict();

/**
 * Validates `req.body` against `schema`. On success the parsed (typed, trimmed)
 * value replaces `req.body`. On failure returns 400 with per-field messages and
 * never touches the database.
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    // `unrecognized_keys` carries an empty path, so expand it into one entry per
    // rejected key — the caller needs to know exactly which key was refused.
    const fields = result.error.issues.flatMap((issue) => {
      if (issue.code === "unrecognized_keys" && Array.isArray(issue.keys)) {
        return issue.keys.map((key) => ({
          path: key,
          message: `Unrecognized key: "${key}" is not accepted here`,
        }));
      }
      return [{ path: issue.path.join(".") || "(root)", message: issue.message }];
    });

    return res.status(400).json({ error: "Validation failed", fields });
  }
  req.body = result.data;
  return next();
};

module.exports = {
  validate,
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  createThesisSchema,
  updateThesisSchema,
  createProfileSchema,
  updateProfileSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  createCourseSchema,
  updateCourseSchema,
};
