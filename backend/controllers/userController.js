const userModel = require("../models/userModel");
const { clampLimit } = require("../models/pagination");
const {
  isAdmin,
  isSuperAdmin,
  normalizeRole,
  canManage,
} = require("../middleware/auth");

const getUsers = async (req, res, next) => {
  try {
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
    const user = await userModel.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    // A caller may only create/upsert their OWN profile. The id comes from the
    // verified token; `createProfileSchema` already rejects `id`/`role` keys.
    const payload = { ...req.body, id: req.user.id };
    delete payload.role; // defence in depth — never let a caller self-assign a role

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

    // Role assignment rules:
    //  - only an admin may change a role at all (everyone else has it stripped)
    //  - only a superadmin may grant `superadmin` — this also stops an admin
    //    from promoting themselves
    if (payload.role !== undefined) {
      if (!isAdmin(req)) {
        delete payload.role;
      } else if (normalizeRole(payload.role) === "superadmin" && !isSuperAdmin(req)) {
        return res.status(403).json({
          error: "Forbidden: only a superadmin can grant the superadmin role",
        });
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
    const authz = await authorizeAccountAction(req, id);
    if (!authz.ok) {
      return res.status(authz.status).json(authz.body);
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
