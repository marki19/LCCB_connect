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
 * A bucket-relative storage object key, for example `posts/1/2.jpg`.
 *
 * The API stores *only* the object key, never the full public URL, so the
 * database can be rendered with the names the files actually have. Unsafe
 * paths and arbitrary external URLs are rejected.
 */
const StorageKey = z
  .string()
  .trim()
  .max(512)
  .refine(
    (value) =>
      /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+$/.test(value) &&
      !value.includes("..") &&
      !/^https?:\/\//i.test(value) &&
      !/^file:/i.test(value),
    "Must be a storage object key"
  );

const optionalText = (max) => z.string().trim().max(max).nullable().optional();
const optionalUrl = () => HttpUrl.nullable().optional();
const optionalStorageUrl = () => StorageKey.nullable().optional();
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

// ---- content visibility (posts & theses) -----------------------------------
// The enforcement lives in `visible_posts()` / `visible_theses()` in Postgres
// (migration 014); these schemas only validate what a client may ask for.
// `custom` must carry an explicit, non-empty audience.
const Visibility = z.enum(["public", "friends", "custom", "private"]);
const Audience = z.array(z.string().uuid()).max(500);

const withCustomAudienceRule = (schema) =>
  schema.superRefine((value, ctx) => {
    if (
      value.visibility === "custom" &&
      !(Array.isArray(value.audience) && value.audience.length > 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["audience"],
        message: "A custom-visibility item needs at least one friend in its audience",
      });
    }
  });

// ---- posts -----------------------------------------------------------------
const postFields = {
  content: z.string().max(5000).nullable().optional(),
  type: z.enum(["text", "image", "project", "capstone", "website"]).optional(),
  title: optionalText(200),
  technologies: stringArray(30, 40),
  github_url: optionalUrl(),
  image_url: optionalStorageUrl(),
  preview_metadata: previewMetadataSchema,
  visibility: Visibility.optional(),
  audience: Audience.optional(),
};

const createPostSchema = withCustomAudienceRule(z.object(postFields).strict());
const updatePostSchema = withCustomAudienceRule(z.object(postFields).strict());

// ---- comments --------------------------------------------------------------
const createCommentSchema = z
  .object({ content: z.string().trim().min(1).max(2000) })
  .strict();

// Author edit: same shape as creation — identity is never accepted from the
// body, so `.strict()` rejects an attempted `user_id`/`post_id` override.
const updateCommentSchema = z
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
  pdf_url: StorageKey,
  visibility: Visibility.optional(),
  audience: Audience.optional(),
};

const createThesisSchema = withCustomAudienceRule(
  z.object(thesisFields).strict()
);
const updateThesisSchema = withCustomAudienceRule(
  z.object(thesisFields).partial().strict()
);

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

// ---- identity verification (migration 016) ----------------------------------
// Student ID: 4-20 chars of [A-Za-z0-9-], stored uppercased. No roster exists
// to validate against, so the admin review *is* the identity check.
const studentIdSchema = z
  .string()
  .trim()
  .min(4, "Student ID must be at least 4 characters")
  .max(20, "Student ID must be at most 20 characters")
  .regex(/^[A-Za-z0-9-]+$/, "Student ID may only contain letters, numbers, and hyphens")
  .transform((v) => v.toUpperCase());

const verificationSubmitSchema = z
  .object({
    full_name: z.string().trim().min(2, "Full name must be at least 2 characters").max(200),
    student_id: studentIdSchema,
    department_id: requiredUuid(),
    course_id: requiredUuid(),
    year_level: z.string().trim().min(1).max(50),
    birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Birthdate must be YYYY-MM-DD").refine((d) => {
      const date = new Date(d);
      const today = new Date();
      return date < today && date > new Date("1900-01-01");
    }, "Birthdate must be a valid past date"),
  })
  .strict();

// Used by the decline endpoint only: the note is optional but, when present,
// must explain why so the student can fix and resubmit.
const verificationDecisionSchema = z
  .object({
    note: z.string().trim().min(3, "Give a reason of at least 3 characters").max(300),
  })
  .strict();

// Login identifier: email or student ID. Branching on "@" happens in the
// controller, so the schema accepts either shape. Bounds are deliberately loose:
// a malformed password must fall through to the generic 401, not a validation
// error that tells the caller their guess was the right shape.
const loginIdentifierSchema = z
  .object({
    identifier: z.string().trim().min(1).max(254),
    password: z.string().min(1).max(200),
  })
  .strict();

// Signup OTP verification. The password is re-submitted here and compared
// against the bcrypt hash captured at request time: nothing decryptable is ever
// stored, and the hash cannot be replayed as the password.
const verifySignupSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[^@\s]+@lccbonline\.edu\.ph$/,
        "Must be an @lccbonline.edu.ph address"
      ),
    token: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
    password: z.string().min(1).max(72),
  })
  .strict();

// Resend signup OTP: same email validation as signup verification.
const resendSignupSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[^@\s]+@lccbonline\.edu\.ph$/,
        "Must be an @lccbonline.edu.ph address"
      ),
  })
  .strict();

/**
 * Request signup: stores a pending row and sends the code.
 * The password is bcrypt-hashed before it touches the database.
 */
const requestSignupSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[^@\s]+@lccbonline\.edu\.ph$/,
        "Must be an @lccbonline.edu.ph address"
      ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password too long"),
    full_name: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(200, "Full name too long"),
  })
  .strict();

/**
 * MFA challenge: verifies a TOTP code during login.
 * Uses a short-lived challenge token returned by the first-factor login.
 */
const mfaChallengeSchema = z
  .object({
    challenge_token: z.string().min(1),
    code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
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

// ---- messaging, friends & social settings (Messaging_plan.md §4–§11) -------
// Identity (sender_id / recipient_id / user_id) is never accepted here: it comes
// from the verified token. `.strict()` rejects an attempted override.

const createConversationSchema = z.object({ peer_id: requiredUuid() }).strict();

const sendMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(4000),
    client_msg_id: z.string().uuid(),
  })
  .strict();

const markReadSchema = z.object({ upto_seq: z.number().int().min(0) }).strict();

// `mute_minutes: null` clears the mute (see messageModel.muteConversation).
const muteConversationSchema = z
  .object({ mute_minutes: z.number().int().min(1).max(525600).nullable() })
  .strict();

const reportMessageSchema = z
  .object({ reason: z.string().trim().max(500).optional() })
  .strict();

const messagePolicySchema = z
  .object({
    message_policy: z.enum(["everyone", "department", "selected", "nobody"]),
    department_ids: z.array(z.string().uuid()).max(200).optional(),
  })
  .strict();

const presenceModes = ["online", "away", "busy", "dnd", "invisible"];

const presenceSchema = z.object({ mode: z.enum(presenceModes) }).strict();

const heartbeatSchema = z
  .object({
    mode: z.enum(presenceModes).optional(),
    last_seen_visible: z.boolean().optional(),
  })
  .strict();

const deviceTokenSchema = z
  .object({
    token: z.string().trim().min(1).max(500),
    platform: z.enum(["ios", "android", "web"]),
  })
  .strict();

const deleteDeviceTokenSchema = z
  .object({ token: z.string().trim().min(1).max(500) })
  .strict();

const friendRequestSchema = z.object({ addressee_id: requiredUuid() }).strict();

// ---- admin console (SPEC-superadmin-console.md) ----------------------------
const CanonicalRole = z.enum([
  "student",
  "faculty",
  "departmentAdmin",
  "admin",
  "superadmin",
]);

const reasonField = z.string().trim().min(3, "Give a reason of at least 3 characters").max(500);

const roleChangeSchema = z
  .object({ role: CanonicalRole, reason: reasonField })
  .strict();

const suspendUserSchema = z
  .object({
    reason: reasonField,
    until: z.string().trim().datetime({ offset: true }).nullable().optional(),
  })
  .strict();

const reasonBodySchema = z.object({ reason: reasonField }).strict();

// Account deletion removed per policy. Manual DB query only.

const announcementAudienceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all") }).strict(),
  z.object({ type: z.literal("role"), role: CanonicalRole }).strict(),
  z
    .object({ type: z.literal("department"), department_id: requiredUuid() })
    .strict(),
]);

const announcementSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    body: z.string().trim().min(3).max(2000),
    audience: announcementAudienceSchema,
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

  /**
   * Brevo webhook payload validation.
   * POST /api/email/webhook/brevo
   */
  const brevoWebhookSchema = z
    .object({
      event: z.string(), // "bounce"
      email: z.string().email(),
      reason: z.string().optional(),
      code: z.union([z.string(), z.number()]).optional(),
      type: z.string().optional(), // "hard" | "soft"
      timestamp: z.number().optional(),
    })
    .strict();

  module.exports = {
  validate,
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  updateCommentSchema,
  createThesisSchema,
  updateThesisSchema,
  createProfileSchema,
  updateProfileSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  createCourseSchema,
  updateCourseSchema,
  createConversationSchema,
  sendMessageSchema,
  markReadSchema,
  muteConversationSchema,
  reportMessageSchema,
  messagePolicySchema,
  presenceSchema,
  heartbeatSchema,
  deviceTokenSchema,
  deleteDeviceTokenSchema,
  friendRequestSchema,
  roleChangeSchema,
  suspendUserSchema,
  reasonBodySchema,
  announcementSchema,
  studentIdSchema,
  verificationSubmitSchema,
  verificationDecisionSchema,
  loginIdentifierSchema,
  verifySignupSchema,
  resendSignupSchema,
  requestSignupSchema,
    brevoWebhookSchema,
    mfaChallengeSchema,
  };
