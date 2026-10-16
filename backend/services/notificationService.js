const db = require("../db");

/**
 * Finds all admins eligible to receive notifications for an event.
 * - superAdmin & admin receive all campus-wide events.
 * - departmentAdmin receives events targeting their own department (by UUID).
 *
 * Targeting is by `department_id` (catalog UUID), never a display string, so a
 * renamed department changes nothing. A campus-wide event (no department)
 * notifies only campus admins — it must not fan out to every department admin.
 */
async function getTargetAdmins(departmentId = null) {
  const sql = `
    SELECT id, role, department_id FROM public.profiles
    WHERE
      LOWER(role) IN ('admin', 'superadmin')
      OR (
        LOWER(REPLACE(REPLACE(role, '_', ''), '-', '')) = 'departmentadmin'
        AND $1::uuid IS NOT NULL
        AND department_id = $1::uuid
      );
  `;
  const result = await db.query(sql, [departmentId || null]);
  return result.rows;
}

/**
 * Creates notification records in bulk using parameterized raw SQL.
 * Stores the department as both the authoritative `department_id` and a
 * denormalized display `department` name.
 */
async function createNotifications(adminIds, { actorId, type, targetId, departmentId, departmentName, message }) {
  if (!adminIds || adminIds.length === 0) return;

  for (const adminId of adminIds) {
    const sql = `
      INSERT INTO public.notifications (user_id, actor_id, type, target_id, department_id, department, message)
      VALUES ($1, $2, $3, $4, $5, $6, $7);
    `;
    await db.query(sql, [
      adminId,
      actorId || null,
      type,
      targetId || null,
      departmentId || null,
      departmentName || null,
      message,
    ]);
  }
}

/**
 * Notifies admins when a new student post is published.
 */
async function notifyAdminsOnPostCreated(post, author) {
  try {
    const departmentId = author?.department_id || null;
    const departmentName = author?.department_name || null;
    const admins = await getTargetAdmins(departmentId);
    const authorName = author?.full_name || author?.username || "Student";
    const postTitle = post.title ? `"${post.title}"` : "a new post";

    await createNotifications(
      admins.map((a) => a.id),
      {
        actorId: author?.id,
        type: "new_post",
        targetId: post.id,
        departmentId,
        departmentName,
        message: `${authorName} (${departmentName || "Campus"}) published ${postTitle}.`,
      }
    );
  } catch (err) {
    console.error("[notification] Failed to notify admins on post creation:", err);
  }
}

/**
 * Notifies admins when a new thesis manuscript is deposited.
 */
async function notifyAdminsOnThesisCreated(thesis, uploader) {
  try {
    const departmentId = thesis.department_id || uploader?.department_id || null;
    const departmentName = uploader?.department_name || thesis.department || null;
    const admins = await getTargetAdmins(departmentId);
    const uploaderName = uploader?.full_name || uploader?.username || "Student";

    await createNotifications(
      admins.map((a) => a.id),
      {
        actorId: uploader?.id,
        type: "new_thesis",
        targetId: thesis.id,
        departmentId,
        departmentName,
        message: `${uploaderName} deposited manuscript: "${thesis.title}".`,
      }
    );
  } catch (err) {
    console.error("[notification] Failed to notify admins on thesis deposit:", err);
  }
}

/**
 * High-priority alert sent to admins when AI detects foul language or policy violations.
 */
async function notifyAdminsOnFlaggedContent({ targetId, type, reason, departmentId, departmentName, authorId, snippet }) {
  try {
    const admins = await getTargetAdmins(departmentId);
    const notifType = type === "comment" ? "flagged_comment" : "flagged_post";
    const alertMessage = `⚠️ [AI Moderation Alert] Inappropriate content flagged in ${type}: "${snippet}". Reason: ${reason}`;

    await createNotifications(
      admins.map((a) => a.id),
      {
        actorId: authorId,
        type: notifType,
        targetId,
        departmentId,
        departmentName,
        message: alertMessage,
      }
    );
  } catch (err) {
    console.error("[notification] Failed to notify admins on flagged content:", err);
  }
}

/**
 * Informs the author if their content was declined or hidden by an admin.
 */
async function notifyAuthorOnAction({ authorId, actorId, message }) {
  try {
    if (!authorId) return;
    const sql = `
      INSERT INTO public.notifications (user_id, actor_id, type, message)
      VALUES ($1, $2, 'post_hidden', $3);
    `;
    await db.query(sql, [authorId, actorId || null, message]);
  } catch (err) {
    console.error("[notification] Failed to notify author on action:", err);
  }
}

/**
 * Inserts a single notification for one user (message, message request, friend
 * request/accept). `client` lets a caller enlist this insert in its own
 * transaction so the notification is atomic with the event that caused it.
 */
async function notifyUser({ userId, actorId = null, type, targetId = null, message }, client = db) {
  const run = (text, params) => client.query(text, params);
  await run(
    `INSERT INTO public.notifications (user_id, actor_id, type, target_id, message)
     VALUES ($1, $2, $3, $4, $5);`,
    [userId, actorId, type, targetId, message]
  );
}

module.exports = {
  getTargetAdmins,
  createNotifications,
  notifyUser,
  notifyAdminsOnPostCreated,
  notifyAdminsOnThesisCreated,
  notifyAdminsOnFlaggedContent,
  notifyAuthorOnAction,
};
