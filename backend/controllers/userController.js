const userModel = require("../models/userModel");
const departmentModel = require("../models/departmentModel");
const accountService = require("../services/accountService");
const { AdminAuthUnavailableError } = require("../services/supabaseAdmin");
const { clampLimit } = require("../models/pagination");
const {
  isAdmin,
  canManage,
} = require("../middleware/auth");

const getUsers = async (req, res, next) => {
  try {
    // The directory moved to GET /api/public/peers. This endpoint remains for
    // the console only.
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    // Optional keyset pagination: ?limit=<1..100>&cursor=<last id>
    const users = await userModel.getAllUsers({
      limit: clampLimit(req.query.limit),
      cursor: req.query.cursor || null,
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
};

const messageModel = require("../models/messageModel");
const { parseSearch } = require("../utils/queryFilters");
const MAX_DIRECTORY = 50;

const getDirectory = async (req, res, next) => {
  try {
    const scope = req.query.scope === "all" ? "all" : "network";
    const rows = await userModel.getDirectory(req.user.id, {
      limit: Math.min(clampLimit(req.query.limit), MAX_DIRECTORY),
      q: parseSearch(req.query.q),
      scope,
    });

    const peers = rows.map((row) => ({
      id: row.id,
      username: row.username,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      year_level: row.year_level,
      department_id: row.department_id,
      department_name: row.department_name,
      friendship: row.friendship_status === "accepted"
        ? "friend"
        : row.friendship_status === "pending"
        ? (row.friendship_outgoing ? "pending_out" : "pending_in")
        : "none",
      message_decision: messageModel.resolveDecision({
        is_blocked: false, // blocked pairs never reach this point
        is_friend: row.friendship_status === "accepted",
        recipient_policy: row.message_policy,
        sender_department_id: row.sender_department_id,
        recipient_department_id: row.department_id,
        sender_department_allowed: row.sender_department_allowed,
      }),
    }));

    res.json(peers);
  } catch (error) {
    next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Self or admin only. Other callers get 404 so ids cannot be probed.
    if (String(req.user.id) !== String(id) && !isAdmin(req)) {
      return res.status(404).json({ message: "User not found" });
    }
    const user = await userModel.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Same rule as verificationController's `identityComplete` - surfaced so the
    // client does not re-implement it (and cannot drift from it).
    const identity_complete = Boolean(
      user.full_name && user.student_id && user.department_id && user.course_id
    );
    res.json({ ...user, identity_complete });
  } catch (error) {
    next(error);
  }
};

const getPublicProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const viewerId = req.user?.id || null;

    const profile = await userModel.getPublicProfile(id, viewerId);
    if (!profile) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(profile);
  } catch (error) {
    next(error);
  }
};

/**
 * Verifies any department_id/course_id on a payload point at active catalog
 * rows and that the course belongs to the department. Returns an error message
 * or null. `fallbackDepartmentId` lets a caller change only the course when the
 * account already has a department.
 */
const validateCatalogReferences = async ({
  department_id,
  course_id,
  fallbackDepartmentId = null,
}) => {
  const deptId = department_id || fallbackDepartmentId || null;

  if (department_id) {
    const dept = await departmentModel.getActiveDepartmentById(department_id);
    if (!dept) return "Unknown or inactive department";
  }

  if (course_id) {
    if (!deptId) return "department_id is required when a course is selected";
    const course = await departmentModel.getActiveCourseById(course_id);
    if (!course) return "Unknown or inactive course";
    if (course.department_id !== deptId) {
      return "Course does not belong to the selected department";
    }
  }

  return null;
};

const createUser = async (req, res, next) => {
  try {
    // A caller may only create/upsert their OWN profile. The id comes from the
    // verified token; `createProfileSchema` already rejects `id`/`role` keys.
    const payload = { ...req.body, id: req.user.id, email: req.user.email };
    delete payload.role; // defence in depth — never let a caller self-assign a role
    delete payload.department_id; // department no longer selected at registration
    delete payload.course_id; // course no longer selected at registration
    delete payload.course; // course field no longer used at registration

    // Department validation is skipped for registration. validateCatalogReferences
    // is used in updateUser for admin updates and profile completion.

    const newUser = await userModel.createUser(payload);
    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
};

/**
 * Resolves the account a caller is trying to act on and verifies they outrank
 * it. Non-admins are refused *before* the lookup so the response cannot be used
 * to probe which account ids exist.
 *
 * Returns `{ ok: true }`, or `{ ok: false, status, body }` for the caller to send.
 */
const authorizeAccountAction = async (req, id) => {
  if (req.user.id === id) return { ok: true, isSelf: true };

  if (!isAdmin(req)) {
    return { ok: false, status: 403, body: { error: "Forbidden" } };
  }

  const target = await userModel.getUserById(id);
  if (!target) {
    return { ok: false, status: 404, body: { message: "User not found" } };
  }

  if (!canManage(req, target.role)) {
    return {
      ok: false,
      status: 403,
      body: {
        error: "Forbidden: cannot manage an account of an equal or higher rank",
      },
    };
  }

  return { ok: true, target };
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const authz = await authorizeAccountAction(req, id);
    if (!authz.ok) {
      return res.status(authz.status).json(authz.body);
    }

    const payload = { ...req.body };

    // Role writes belong to the audited console endpoint. Reject rather than
    // silently ignore so an old client cannot believe the change succeeded.
    if (payload.role !== undefined) {
      return res.status(400).json({
        error: "Role changes must use /api/admin/users/:id/role",
      });
    }

    // Identity lock: verified students cannot change name, student_id,
    // department_id, or course_id. Admins can always change these.
    const target =
      authz.target ||
      (authz.isSelf ? req.profile : null) ||
      (await userModel.getUserById(id));

    if (!isAdmin(req) && target?.verification_status === "verified") {
      const lockedFields = ["full_name", "student_id", "department_id", "course_id"];
      for (const field of lockedFields) {
        if (payload[field] !== undefined) {
          return res.status(403).json({
            error: `${field} cannot be changed after verification`,
            code: "identity_locked",
          });
        }
      }
    }

    // Department/course is the messaging access key. A non-admin may CLAIM it
    // once while unset (the one-time profile-completion gate) but can never
    // change an existing value; admins may change it freely. Values must point
    // at active catalog rows and the course must match the department.
    const touchesCatalog =
      payload.department_id !== undefined || payload.course_id !== undefined;
    if (touchesCatalog) {
      const alreadySet = Boolean(target && (target.department_id || target.course_id));

      if (!isAdmin(req) && alreadySet) {
        delete payload.department_id;
        delete payload.course_id;
      } else {
        const refError = await validateCatalogReferences({
          department_id: payload.department_id,
          course_id: payload.course_id,
          fallbackDepartmentId: target ? target.department_id : null,
        });
        if (refError) return res.status(400).json({ error: refError });
      }
    }

    const updatedUser = await userModel.updateUser(id, payload);
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
};

const disableUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { suspension_reason, suspended_until } = req.body;

    if (!suspension_reason) {
      return res.status(400).json({ error: "Suspension reason is required" });
    }

    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const suspensionData = {
      suspended_at: new Date().toISOString(),
      suspended_until: suspended_until || null,
      suspension_reason,
    };

    const disabledUser = await userModel.updateUser(id, suspensionData);
    if (!disabledUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "Account disabled successfully", user: disabledUser });
  } catch (error) {
    if (
      error instanceof AdminAuthUnavailableError ||
      error?.code === "admin_auth_unavailable"
    ) {
      return res.status(503).json({
        error: "Account deletion is temporarily unavailable. Try again later.",
        code: "auth_unavailable",
      });
    }
    next(error);
  }
};

module.exports = {
  getUsers,
  getUser,
  getPublicProfile,
  getDirectory,
  createUser,
  updateUser,
  disableUser,
  validateCatalogReferences,
};
