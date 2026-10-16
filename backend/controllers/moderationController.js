const postModel = require("../models/postModel");
const messageModel = require("../models/messageModel");
const notificationModel = require("../models/notificationModel");
const notificationService = require("../services/notificationService");
const { isSuperAdmin, isAdmin, isDepartmentAdmin } = require("../middleware/auth");

/**
 * Department scope for moderators.
 *
 * Campus admins (admin/superadmin) may act on any department. Everyone else —
 * in practice a `departmentAdmin`, since that is all `requireModerator` admits —
 * is confined to their own department. Compares `department_id` (catalog UUID),
 * never a display string, so a renamed department cannot change scope. Fails
 * **closed**: if either the moderator or the content has no department, the
 * action is refused.
 *
 * Sends the 403 itself and returns false, so callers can `if (!...) return;`.
 */
const withinDepartmentScope = (req, res, contentDepartmentId) => {
  if (isAdmin(req)) return true;

  const moderatorDepartmentId = req.profile?.department_id || null;
  const targetDepartmentId = contentDepartmentId || null;

  if (!moderatorDepartmentId || !targetDepartmentId || moderatorDepartmentId !== targetDepartmentId) {
    res.status(403).json({
      error: "Forbidden: cannot moderate content outside your department",
    });
    return false;
  }

  return true;
};

/**
 * Controller for Content Moderation & In-App Notifications
 */

const getModerationQueue = async (req, res, next) => {
  try {
    // Catalog UUID only; an invalid/missing query value is ignored (never a 500).
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let departmentId = null;

    if (isSuperAdmin(req) || isAdmin(req)) {
      // Campus-wide admins can view all, or filter by ?department_id=<uuid>.
      const q = req.query.department_id;
      departmentId = typeof q === "string" && UUID_RE.test(q.trim()) ? q.trim() : null;
    } else if (isDepartmentAdmin(req)) {
      // Department admins are strictly restricted to their own department.
      departmentId = req.profile?.department_id || null;
    } else {
      return res.status(403).json({ error: "Forbidden: insufficient moderation permissions" });
    }

    const [flaggedPosts, flaggedComments, messageReports] = await Promise.all([
      postModel.getFlaggedPosts({ departmentId }),
      postModel.getFlaggedComments({ departmentId }),
      messageModel.listOpenMessageReports({ departmentId }),
    ]);

    res.json({
      department_id: departmentId,
      totalFlagged: flaggedPosts.length + flaggedComments.length + messageReports.length,
      flaggedPosts,
      flaggedComments,
      messageReports,
    });
  } catch (err) {
    next(err);
  }
};

const moderatePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // 'approve', 'hide', 'delete'

    const post = await postModel.getPostById(id, { includeHidden: true });
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Department admins are scoped to their own department; campus admins are not.
    if (!withinDepartmentScope(req, res, post.author?.department_id)) return;

    if (action === "approve") {
      const updated = await postModel.updatePostModeration(id, "approved", reason || "Approved by moderator");
      return res.json({ message: "Post approved", post: updated });
    }

    if (action === "hide") {
      const updated = await postModel.updatePostModeration(id, "hidden", reason || "Content hidden by moderator");
      await notificationService.notifyAuthorOnAction({
        authorId: post.author_id,
        actorId: req.user.id,
        message: `Your post "${post.title || "Post"}" was hidden by an administrator: ${reason || "Violation of community guidelines."}`,
      });
      return res.json({ message: "Post hidden", post: updated });
    }

    if (action === "delete") {
      await postModel.adminDeletePost(id);
      await notificationService.notifyAuthorOnAction({
        authorId: post.author_id,
        actorId: req.user.id,
        message: `Your post "${post.title || "Post"}" was removed by an administrator: ${reason || "Inappropriate content."}`,
      });
      return res.json({ message: "Post permanently deleted" });
    }

    return res.status(400).json({ error: "Invalid moderation action. Must be 'approve', 'hide', or 'delete'" });
  } catch (err) {
    next(err);
  }
};

const moderateComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // 'approve', 'hide', 'delete'

    const comment = await postModel.getCommentById(id);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    // Same department rule as posts, scoped on the commenter's department so it
    // lines up with the queue filter in `getFlaggedComments`.
    if (!withinDepartmentScope(req, res, comment.author?.department_id)) return;

    if (action === "approve") {
      const updated = await postModel.updateCommentModeration(id, "approved", reason || "Approved by moderator");
      return res.json({ message: "Comment approved", comment: updated });
    }

    if (action === "hide") {
      const updated = await postModel.updateCommentModeration(id, "hidden", reason || "Foul language / policy violation");
      return res.json({ message: "Comment hidden", comment: updated });
    }

    if (action === "delete") {
      await postModel.deleteComment(id);
      return res.json({ message: "Comment deleted" });
    }

    return res.status(400).json({ error: "Invalid moderation action" });
  } catch (err) {
    next(err);
  }
};

/**
 * Resolves a reported message. `reviewed` = actioned/acknowledged, `dismissed` =
 * no action. Department admins may only resolve reports against a sender in
 * their own department; campus admins may resolve any.
 */
const moderateMessageReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'reviewed' | 'dismissed'

    if (action !== "reviewed" && action !== "dismissed") {
      return res.status(400).json({ error: "Invalid action. Must be 'reviewed' or 'dismissed'" });
    }

    const report = await messageModel.getMessageReportById(id);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Same department rule as posts/comments, scoped on the reported sender.
    if (!withinDepartmentScope(req, res, report.sender_department_id)) return;

    const updated = await messageModel.resolveMessageReport(id, action);
    res.json({ message: `Report ${action}`, report: updated });
  } catch (err) {
    next(err);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const notifications = await notificationModel.getUserNotifications(req.user.id);
    const unread = await notificationModel.getUnreadCount(req.user.id);
    res.json({ unread, notifications });
  } catch (err) {
    next(err);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await notificationModel.markAsRead(id, req.user.id);
    if (!updated) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    await notificationModel.markAllAsRead(req.user.id);
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getModerationQueue,
  moderatePost,
  moderateComment,
  moderateMessageReport,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
