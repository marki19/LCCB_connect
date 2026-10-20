const crypto = require("crypto");
const adminModel = require("../models/adminModel");
const userModel = require("../models/userModel");
const accountService = require("../services/accountService");
const auditService = require("../services/auditService");
const { ACTIONS } = auditService;
const {
  isSuperAdmin,
  canManage,
  normalizeRole,
} = require("../middleware/auth");
const { AdminAuthUnavailableError } = require("../services/supabaseAdmin");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTENT_TYPES = ["post", "comment", "thesis", "all"];
const CONTENT_STATUSES = ["approved", "flagged", "hidden", "all"];

/** Maps every accepted spelling back to the canonical stored value. */
const CANONICAL_ROLE = {
  student: "student",
  faculty: "faculty",
  departmentadmin: "departmentAdmin",
  admin: "admin",
  superadmin: "superadmin",
};

function canonicalRole(role) {
  return CANONICAL_ROLE[normalizeRole(role)] || null;
}

const forbidden = (res, message = "Forbidden") =>
  res.status(403).json({ error: message });

const badRequest = (res, message) => res.status(400).json({ error: message });

function parseLimit(raw) {
  return adminModel.clampAdminLimit(raw);
}

function sendServiceError(error, res, next) {
  if (error instanceof AdminAuthUnavailableError) {
    return res.status(503).json({ error: "Admin auth service unavailable" });
  }
  if (error?.status && Number.isInteger(error.status)) {
    return res.status(error.status).json({ error: error.message });
  }
  return next(error);
}

function targetLabel(user) {
  return user?.username || user?.full_name || user?.id || null;
}

async function findTarget(id, res) {
  if (!id) {
    res.status(404).json({ error: "User not found" });
    return null;
  }
  const target = await userModel.getUserById(id);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return null;
  }
  return target;
}

/**
 * Rank/self gate for actions that manage another account. Read paths do not
 * use this: a dossier can be read for an equal or higher rank.
 */
async function authorizeTarget(req, res, id, { superadminOnly = false } = {}) {
  if (superadminOnly && !isSuperAdmin(req)) {
    forbidden(res, "Forbidden: superadmin only");
    return null;
  }

  if (String(req.user.id) === String(id)) {
    forbidden(res, "Forbidden: you cannot manage your own account");
    return null;
  }

  const target = await findTarget(id, res);
  if (!target) return null;

  if (!canManage(req, target.role)) {
    forbidden(res, "Forbidden: cannot manage an account of an equal or higher rank");
    return null;
  }

  return target;
}

const getOverview = async (req, res, next) => {
  try {
    const overview = await adminModel.getOverview();
    if (isSuperAdmin(req)) {
      const recent = await adminModel.listAudit({ limit: 10 });
      overview.recent_actions = recent.items;
    } else {
      overview.recent_actions = [];
    }
    res.json(overview);
  } catch (error) {
    next(error);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const role = req.query.role ? canonicalRole(String(req.query.role)) : null;
    if (req.query.role && !role) {
      return badRequest(res, "Unknown role filter");
    }
    const departmentId = req.query.department_id
      ? String(req.query.department_id)
      : null;
    if (departmentId && !UUID_RE.test(departmentId)) {
      return badRequest(res, "Invalid department id");
    }
    const status = req.query.status ? String(req.query.status) : null;
    if (status && !["active", "suspended"].includes(status)) {
      return badRequest(res, "Unknown status filter");
    }

    const result = await adminModel.listUsers({
      q: req.query.q ? String(req.query.q).trim().slice(0, 200) : null,
      role,
      departmentId,
      status,
      limit: parseLimit(req.query.limit),
      cursor: req.query.cursor ? String(req.query.cursor) : null,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const dossier = await adminModel.getUserDossier(req.params.id, {
      includeAudit: isSuperAdmin(req),
    });
    if (!dossier) return res.status(404).json({ error: "User not found" });

    const authUser = await accountService.getAuthUser(req.params.id);
    res.json({ ...dossier, email: authUser?.email || null });
  } catch (error) {
    next(error);
  }
};

const changeRole = async (req, res, next) => {
  try {
    const target = await authorizeTarget(req, res, req.params.id);
    if (!target) return;

    const nextRole = canonicalRole(req.body.role);
    if (!nextRole) {
      return badRequest(res, "Unknown role");
    }
    if (
      !isSuperAdmin(req) &&
      (nextRole === "admin" || nextRole === "superadmin")
    ) {
      return forbidden(res, "Forbidden: only a superadmin can grant this role");
    }

    const currentRole = canonicalRole(target.role);
    if (currentRole === nextRole) {
      return res.json({
        message: "Role unchanged",
        user: await adminModel.getUserById(target.id),
      });
    }

    await userModel.updateUser(target.id, { role: nextRole });
    const updated = await adminModel.getUserById(target.id);

    await auditService.recordRequest(req, {
      action: ACTIONS.USER_ROLE_CHANGE,
      targetType: "user",
      targetId: target.id,
      targetLabel: targetLabel(target),
      reason: req.body.reason,
      metadata: { from: target.role, to: nextRole },
    });

    res.json({ message: "Role updated", user: updated });
  } catch (error) {
    next(error);
  }
};

const suspendUser = async (req, res, next) => {
  try {
    const target = await authorizeTarget(req, res, req.params.id);
    if (!target) return;

    if (target.suspended_at && (!target.suspended_until || new Date(target.suspended_until) > new Date())) {
      return res.json({
        message: "Account is already suspended",
        user: await adminModel.getUserById(target.id),
      });
    }

    await accountService.banUser(target.id, req.body.until || null);

    let updated;
    try {
      updated = await adminModel.setUserSuspension(target.id, {
        reason: req.body.reason,
        until: req.body.until || null,
        actorId: req.user.id,
      });
    } catch (error) {
      await accountService.unbanUser(target.id).catch(() => undefined);
      throw error;
    }

    let sessions = { sessions: 0, refresh_tokens: 0 };
    try {
      sessions = await accountService.revokeSessions(target.id);
    } catch (error) {
      console.error("[admin] Suspension applied but session revoke failed:", error.message);
    }

    await auditService.recordRequest(req, {
      action: ACTIONS.USER_SUSPEND,
      targetType: "user",
      targetId: target.id,
      targetLabel: targetLabel(target),
      reason: req.body.reason,
      metadata: {
        until: req.body.until || null,
        indefinite: !req.body.until,
        sessions_revoked: sessions.sessions,
      },
    });

    res.json({ message: "Account suspended", user: updated });
  } catch (error) {
    sendServiceError(error, res, next);
  }
};

const unsuspendUser = async (req, res, next) => {
  try {
    const target = await authorizeTarget(req, res, req.params.id);
    if (!target) return;

    // Run the Auth unban even when the profile fields are already clear, so a
    // prior partial failure can be repaired by retrying.
    await accountService.unbanUser(target.id);

    if (!target.suspended_at) {
      return res.json({
        message: "Account is not suspended",
        user: await adminModel.getUserById(target.id),
      });
    }

    const updated = await adminModel.clearUserSuspension(target.id);
    await auditService.recordRequest(req, {
      action: ACTIONS.USER_UNSUSPEND,
      targetType: "user",
      targetId: target.id,
      targetLabel: targetLabel(target),
      reason: req.body.reason,
      metadata: {
        previous_until: target.suspended_until || null,
        previous_reason: target.suspension_reason || null,
      },
    });

    res.json({ message: "Account restored", user: updated });
  } catch (error) {
    sendServiceError(error, res, next);
  }
};

const forceSignOut = async (req, res, next) => {
  try {
    const target = await authorizeTarget(req, res, req.params.id, {
      superadminOnly: true,
    });
    if (!target) return;

    const revoked = await accountService.revokeSessions(target.id);
    await auditService.recordRequest(req, {
      action: ACTIONS.USER_FORCE_SIGNOUT,
      targetType: "user",
      targetId: target.id,
      targetLabel: targetLabel(target),
      reason: req.body.reason,
      metadata: {
        sessions_revoked: revoked.sessions,
        refresh_tokens_revoked: revoked.refresh_tokens,
      },
    });

    res.json({
      message: "Sessions revoked",
      sessions_revoked: revoked.sessions,
      refresh_tokens_revoked: revoked.refresh_tokens,
    });
  } catch (error) {
    sendServiceError(error, res, next);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const target = await authorizeTarget(req, res, req.params.id, {
      superadminOnly: true,
    });
    if (!target) return;

    // Auth first so the account cannot sign in while its profile is being
    // removed. A missing Auth user is treated as success for retries.
    await accountService.deleteAuthUser(target.id);
    const deleted = await userModel.deleteUser(target.id);
    if (!deleted) {
      return res.status(404).json({ error: "User not found" });
    }

    await auditService.recordRequest(req, {
      action: ACTIONS.USER_DELETE,
      targetType: "user",
      targetId: target.id,
      targetLabel: targetLabel(target),
      reason: req.body.reason,
      metadata: {
        username: target.username,
        full_name: target.full_name,
        role: target.role,
      },
    });

    res.json({ message: "User deleted", id: target.id });
  } catch (error) {
    sendServiceError(error, res, next);
  }
};

const listContent = async (req, res, next) => {
  try {
    const type = req.query.type ? String(req.query.type) : "all";
    if (!CONTENT_TYPES.includes(type)) return badRequest(res, "Unknown content type");
    const status = req.query.status ? String(req.query.status) : "all";
    if (!CONTENT_STATUSES.includes(status)) return badRequest(res, "Unknown status");

    const departmentId = req.query.department_id
      ? String(req.query.department_id)
      : null;
    if (departmentId && !UUID_RE.test(departmentId)) {
      return badRequest(res, "Invalid department id");
    }

    const result = await adminModel.listContent({
      type,
      status,
      q: req.query.q ? String(req.query.q).trim().slice(0, 200) : null,
      departmentId,
      authorId: req.query.author_id ? String(req.query.author_id) : null,
      limit: parseLimit(req.query.limit),
      cursor: req.query.cursor ? String(req.query.cursor) : null,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const listAudit = async (req, res, next) => {
  try {
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    if (from && Number.isNaN(new Date(from).getTime())) {
      return badRequest(res, "Invalid from date");
    }
    if (to && Number.isNaN(new Date(to).getTime())) {
      return badRequest(res, "Invalid to date");
    }

    const result = await adminModel.listAudit({
      actorId: req.query.actor_id ? String(req.query.actor_id) : null,
      action: req.query.action ? String(req.query.action) : null,
      targetType: req.query.target_type ? String(req.query.target_type) : null,
      targetId: req.query.target_id ? String(req.query.target_id) : null,
      from,
      to,
      q: req.query.q ? String(req.query.q).trim().slice(0, 200) : null,
      limit: parseLimit(req.query.limit),
      cursor: req.query.cursor ? String(req.query.cursor) : null,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

function audienceFromQuery(query) {
  const type = String(query.type || "all");
  if (!["all", "role", "department"].includes(type)) return { error: "Unknown audience" };
  if (type === "role") {
    const role = canonicalRole(query.role);
    if (!role) return { error: "Unknown role" };
    return { audience: { type, role } };
  }
  if (type === "department") {
    const departmentId = String(query.department_id || "");
    if (!UUID_RE.test(departmentId)) return { error: "Invalid department id" };
    return { audience: { type, department_id: departmentId } };
  }
  return { audience: { type: "all" } };
}

const getAudienceCount = async (req, res, next) => {
  try {
    const parsed = audienceFromQuery(req.query);
    if (parsed.error) return badRequest(res, parsed.error);

    const recipients = await adminModel.getAnnouncementRecipients({
      actorId: req.user.id,
      role: parsed.audience.type === "role" ? parsed.audience.role : null,
      departmentId:
        parsed.audience.type === "department"
          ? parsed.audience.department_id
          : null,
    });
    res.json({ count: recipients.length });
  } catch (error) {
    next(error);
  }
};

const sendAnnouncement = async (req, res, next) => {
  try {
    const { title, body, audience } = req.body;
    let departmentName = null;

    if (audience.type === "department") {
      departmentName = await adminModel.getDepartmentName(audience.department_id);
      if (!departmentName) return badRequest(res, "Unknown department");
    }

    const recipients = await adminModel.getAnnouncementRecipients({
      actorId: req.user.id,
      role: audience.type === "role" ? audience.role : null,
      departmentId: audience.type === "department" ? audience.department_id : null,
    });

    if (recipients.length === 0) {
      return badRequest(res, "No active recipients match this audience");
    }

    const announcementId = crypto.randomUUID();
    const message = `${title}\n\n${body}`;
    await adminModel.createAnnouncementNotifications({
      recipients: recipients.map((r) => r.id),
      actorId: req.user.id,
      announcementId,
      departmentId: audience.type === "department" ? audience.department_id : null,
      departmentName,
      message,
    });

    await auditService.recordRequest(req, {
      action: ACTIONS.ANNOUNCEMENT_SEND,
      targetType: "announcement",
      targetId: announcementId,
      targetLabel: title,
      reason: null,
      metadata: { title, body, audience, recipients: recipients.length },
    });

    res.status(201).json({ id: announcementId, recipients: recipients.length });
  } catch (error) {
    next(error);
  }
};

const listAnnouncements = async (req, res, next) => {
  try {
    const result = await adminModel.listAnnouncementHistory({
      limit: parseLimit(req.query.limit),
      cursor: req.query.cursor ? String(req.query.cursor) : null,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverview,
  listUsers,
  getUser,
  changeRole,
  suspendUser,
  unsuspendUser,
  forceSignOut,
  deleteUser,
  listContent,
  listAudit,
  getAudienceCount,
  sendAnnouncement,
  listAnnouncements,
};
