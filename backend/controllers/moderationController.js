const postModel = require("../models/postModel");
const thesisModel = require("../models/thesisModel");
const messageModel = require("../models/messageModel");
const notificationModel = require("../models/notificationModel");
const notificationService = require("../services/notificationService");
const auditService = require("../services/auditService");
const { ACTIONS } = auditService;
const { isSuperAdmin, isAdmin, isDepartmentAdmin } = require("../middleware/auth");

const MAX_REASON = 500;

/** Requires a non-empty moderation reason (3-500 chars). Sends 400 on failure. */
function readReason(req, res) {
  const raw = typeof req.body.reason === "string" ? req.body.reason.trim() : "";
  if (raw.length < 3 || raw.length > MAX_REASON) {
    res.status(400).json({
      error: `A reason of 3-${MAX_REASON} characters is required`,
    });
    return null;
  }
  return raw;
}

function normalizeAction(action) {
  if (action === "approve" || action === "restore") return "restore";
  if (action === "hide" || action === "delete") return action;
  return null;
}

function contentLabel(item, fallback) {
  return item?.title || item?.content?.slice(0, 80) || fallback;
}

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

    const [flaggedPosts, flaggedComments, flaggedTheses, messageReports] =
      await Promise.all([
        postModel.getFlaggedPosts({ departmentId }),
        postModel.getFlaggedComments({ departmentId }),
        thesisModel.getFlaggedTheses({ departmentId }),
        messageModel.listOpenMessageReports({ departmentId }),
      ]);

    res.json({
      department_id: departmentId,
      totalFlagged:
        flaggedPosts.length +
        flaggedComments.length +
        flaggedTheses.length +
        messageReports.length,
      flaggedPosts,
      flaggedComments,
      flaggedTheses,
      messageReports,
    });
  } catch (err) {
    next(err);
  }
};

const moderatePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const action = normalizeAction(req.body.action);

    if (!action) {
      return res.status(400).json({
        error: "Invalid moderation action. Must be 'approve'/'restore', 'hide', or 'delete'",
      });
    }

    const post = await postModel.getPostById(id, { includeHidden: true });
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Department admins are scoped to their own department; campus admins are not.
    if (!withinDepartmentScope(req, res, post.author?.department_id)) return;

    const reason = readReason(req, res);
    if (!reason) return;

    if (action === "delete" && !isSuperAdmin(req)) {
      return res.status(403).json({
        error: "Forbidden: only a superadmin can permanently delete content",
      });
    }

    if (action === "restore") {
      const updated = await postModel.updatePostModeration(id, "approved", reason);
      await auditService.recordRequest(req, {
        action: ACTIONS.CONTENT_RESTORE,
        targetType: "post",
        targetId: id,
        targetLabel: contentLabel(post, "Post"),
        reason,
        metadata: { previous_status: post.moderation_status || null },
      });
      return res.json({ message: "Post restored", post: updated });
    }

    if (action === "hide") {
      const updated = await postModel.updatePostModeration(id, "hidden", reason);
      await notificationService.notifyAuthorOnAction({
        authorId: post.author_id,
        actorId: req.user.id,
        message: `Your post "${post.title || "Post"}" was hidden by an administrator: ${reason}`,
      });
      await auditService.recordRequest(req, {
        action: ACTIONS.CONTENT_HIDE,
        targetType: "post",
        targetId: id,
        targetLabel: contentLabel(post, "Post"),
        reason,
        metadata: { previous_status: post.moderation_status || null },
      });
      return res.json({ message: "Post hidden", post: updated });
    }

    await postModel.adminDeletePost(id);
    await notificationService.notifyAuthorOnAction({
      authorId: post.author_id,
      actorId: req.user.id,
      message: `Your post "${post.title || "Post"}" was removed by an administrator: ${reason}`,
    });
    await auditService.recordRequest(req, {
      action: ACTIONS.CONTENT_DELETE,
      targetType: "post",
      targetId: id,
      targetLabel: contentLabel(post, "Post"),
      reason,
      metadata: { previous_status: post.moderation_status || null },
    });
    return res.json({ message: "Post permanently deleted" });
  } catch (err) {
    next(err);
  }
};

const moderateComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const action = normalizeAction(req.body.action);

    if (!action) {
      return res.status(400).json({
        error: "Invalid moderation action. Must be 'approve'/'restore', 'hide', or 'delete'",
      });
    }

    const comment = await postModel.getCommentById(id);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    // Same department rule as posts, scoped on the commenter's department so it
    // lines up with the queue filter in `getFlaggedComments`.
    if (!withinDepartmentScope(req, res, comment.author?.department_id)) return;

    const reason = readReason(req, res);
    if (!reason) return;

    if (action === "delete" && !isSuperAdmin(req)) {
      return res.status(403).json({
        error: "Forbidden: only a superadmin can permanently delete content",
      });
    }

    if (action === "restore") {
      const updated = await postModel.updateCommentModeration(id, "approved", reason);
      await auditService.recordRequest(req, {
        action: ACTIONS.CONTENT_RESTORE,
        targetType: "comment",
        targetId: id,
        targetLabel: contentLabel(comment, "Comment"),
        reason,
        metadata: { previous_status: comment.moderation_status || null },
      });
      return res.json({ message: "Comment restored", comment: updated });
    }

    if (action === "hide") {
      const updated = await postModel.updateCommentModeration(id, "hidden", reason);
      await auditService.recordRequest(req, {
        action: ACTIONS.CONTENT_HIDE,
        targetType: "comment",
        targetId: id,
        targetLabel: contentLabel(comment, "Comment"),
        reason,
        metadata: { previous_status: comment.moderation_status || null },
      });
      return res.json({ message: "Comment hidden", comment: updated });
    }

    await postModel.deleteComment(id);
    await auditService.recordRequest(req, {
      action: ACTIONS.CONTENT_DELETE,
      targetType: "comment",
      targetId: id,
      targetLabel: contentLabel(comment, "Comment"),
      reason,
      metadata: { previous_status: comment.moderation_status || null },
    });
    return res.json({ message: "Comment deleted" });
  } catch (err) {
    next(err);
  }
};

const moderateThesis = async (req, res, next) => {
  try {
    const { id } = req.params;
    const action = normalizeAction(req.body.action);

    if (!action) {
      return res.status(400).json({
        error: "Invalid moderation action. Must be 'approve'/'restore', 'hide', or 'delete'",
      });
    }

    const thesis = await thesisModel.getThesisById(id);
    if (!thesis) {
      return res.status(404).json({ error: "Thesis not found" });
    }

    if (!withinDepartmentScope(req, res, thesis.uploader?.department_id)) return;

    const reason = readReason(req, res);
    if (!reason) return;

    if (action === "delete" && !isSuperAdmin(req)) {
      return res.status(403).json({
        error: "Forbidden: only a superadmin can permanently delete content",
      });
    }

    if (action === "restore") {
      const updated = await thesisModel.updateThesisModeration(id, "approved", reason);
      await auditService.recordRequest(req, {
        action: ACTIONS.CONTENT_RESTORE,
        targetType: "thesis",
        targetId: id,
        targetLabel: contentLabel(thesis, "Thesis"),
        reason,
        metadata: { previous_status: thesis.moderation_status || null },
      });
      return res.json({ message: "Thesis restored", thesis: updated });
    }

    if (action === "hide") {
      const updated = await thesisModel.updateThesisModeration(id, "hidden", reason);
      await notificationService.notifyAuthorOnAction({
        authorId: thesis.uploader_id,
        actorId: req.user.id,
        message: `Your thesis "${thesis.title}" was hidden by an administrator: ${reason}`,
      });
      await auditService.recordRequest(req, {
        action: ACTIONS.CONTENT_HIDE,
        targetType: "thesis",
        targetId: id,
        targetLabel: contentLabel(thesis, "Thesis"),
        reason,
        metadata: { previous_status: thesis.moderation_status || null },
      });
      return res.json({ message: "Thesis hidden", thesis: updated });
    }

    await thesisModel.adminDeleteThesis(id);
    await notificationService.notifyAuthorOnAction({
      authorId: thesis.uploader_id,
      actorId: req.user.id,
      message: `Your thesis "${thesis.title}" was removed by an administrator: ${reason}`,
    });
    await auditService.recordRequest(req, {
      action: ACTIONS.CONTENT_DELETE,
      targetType: "thesis",
      targetId: id,
      targetLabel: contentLabel(thesis, "Thesis"),
      reason,
      metadata: { previous_status: thesis.moderation_status || null },
    });
    return res.json({ message: "Thesis permanently deleted" });
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

    const reason = readReason(req, res);
    if (!reason) return;

    const updated = await messageModel.resolveMessageReport(id, action);
    await auditService.recordRequest(req, {
      action: action === "reviewed" ? ACTIONS.REPORT_REVIEW : ACTIONS.REPORT_DISMISS,
      targetType: "report",
      targetId: id,
      targetLabel: `Report ${id}`,
      reason,
      metadata: {
        message_id: report.message_id || null,
        report_reason: report.reason || null,
        status: action,
      },
    });
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
  moderateThesis,
  moderateMessageReport,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
