const postModel = require("../models/postModel");
const { clampLimit } = require("../models/pagination");
const moderationService = require("../services/moderationService");
const notificationService = require("../services/notificationService");
const previewService = require("../services/previewService");

// Errors are forwarded to the centralized handler in index.js, which logs
// server-side and returns a generic message (never the raw DB error).
const getPosts = async (req, res, next) => {
  try {
    // Optional keyset pagination: ?limit=<1..100>&cursor=<created_at>|<id>
    const posts = await postModel.getAllPosts({
      limit: clampLimit(req.query.limit),
      cursor: req.query.cursor || null,
    });
    res.json(posts);
  } catch (error) {
    next(error);
  }
};

const getPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await postModel.getPostById(id);
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
    const newPost = await postModel.createPost({
      ...req.body,
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
    // Ownership is enforced in SQL (author_id = caller). An unauthorized caller
    // receives the same 404 as a missing post.
    const updated = await postModel.updatePost(id, req.user.id, req.body);
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
    const deleted = await postModel.deletePost(id, req.user.id);
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
    const post = await postModel.getPostById(id, { includeHidden: false });
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comments = await postModel.getComments(id);
    res.json(comments);
  } catch (error) {
    next(error);
  }
};

const addComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const post = await postModel.getPostById(id, { includeHidden: false });
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
};
