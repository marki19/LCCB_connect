const db = require("../db");
const { normalizeRole } = require("../utils/roles");

/**
 * Canonical action names. Keep this list in sync with SPEC-superadmin-console.md
 * §9.3. Unknown strings are still accepted by the table; this object exists so
 * controllers do not hand-type action names.
 */
const ACTIONS = Object.freeze({
  USER_ROLE_CHANGE: "user.role_change",
  USER_SUSPEND: "user.suspend",
  USER_UNSUSPEND: "user.unsuspend",
  USER_FORCE_SIGNOUT: "user.force_signout",
  USER_DELETE: "user.delete",
  CONTENT_HIDE: "content.hide",
  CONTENT_RESTORE: "content.restore",
  CONTENT_DELETE: "content.delete",
  REPORT_REVIEW: "report.review",
  REPORT_DISMISS: "report.dismiss",
  ANNOUNCEMENT_SEND: "announcement.send",
  ANNOUNCEMENT_UPDATE: "announcement.update",
  ANNOUNCEMENT_DELETE: "announcement.delete",
  CATALOG_CREATE: "catalog.create",
  CATALOG_UPDATE: "catalog.update",
  CATALOG_ACTIVATE: "catalog.activate",
  CATALOG_DEACTIVATE: "catalog.deactivate",
  VERIFICATION_SUBMIT: "verification.submit",
  VERIFICATION_APPROVE: "verification.approve",
  VERIFICATION_DECLINE: "verification.decline",
  ADMIN_IMPERSONATE: "admin.impersonate",
  // MFA & Auth audit actions
  MFA_ENROLL: "mfa.enroll",
  MFA_UNENROLL: "mfa.unenroll",
  MFA_CHALLENGE: "mfa.challenge",
  LOGIN_SUCCESS: "auth.login_success",
  LOGIN_FAILED_LOCKOUT: "auth.login_failed_lockout",
  LOGOUT: "auth.logout",
  // Email bounce tracking
  EMAIL_BOUNCE_HARD: "email.bounce_hard",
});

function actorSnapshot(actor) {
  if (!actor || !actor.id) {
    const error = new Error("Audit actor is required");
    error.status = 500;
    throw error;
  }
  return {
    id: String(actor.id),
    username: actor.username || null,
    role: normalizeRole(actor.role) || actor.role || null,
  };
}

/**
 * Inserts one audit row. This is the only write path for the audit table.
 *
 * @param {object} entry
 * @param {{id:string, username?:string|null, role?:string|null}} entry.actor
 * @param {string} entry.action
 * @param {string} entry.targetType
 * @param {string|null} [entry.targetId]
 * @param {string|null} [entry.targetLabel]
 * @param {string|null} [entry.reason]
 * @param {object} [entry.metadata]
 */
async function record({
  actor,
  action,
  targetType,
  targetId = null,
  targetLabel = null,
  reason = null,
  metadata = {},
}) {
  const snapshot = actorSnapshot(actor);
  const result = await db.query(
    `INSERT INTO public.admin_audit_log
       (actor_id, actor_username, actor_role, action, target_type, target_id,
        target_label, reason, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING *;`,
    [
      snapshot.id,
      snapshot.username,
      snapshot.role,
      action,
      targetType,
      targetId,
      targetLabel,
      reason,
      JSON.stringify(metadata ?? {}),
    ]
  );
  return result.rows[0];
}

/** Convenience for controllers that already have `req.profile`. */
function recordRequest(req, entry) {
  return record({ ...entry, actor: req.profile });
}

module.exports = { ACTIONS, record, recordRequest };
