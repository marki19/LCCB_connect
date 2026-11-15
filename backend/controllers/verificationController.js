const verificationModel = require("../models/verificationModel");
const userModel = require("../models/userModel");
const departmentModel = require("../models/departmentModel");
const { validateCatalogReferences } = require("./userController");
const notificationService = require("../services/notificationService");
const auditService = require("../services/auditService");
const db = require("../db");

/** POST /api/verification — submit a new request or upsert pending. */
const submit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profile = req.profile;

    // Already verified AND identity complete? Nothing to do.
    // Identity complete means full_name, student_id, department_id, course_id are all set.
    const identityComplete = profile?.full_name && profile?.student_id && profile?.department_id && profile?.course_id;
    if (profile?.verification_status === "verified" && identityComplete) {
      return res.status(409).json({ error: "Your account is already verified" });
    }

    const snapshot = req.body; // already validated by verificationSubmitSchema

    // Catalog validation — reuse the helper from userController.
    const refError = await validateCatalogReferences({
      department_id: snapshot.department_id,
      course_id: snapshot.course_id,
    });
    if (refError) return res.status(400).json({ error: refError });

    // Insert pending request. The partial unique index prevents a second pending.
    let request;
    try {
      request = await verificationModel.createPending(userId, snapshot);
    } catch (err) {
      if (err?.code === "23505") {
        // unique_violation on uq_verification_one_pending
        return res
          .status(409)
          .json({ error: "You already have a request under review" });
      }
      throw err;
    }

    // Mirror identity fields onto profile + set verification_status='pending'
    await userModel.updateUser(userId, {
      full_name: snapshot.full_name,
      student_id: snapshot.student_id,
      department_id: snapshot.department_id,
      course_id: snapshot.course_id,
      year_level: snapshot.year_level,
      verification_status: "pending",
    });

    // Audit
    await auditService.recordRequest(req, {
      action: auditService.ACTIONS.VERIFICATION_SUBMIT,
      targetType: "verification_request",
      targetId: request.id,
      targetLabel: `${snapshot.full_name} (${snapshot.student_id})`,
    });

    // Notify department admins
    const admins = await notificationService.getTargetAdmins(snapshot.department_id);
    await notificationService.createNotifications(
      admins.map((a) => a.id),
      {
        actorId: userId,
        type: "verification_submitted",
        targetId: request.id,
        departmentId: snapshot.department_id,
        departmentName: admins[0]?.department_name || null,
        message: `${snapshot.full_name} submitted an identity verification request.`,
      }
    );

    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
};

/** PUT /api/verification/mine — update a pending request (resubmit after decline). */
const updateMine = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Must have a pending request to update.
    const existing = await verificationModel.getLatestForUser(userId);
    if (!existing || existing.status !== "pending") {
      return res.status(404).json({ error: "No pending request to update" });
    }

    const snapshot = req.body;

    // Catalog validation.
    const refError = await validateCatalogReferences({
      department_id: snapshot.department_id,
      course_id: snapshot.course_id,
    });
    if (refError) return res.status(400).json({ error: refError });

    const request = await verificationModel.updatePending(userId, snapshot);
    if (!request) {
      return res.status(404).json({ error: "No pending request to update" });
    }

    // Audit (resubmission)
    await auditService.recordRequest(req, {
      action: auditService.ACTIONS.VERIFICATION_SUBMIT,
      targetType: "verification_request",
      targetId: request.id,
      targetLabel: `${snapshot.full_name} (${snapshot.student_id})`,
      metadata: { resubmission: true },
    });

    res.json(request);
  } catch (err) {
    next(err);
  }
};

/** GET /api/verification/mine — caller's latest request + can_resubmit flag. */
const getMine = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const request = await verificationModel.getLatestForUser(userId);

    const can_resubmit = !request || request.status === "declined";
    res.json({ request, can_resubmit });
  } catch (err) {
    next(err);
  }
};

/** GET /api/verification/queue — department-admin scoped list. */
const queue = async (req, res, next) => {
  try {
    const role = req.profile?.role || "";
    const norm = role.toLowerCase().replace(/[-_]/g, "");

    let departmentId = req.query.department_id || null;
    if (norm === "departmentadmin") {
      departmentId = req.profile?.department_id || null;
      if (!departmentId) {
        return res
          .status(403)
          .json({ error: "Your account has no department assigned" });
      }
    }

    const status = req.query.status || null; // pending|approved|declined
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 100);
    const cursor = req.query.cursor || null;

    const rows = await verificationModel.listQueue({
      departmentId,
      status,
      limit,
      cursor,
    });

    res.json({ requests: rows });
  } catch (err) {
    next(err);
  }
};

/** POST /api/verification/:id/approve — approve a request (admin scoped). */
const approve = async (req, res, next) => {
  try {
    const role = req.profile?.role || "";
    const norm = role.toLowerCase().replace(/[-_]/g, "");
    const requestId = req.params.id;

    const result = await db.withTransaction(async (client) => {
      // 1. Lock + load
      const locked = await client.query(
        `SELECT * FROM public.profile_verification_requests WHERE id = $1 FOR UPDATE;`,
        [requestId]
      );
      const request = locked.rows[0];
      if (!request) {
        const err = new Error("Request not found");
        err.status = 404;
        throw err;
      }
      if (request.status !== "pending") {
        const err = new Error("Request is no longer pending");
        err.status = 409;
        throw err;
      }

      // 2. Scope check
      if (norm === "departmentadmin") {
        if (!req.profile?.department_id) {
          const err = new Error("Your account has no department assigned");
          err.status = 403;
          throw err;
        }
        if (request.department_id !== req.profile.department_id) {
          const err = new Error("Forbidden: request is outside your department");
          err.status = 403;
          throw err;
        }
      }

      // 3. Re-validate catalog: department + course must still be active and match
      const dept = await departmentModel.getActiveDepartmentById(request.department_id);
      if (!dept) {
        const err = new Error("That department or course is no longer available. Ask the student to resubmit.");
        err.status = 409;
        throw err;
      }
      const course = await departmentModel.getActiveCourseById(request.course_id);
      if (!course || course.department_id !== request.department_id) {
        const err = new Error("That department or course is no longer available. Ask the student to resubmit.");
        err.status = 409;
        throw err;
      }

      // 4. Write identity fields onto profile + set verification_status='verified'
      await client.query(
        `UPDATE public.profiles
            SET full_name = $2,
                student_id = $3,
                department_id = $4,
                course_id = $5,
                course = (SELECT name FROM public.courses WHERE id = $5),
                year_level = $6,
                verification_status = 'verified',
                verified_at = NOW()
          WHERE id = $1;`,
        [
          request.user_id,
          request.full_name,
          request.student_id,
          request.department_id,
          request.course_id,
          request.year_level,
        ]
      );

      // 5. Mark request approved
      const updated = await client.query(
        `UPDATE public.profile_verification_requests
            SET status = 'approved',
                reviewed_by = $2,
                reviewed_at = NOW()
          WHERE id = $1
          RETURNING *;`,
        [requestId, req.user.id]
      );

      return { request: updated.rows[0], userId: request.user_id };
    });

    // 6. Audit
    await auditService.recordRequest(req, {
      action: auditService.ACTIONS.VERIFICATION_APPROVE,
      targetType: "verification_request",
      targetId: result.request.id,
      targetLabel: `${result.request.full_name} (${result.request.student_id})`,
    });

    // 7. Notify the student
    await notificationService.notifyUser(
      { userId: result.userId, type: "verification_approved", message: "Your account is verified." },
      db
    );

    res.json(result.request);
  } catch (err) {
    next(err);
  }
};

/** POST /api/verification/:id/decline — decline a request (admin scoped). */
const decline = async (req, res, next) => {
  try {
    const role = req.profile?.role || "";
    const norm = role.toLowerCase().replace(/[-_]/g, "");
    const requestId = req.params.id;
    const note = req.body.note; // validated by verificationDecisionSchema

    const result = await db.withTransaction(async (client) => {
      const locked = await client.query(
        `SELECT * FROM public.profile_verification_requests WHERE id = $1 FOR UPDATE;`,
        [requestId]
      );
      const request = locked.rows[0];
      if (!request) {
        const err = new Error("Request not found");
        err.status = 404;
        throw err;
      }
      if (request.status !== "pending") {
        const err = new Error("Request is no longer pending");
        err.status = 409;
        throw err;
      }

      // Scope check
      if (norm === "departmentadmin") {
        if (!req.profile?.department_id) {
          const err = new Error("Your account has no department assigned");
          err.status = 403;
          throw err;
        }
        if (request.department_id !== req.profile.department_id) {
          const err = new Error("Forbidden: request is outside your department");
          err.status = 403;
          throw err;
        }
      }

      // Re-validate catalog (same as approve)
      const dept = await departmentModel.getActiveDepartmentById(request.department_id);
      if (!dept) {
        const err = new Error("That department or course is no longer available. Ask the student to resubmit.");
        err.status = 409;
        throw err;
      }
      const course = await departmentModel.getActiveCourseById(request.course_id);
      if (!course || course.department_id !== request.department_id) {
        const err = new Error("That department or course is no longer available. Ask the student to resubmit.");
        err.status = 409;
        throw err;
      }

      // Mark declined
      const updated = await client.query(
        `UPDATE public.profile_verification_requests
            SET status = 'declined',
                reviewed_by = $2,
                reviewed_at = NOW(),
                review_note = $3
          WHERE id = $1
          RETURNING *;`,
        [requestId, req.user.id, note]
      );

      // Reset profile to unverified so student can resubmit
      await client.query(
        `UPDATE public.profiles
            SET verification_status = 'unverified'
          WHERE id = $1;`,
        [request.user_id]
      );

      return { request: updated.rows[0], userId: request.user_id };
    });

    // Audit
    await auditService.recordRequest(req, {
      action: auditService.ACTIONS.VERIFICATION_DECLINE,
      targetType: "verification_request",
      targetId: result.request.id,
      targetLabel: `${result.request.full_name} (${result.request.student_id})`,
      reason: note,
    });

    // Notify the student with the reason
    await notificationService.notifyUser(
      {
        userId: result.userId,
        type: "verification_declined",
        message: `Your verification was declined: ${note}`,
      },
      db
    );

    res.status(200).json(result.request);
  } catch (err) {
    // Unique student_id conflict (23505) from approval path
    if (err?.code === "23505") {
      return res
        .status(409)
        .json({ error: "That student ID is already verified to another account" });
    }
    next(err);
  }
};

module.exports = {
  submit,
  updateMine,
  getMine,
  queue,
  approve,
  decline,
};