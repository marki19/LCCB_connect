const postModel = require("../models/postModel");
const { clampLimit } = require("../models/pagination");
const { parseSearch, parseUuidFilter } = require("../utils/queryFilters");
const moderationService = require("../services/moderationService");
const notificationService = require("../services/notificationService");
const previewService = require("../services/previewService");
const { resolveAudience } = require("../services/visibilityService");
const { signedStorageUrl } = require("../services/storageService");

/**
 * A custom-visibility write must name accepted friends. Returns the normalized
 * audience, or a `{ error, invalid }` payload the controller returns as 400.
 * Anything else (public/friends/private) carries no audience.
 */
const resolveRequestBodyAudience = async (authorId, body) => {
  if (body.audience === undefined && body.visibility !== "custom") {
    return { body };
  }
  const resolved = await resolveAudience(authorId, body.audience ?? []);
  if (resolved.error) return { error: resolved.error, invalid: resolved.invalid };
  return { body: { ...body, audience: resolved.audience } };
};

// Errors are forwarded to the centralized handler in index.js, which logs
// server-side and returns a generic message (never the raw DB error).
const getPosts = async (req, res, next) => {
  try {
    // Optional filters: ?q=<text>&author_id=<uuid>&visibility=<public|friends|...>
    // plus keyset pagination: ?limit=<1..100>&cursor=<created_at>|<id>
    const author = parseUuidFilter(req.query.author_id, "author_id");
    if (author.error) {
      return res.status(400).json({ error: author.error });
    }

    const posts = await postModel.visiblePostsFor({
      viewerId: req.user?.id || null,
      limit: clampLimit(req.query.limit),
      cursor: req.query.cursor || null,
      q: parseSearch(req.query.q),
      authorId: author.value,
      visibility: req.query.visibility || null,
    });
    res.json(posts);
  } catch (error) {
    next(error);
  }
};

const getPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await postModel.visiblePostsFor({
      viewerId: req.user?.id || null,
      postId: id,
      includeHidden: false,
    });
    const post = result.posts[0];
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.json(post);
  } catch (error) {
    next(error);
  }
};

const createPost = async (req, res, next) => {
  try {
    // Verify user identity is complete before allowing post creation
    if (!req.profile?.profile_completed) {
      return res.status(403).json({
        error: "Profile incomplete",
        message: "Complete your profile (full name, student ID, department, and course) before creating posts.",
        code: "PROFILE_INCOMPLETE",
      });
    }

    // Verify user identity is verified before allowing post creation
    if (!req.profile?.identity_complete) {
      return res.status(403).json({
        error: "Identity verification required",
        message: "Complete your student identity verification before creating posts.",
        code: "VERIFICATION_REQUIRED",
      });
    }

    const resolved = await resolveRequestBodyAudience(req.user.id, req.body);
    if (resolved.error) {
      return res.status(400).json({ error: resolved.error, invalid: resolved.invalid });
    }

    const newPost = await postModel.createPost({
      ...resolved.body,
      author_id: req.user.id,
    });
    res.status(201).json(newPost);

    // Asynchronously notify admins and run AI content analysis
    Promise.resolve().then(async () => {
      try {
        await notificationService.notifyAdminsOnPostCreated(newPost, req.profile);
        const scan = await moderationService.scanPost(newPost);
        if (scan && scan.flagged) {
          await postModel.updatePostModeration(newPost.id, "flagged", scan.reason);
          await notificationService.notifyAdminsOnFlaggedContent({
            targetId: newPost.id,
            type: "post",
            reason: scan.reason,
            departmentId: req.profile?.department_id,
            departmentName: req.profile?.department_name,
            authorId: req.user.id,
            snippet: (newPost.title || newPost.content || "").slice(0, 80),
          });
        }
      } catch (scanErr) {
        console.error("[moderation] Background post scan failed:", scanErr);
      }
    });
  } catch (error) {
    next(error);
  }
};

const updatePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const resolved = await resolveRequestBodyAudience(req.user.id, req.body);
    if (resolved.error) {
      return res.status(400).json({ error: resolved.error, invalid: resolved.invalid });
    }
    // Ownership is enforced in SQL (author_id = caller). An unauthorized caller
    // receives the same 404 as a missing post.
    const updated = await postModel.updatePost(id, req.user.id, resolved.body);
    if (!updated) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await postModel.softDeletePost(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.json({ message: "Post deleted successfully", post: deleted });
  } catch (error) {
    next(error);
  }
};

const toggleLike = async (req, res, next) => {
  try {
    const { id } = req.params;
    // The liking user is the authenticated caller, not a body field.
    const result = await postModel.toggleLike(id, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getComments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const viewerId = req.user?.id || null;
    const post = await postModel.getPostById(id, { includeHidden: false, userId: viewerId });
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comments = await postModel.getComments(id, { viewerId });
    res.json(comments);
  } catch (error) {
    next(error);
  }
};

const addComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const post = await postModel.getPostById(id, {
      includeHidden: false,
      userId: req.user?.id || null,
    });
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = await postModel.addComment(id, req.user.id, content, {
      moderation_status: "approved",
    });
    res.status(201).json(comment);

    // Asynchronously scan comment for foul/inappropriate language
    Promise.resolve().then(async () => {
      try {
        const scan = await moderationService.scanComment(content);
        if (scan && scan.flagged) {
          await postModel.updateCommentModeration(comment.id, "flagged", scan.reason);
          await notificationService.notifyAdminsOnFlaggedContent({
            targetId: comment.id,
            type: "comment",
            reason: scan.reason,
            departmentId: req.profile?.department_id,
            departmentName: req.profile?.department_name,
            authorId: req.user.id,
            snippet: content.slice(0, 80),
          });
        }
      } catch (scanErr) {
        console.error("[moderation] Background comment scan failed:", scanErr);
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateComment = async (req, res, next) => {
  try {
    const { id: postId, commentId } = req.params;
    const { content } = req.body;
    // Ownership is enforced in SQL (user_id = caller, and the comment must be
    // attached to the post in the path). An unauthorized or hidden comment
    // receives the same 404 as a missing one.
    const updated = await postModel.updateCommentByAuthor(
      commentId,
      postId,
      req.user.id,
      content
    );
    if (!updated) {
      return res.status(404).json({ message: "Comment not found" });
    }
    res.json(updated);

    // Asynchronously re-scan the edited text (same posture as comment creation,
    // since the edit reset the moderation status to approved).
    Promise.resolve().then(async () => {
      try {
        const scan = await moderationService.scanComment(updated.content);
        if (scan && scan.flagged) {
          await postModel.updateCommentModeration(updated.id, "flagged", scan.reason);
          await notificationService.notifyAdminsOnFlaggedContent({
            targetId: updated.id,
            type: "comment",
            reason: scan.reason,
            departmentId: req.profile?.department_id,
            departmentName: req.profile?.department_name,
            authorId: req.user.id,
            snippet: updated.content.slice(0, 80),
          });
        }
      } catch (scanErr) {
        console.error("[moderation] Background comment re-scan failed:", scanErr);
      }
    });
  } catch (error) {
    next(error);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const { id: postId, commentId } = req.params;
    const deleted = await postModel.deleteCommentByAuthor(
      commentId,
      postId,
      req.user.id
    );
    if (!deleted) {
      return res.status(404).json({ message: "Comment not found" });
    }
    res.json({ message: "Comment deleted successfully", comment: deleted });
  } catch (error) {
    next(error);
  }
};

const generatePreview = async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "A valid URL string is required" });
    }
    const preview = await previewService.fetchLinkPreview(url);
    res.json(preview);
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to generate link preview" });
  }
};

/**
 * GET /api/posts/:id/file — signed URL for the post image.
 *
 * Returns a signed URL that the front-end can use to display the image.
 * The URL expires after 5 minutes. Only the owner, visible viewers, or
 * a moderator can access this endpoint.
 */
const getPostFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const viewerId = req.user?.id || null;

    // Visibility is enforced by the model's use of visible_posts().
    const result = await postModel.visiblePostsFor({
      viewerId,
      postId: id,
      includeHidden: false,
    });
    const post = result.posts[0];
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (!post.image_url) {
      return res.status(404).json({ message: "Post has no image" });
    }

    // Issue a signed URL for the private assets bucket.
    const { url } = await signedStorageUrl("assets", post.image_url, { expiresIn: 300 });

    if (!url) {
      return res.status(404).json({ message: "Could not generate file URL" });
    }

    res.json({ url });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// REPOST ENDPOINTS
// ============================================================================

const repostModel = require("../models/repostModel");
const notificationModel = require("../models/notificationModel");

const createRepost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { caption } = req.body ?? {};
    const reposterId = req.user.id;

    const repost = await repostModel.createRepost(id, reposterId, caption);
    if (!repost) {
      return res.status(404).json({ message: "Original post not found or not visible" });
    }

    // Notify the original author (the model skips self-reposts).
    await notificationModel.createRepostNotification(
      repost.original_post?.author_id,
      reposterId,
      repost.id
    );

    res.status(201).json(repost);
  } catch (error) {
    const mapped = REPOST_ERRORS[error.code];
    if (mapped) {
      return res.status(mapped[0]).json({ error: mapped[1] });
    }
    next(error);
  }
};

// Codes thrown by repostModel.createRepost, mapped to the HTTP contract the
// client already renders.
const REPOST_ERRORS = {
  ALREADY_REPOSTED: [409, "Already reposted this post"],
  BLOCKED: [403, "Cannot repost blocked user's content"],
  REPOSTS_NOT_ALLOWED: [403, "Author has disabled reposts"],
  POST_NOT_FOUND: [404, "Original post not found or not visible"],
};

const undoRepost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reposterId = req.user.id;

    const repost = await repostModel.undoRepost(id, reposterId);
    if (!repost) {
      return res.status(404).json({ message: "Repost not found" });
    }

    res.json({ message: "Repost removed", repost });
  } catch (error) {
    next(error);
  }
};

const getReposts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const viewerId = req.user?.id || null;

    const reposts = await repostModel.getVisibleRepostsForPost(id, viewerId, {
      limit: clampLimit(req.query.limit),
      cursor: req.query.cursor || null,
    });
    res.json(reposts);
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// REPORT ENDPOINTS
// ============================================================================

const reportModel = require("../models/reportModel");

const createReport = async (req, res, next) => {
  try {
    const { targetType, targetId, reason, note } = req.body;
    const reporterId = req.user.id;

    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ error: "targetType, targetId, and reason are required" });
    }

    const report = await reportModel.createReport(reporterId, targetType, targetId, reason, note);
    res.status(201).json(report);
  } catch (error) {
    if (error.code === "DUPLICATE_REPORT") {
      return res.status(409).json({ error: "Already reported this content" });
    }
    if (error.code === "INVALID_TARGET_TYPE" || error.code === "INVALID_REASON") {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

// Admin only - list reports
const listReports = async (req, res, next) => {
  try {
    // Role lives on the profile loaded by loadProfile, not on the auth user.
    const role = req.profile?.role;
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { status, targetType, limit, cursor } = req.query;
    const reports = await reportModel.listReports({
      status: status || null,
      targetType: targetType || null,
      limit: clampLimit(limit),
      cursor: cursor || null,
    });
    res.json(reports);
  } catch (error) {
    next(error);
  }
};

// Admin only - update report status
const updateReportStatus = async (req, res, next) => {
  try {
    const role = req.profile?.role;
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "status is required" });
    }

    const report = await reportModel.updateReportStatus(id, status, req.user.id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    res.json(report);
  } catch (error) {
    if (error.code === "INVALID_STATUS") {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

// ============================================================================
// BLOCK ENDPOINTS
// ============================================================================

const blockModel = require("../models/blockModel");

const blockUser = async (req, res, next) => {
  try {
    const { blockedId } = req.body;
    const blockerId = req.user.id;

    if (!blockedId) {
      return res.status(400).json({ error: "blockedId is required" });
    }

    const block = await blockModel.blockUser(blockerId, blockedId);
    res.status(201).json(block);
  } catch (error) {
    if (error.code === "CANNOT_BLOCK_SELF") {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === "ALREADY_BLOCKED") {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
};

const unblockUser = async (req, res, next) => {
  try {
    const { blockedId } = req.params;
    const blockerId = req.user.id;

    const block = await blockModel.unblockUser(blockerId, blockedId);
    if (!block) {
      return res.status(404).json({ message: "Block not found" });
    }

    res.json({ message: "User unblocked", block });
  } catch (error) {
    next(error);
  }
};

const listBlocked = async (req, res, next) => {
  try {
    const blockerId = req.user.id;
    const blocked = await blockModel.listBlocked(blockerId, {
      limit: clampLimit(req.query.limit),
      cursor: req.query.cursor || null,
    });
    res.json(blocked);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  toggleLike,
  getComments,
  addComment,
  updateComment,
  deleteComment,
  generatePreview,
  getPostFile,
  // Reposts
  createRepost,
  undoRepost,
  getReposts,
  // Reports
  createReport,
  listReports,
  updateReportStatus,
  // Blocks
  blockUser,
  unblockUser,
  listBlocked,
};
