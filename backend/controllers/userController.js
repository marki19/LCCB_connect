const userModel = require("../models/userModel");
const departmentModel = require("../models/departmentModel");
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
    res.json(user);
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
    const payload = { ...req.body, id: req.user.id };
    delete payload.role; // defence in depth — never let a caller self-assign a role

    // The department/course chosen at registration must be real and active. The
    // model's ON CONFLICT only fills these while unset, so this cannot be used
    // to move an existing assignment.
    const refError = await validateCatalogReferences(payload);
    if (refError) return res.status(400).json({ error: refError });

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

    // Department/course is the messaging access key. A non-admin may CLAIM it
    // once while unset (the one-time profile-completion gate) but can never
    // change an existing value; admins may change it freely. Values must point
    // at active catalog rows and the course must match the department.
    const touchesCatalog =
      payload.department_id !== undefined || payload.course_id !== undefined;
    if (touchesCatalog) {
      const target =
        authz.target ||
        (authz.isSelf ? req.profile : null) ||
        (await userModel.getUserById(id));
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

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Self-delete only. Account deletion by an admin must go through the
    // audited superadmin endpoint so the Auth user is removed too.
    if (String(req.user.id) !== String(id)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const deletedUser = await userModel.deleteUser(id);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully", user: deletedUser });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
};
