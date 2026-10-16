const db = require("../db");

/**
 * Finds all admins eligible to receive notifications for an event.
 * - superAdmin & admin receive all campus-wide events.
 * - departmentAdmin receives events matching their own department/course.
 */
async function getTargetAdmins(department) {
  const sql = `
    SELECT id, role, course FROM public.profiles
    WHERE 
      LOWER(role) IN ('admin', 'superadmin')
      OR (
        LOWER(REPLACE(REPLACE(role, '_', ''), '-', '')) = 'departmentadmin'
        AND ($1::text IS NULL OR LOWER(course) = LOWER($1))
      );
  `;
  const result = await db.query(sql, [department || null]);
  return result.rows;
}

/**
 * Creates notification records in bulk using parameterized raw SQL.
 */
async function createNotifications(adminIds, { actorId, type, targetId, department, message }) {
  if (!adminIds || adminIds.length === 0) return;

  for (const adminId of adminIds) {
    const sql = `
      INSERT INTO public.notifications (user_id, actor_id, type, target_id, department, message)
      VALUES ($1, $2, $3, $4, $5, $6);
    `;
    await db.query(sql, [adminId, actorId || null, type, targetId || null, department || null, message]);
  }
}

/**
 * Notifies admins when a new student post is published.
 */
async function notifyAdminsOnPostCreated(post, author) {
  try {
    const department = author?.course || null;
    const admins = await getTargetAdmins(department);
    const authorName = author?.full_name || author?.username || "Student";
    const postTitle = post.title ? `"${post.title}"` : "a new post";

    await createNotifications(
      admins.map((a) => a.id),
      {
        actorId: author?.id,
        type: "new_post",
        targetId: post.id,
        department,
        message: `${authorName} (${department || "Campus"}) published ${postTitle}.`,
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
    const department = thesis.department || uploader?.course || null;
    const admins = await getTargetAdmins(department);
    const uploaderName = uploader?.full_name || uploader?.username || "Student";

    await createNotifications(
      admins.map((a) => a.id),
      {
        actorId: uploader?.id,
        type: "new_thesis",
        targetId: thesis.id,
        department,
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
async function notifyAdminsOnFlaggedContent({ targetId, type, reason, department, authorId, snippet }) {
  try {
    const admins = await getTargetAdmins(department);
    const notifType = type === "comment" ? "flagged_comment" : "flagged_post";
    const alertMessage = `⚠️ [AI Moderation Alert] Inappropriate content flagged in ${type}: "${snippet}". Reason: ${reason}`;

    await createNotifications(
      admins.map((a) => a.id),
      {
        actorId: authorId,
        type: notifType,
        targetId,
        department,
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

module.exports = {
  getTargetAdmins,
  createNotifications,
  notifyAdminsOnPostCreated,
  notifyAdminsOnThesisCreated,
  notifyAdminsOnFlaggedContent,
  notifyAuthorOnAction,
};
