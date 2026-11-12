const verificationModel = require("../models/verificationModel");
const verificationOtpModel = require("../models/verificationOtpModel");
const userModel = require("../models/userModel");
const departmentModel = require("../models/departmentModel");
const { validateCatalogReferences } = require("./userController");
const notificationService = require("../services/notificationService");
const emailService = require("../services/emailService");
const auditService = require("../services/auditService");
const policy = require("../services/verificationPolicy");

const { ACTIONS } = auditService;

/**
 * Identity verification.
 *
 * Every role proves who they are against their school account, but the evidence
 * differs: students supply a full academic identity, staff supply employment
 * details, and campus admins supply only name/ID/birthdate. `verificationPolicy`
 * owns that table; this controller only enforces it.
 *
 * The emailed code is the first gate and the reviewer is the second. Neither
 * replaces the other: the code proves control of the school mailbox, the reviewer
 * proves the ID belongs to that person.
 */

// ---- shared helpers ---------------------------------------------------------

/**
 * Builds the stored snapshot from the request body, keeping only the fields the
 * caller's role actually proves. A faculty form that also sends a course is
 * silently reduced to the staff shape rather than failing the database CHECK.
 *
 * Returns `{ snapshot }` or `{ error }`.
 */
function snapshotFor(role, body) {
  const fields = policy.fieldsFor(role);
  if (!fields) return { error: "This account does not verify" };

  const snapshot = {
    role: policy.canonicalRole(role),
    full_name: body.full_name,
    student_id: body.student_id,
    birthdate: body.birthdate,
    department_id: fields.department ? body.department_id || null : null,
    course_id: fields.course ? body.course_id || null : null,
    year_level: fields.yearLevel ? body.year_level || null : null,
  };

  if (fields.department && !snapshot.department_id) {
    return { error: "Select your department" };
  }
  if (fields.course && !snapshot.course_id) {
    return { error: "Select your course" };
  }
  if (fields.yearLevel && !snapshot.year_level) {
    return { error: "Select your year level" };
  }
  return { snapshot };
}

/**
 * Checks the caller's role and school account before anything is emailed or
 * stored. Returns an error message, or null when the caller may verify.
 */
function verifiableAccountError(profile) {
  if (!policy.fieldsFor(profile?.role)) {
    return "Superadmin accounts are not verified";
  }
  if (!policy.isSchoolAccount(profile?.email)) {
    return `Verification is only available to ${policy.SCHOOL_EMAIL_DOMAIN} accounts`;
  }
  return null;
}

/** True when the profile already carries the identity its role has to prove. */
function identityComplete(profile) {
  const fields = policy.fieldsFor(profile?.role);
  if (!fields || !profile.full_name || !profile.student_id) return false;
  if (fields.department && !profile.department_id) return false;
  if (fields.course && !profile.course_id) return false;
  if (fields.yearLevel && !profile.year_level) return false;
  return true;
}

/**
 * Verifies and burns the submitted code. On failure the response is already
 * sent, so the caller just returns.
 */
async function requireVerifiedCode(req, res) {
  const result = await verificationOtpModel.verifyAndConsume({
    userId: req.user.id,
    email: req.profile?.email,
    code: req.body.otp_code,
  });
  if (result.ok) return true;

  switch (result.reason) {
    case "too_many":
      res.status(429).json({ error: "Too many incorrect codes. Request a new one." });
      return false;
    case "mismatch":
      res.status(400).json({
        error: "That code is incorrect",
        attempts_left: Math.max(result.attemptsLeft ?? 0, 0),
      });
      return false;
    default:
      res.status(400).json({ error: "That code has expired. Request a new one." });
      return false;
  }
}

/**
 * Resolves what the caller may review. Returns `{ error, status }` when they
 * review nothing, otherwise `{ roles, departmentId }` — `departmentId` is null
 * for campus-wide reviewers.
 */
function reviewerContext(profile) {
  const roles = policy.reviewableRolesFor(profile?.role);
  if (!roles) {
    return { status: 403, error: "You are not a verification reviewer" };
  }
  if (!policy.reviewsByDepartment(profile?.role)) {
    return { roles, departmentId: null };
  }
  if (!profile?.department_id) {
    return { status: 403, error: "Your account has no department assigned" };
  }
  return { roles, departmentId: profile.department_id };
}

/** Notifies everyone the matrix says may act on this request. */
async function notifyReviewers(request) {
  const groups = policy.reviewersForRequest(request.role);
  const reviewers = await verificationModel.resolveReviewers({
    campusRoles: groups.campusRoles,
    departmentRoles: groups.departmentRoles,
    departmentId: request.department_id,
  });
  if (reviewers.length === 0) return;

  await notificationService.createNotifications(
    reviewers.map((r) => r.id),
    {
      actorId: request.user_id,
      type: "verification_submitted",
      targetId: request.id,
      departmentId: request.department_id,
      departmentName: reviewers[0]?.department_name || null,
      message: `${request.full_name} submitted an identity verification request.`,
    }
  );
}

// ---- self-service -----------------------------------------------------------

/** POST /api/verification/otp — email a code to the caller's school account. */
const sendOtp = async (req, res, next) => {
  try {
    const error = verifiableAccountError(req.profile);
    if (error) return res.status(403).json({ error });

    const email = req.profile.email.trim().toLowerCase();
    const { code, expiresAt } = await verificationOtpModel.issue({
      userId: req.user.id,
      email,
    });

    await emailService.sendOtpEmail({
      to: email,
      otpCode: code,
      fullName: req.profile.full_name,
      expiresMinutes: verificationOtpModel.expiresInMinutes(),
    });

    res.status(202).json({
      message: "Verification code sent to your school account",
      expires_at: expiresAt,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/verification — submit a new request or upsert pending. */
const submit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profile = req.profile;

    const accountError = verifiableAccountError(profile);
    if (accountError) return res.status(403).json({ error: accountError });

    if (profile.verification_status === "verified" && identityComplete(profile)) {
      return res.status(409).json({ error: "Your account is already verified" });
    }

    const { snapshot, error } = snapshotFor(profile.role, req.body);
    if (error) return res.status(400).json({ error });

    if (!(await requireVerifiedCode(req, res))) return;

    // Only the catalog fields this role carries; validateCatalogReferences
    // ignores the ones that are null.
    const refError = await validateCatalogReferences({
      department_id: snapshot.department_id,
      course_id: snapshot.course_id,
    });
    if (refError) return res.status(400).json({ error: refError });

    let request;
    try {
      request = await verificationModel.createPending(userId, snapshot);
    } catch (err) {
      if (err?.code === "23505") {
        return res.status(409).json({ error: "You already have a request under review" });
      }
      throw err;
    }

    // Mirror the identity onto the profile and mark it pending. Absent fields
    // are left alone (updateUser COALESCEs), so a staff approval cannot wipe a
    // catalog value the form never asked for.
    await userModel.updateUser(userId, {
      full_name: snapshot.full_name,
      student_id: snapshot.student_id,
      department_id: snapshot.department_id,
      course_id: snapshot.course_id,
      year_level: snapshot.year_level,
      verification_status: "pending",
    });

    await auditService.recordRequest(req, {
      action: ACTIONS.VERIFICATION_SUBMIT,
      targetType: "verification_request",
      targetId: request.id,
      targetLabel: `${snapshot.full_name} (${snapshot.student_id})`,
      metadata: { role: snapshot.role },
    });

    await notifyReviewers(request);

    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
};

/** PUT /api/verification/mine — update a pending request (fix and resubmit). */
const updateMine = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profile = req.profile;

    const accountError = verifiableAccountError(profile);
    if (accountError) return res.status(403).json({ error: accountError });

    const existing = await verificationModel.getLatestForUser(userId);
    if (!existing || existing.status !== "pending") {
      return res.status(404).json({ error: "No pending request to update" });
    }

    const { snapshot, error } = snapshotFor(profile.role, req.body);
    if (error) return res.status(400).json({ error });

    if (!(await requireVerifiedCode(req, res))) return;

    const refError = await validateCatalogReferences({
      department_id: snapshot.department_id,
      course_id: snapshot.course_id,
    });
    if (refError) return res.status(400).json({ error: refError });

    const request = await verificationModel.updatePending(userId, snapshot);
    if (!request) {
      return res.status(404).json({ error: "No pending request to update" });
    }

    await auditService.recordRequest(req, {
      action: ACTIONS.VERIFICATION_SUBMIT,
      targetType: "verification_request",
      targetId: request.id,
      targetLabel: `${snapshot.full_name} (${snapshot.student_id})`,
      metadata: { role: snapshot.role, resubmission: true },
    });

    res.json(request);
  } catch (err) {
    next(err);
  }
};

/** GET /api/verification/mine — caller's latest request, plus the form shape. */
const getMine = async (req, res, next) => {
  try {
    const request = await verificationModel.getLatestForUser(req.user.id);
    const fields = policy.fieldsFor(req.profile?.role);

    res.json({
      request,
      can_resubmit: !request || request.status === "declined",
      // The authoritative form shape for the caller's role, so the client does
      // not have to keep its own copy of which fields each role proves.
      fields,
      school_account: policy.isSchoolAccount(req.profile?.email),
    });
  } catch (err) {
    next(err);
  }
};

// ---- review -----------------------------------------------------------------

/** GET /api/verification/queue — the requests this reviewer may act on. */
const queue = async (req, res, next) => {
  try {
    const context = reviewerContext(req.profile);
    if (context.error) {
      return res.status(context.status).json({ error: context.error });
    }

    const status = req.query.status || null; // pending | approved | declined
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10) || 50, 1), 100);
    const cursor = req.query.cursor || null;

    const rows = await verificationModel.listQueue({
      roles: context.roles,
      departmentId: context.departmentId,
      status,
      limit,
      cursor,
    });

    res.json({ requests: rows });
  } catch (err) {
    next(err);
  }
};

/**
 * Shared front half of approve/decline: load the request and confirm the caller
 * may act on it. Returns the request, or sends the error and returns null.
 */
async function authorizeReview(req, res) {
  const request = await verificationModel.getById(req.params.id);
  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return null;
  }
  if (request.status !== "pending") {
    res.status(409).json({ error: "Request is no longer pending" });
    return null;
  }

  const allowed = policy.canReview({
    reviewerRole: req.profile?.role,
    reviewerDepartmentId: req.profile?.department_id,
    requestRole: request.role,
    requestDepartmentId: request.department_id,
  });
  if (!allowed) {
    res.status(403).json({ error: "Forbidden: this request is outside your scope" });
    return null;
  }

  // The catalog may have changed since submission. Re-check only the fields the
  // request actually carries — a staff form has no course to validate.
  if (request.department_id) {
    const dept = await departmentModel.getActiveDepartmentById(request.department_id);
    if (!dept) {
      res.status(409).json({
        error: "That department is no longer available. Ask them to resubmit.",
      });
      return null;
    }
  }
  if (request.course_id) {
    const course = await departmentModel.getActiveCourseById(request.course_id);
    if (!course || course.department_id !== request.department_id) {
      res.status(409).json({
        error: "That course is no longer available. Ask them to resubmit.",
      });
      return null;
    }
  }

  return request;
}

/** POST /api/verification/:id/approve */
const approve = async (req, res, next) => {
  try {
    const request = await authorizeReview(req, res);
    if (!request) return;

    let updated;
    try {
      updated = await verificationModel.approve(request.id, req.user.id);
    } catch (err) {
      // The student_id uniqueness guard: one verified owner per ID.
      if (err?.code === "23505") {
        return res
          .status(409)
          .json({ error: "That ID is already verified to another account" });
      }
      throw err;
    }

    await auditService.recordRequest(req, {
      action: ACTIONS.VERIFICATION_APPROVE,
      targetType: "verification_request",
      targetId: updated.id,
      targetLabel: `${updated.full_name} (${updated.student_id})`,
      metadata: { role: updated.role },
    });

    await notificationService.notifyUser({
      userId: updated.user_id,
      type: "verification_approved",
      message: "Your account is verified.",
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

/** POST /api/verification/:id/decline */
const decline = async (req, res, next) => {
  try {
    const request = await authorizeReview(req, res);
    if (!request) return;

    const note = req.body.note; // validated by verificationDecisionSchema
    const updated = await verificationModel.decline(request.id, req.user.id, note);

    await auditService.recordRequest(req, {
      action: ACTIONS.VERIFICATION_DECLINE,
      targetType: "verification_request",
      targetId: updated.id,
      targetLabel: `${updated.full_name} (${updated.student_id})`,
      reason: note,
      metadata: { role: updated.role },
    });

    await notificationService.notifyUser({
      userId: updated.user_id,
      type: "verification_declined",
      message: `Your verification was declined: ${note}`,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendOtp,
  submit,
  updateMine,
  getMine,
  queue,
  approve,
  decline,
  // exported for unit tests
  snapshotFor,
  identityComplete,
};
