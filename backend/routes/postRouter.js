const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const savedPostController = require("../controllers/savedPostController");
const savedCollectionController = require("../controllers/savedCollectionController");
const { loadProfile, requireVerified } = require("../middleware/auth");
const {
  postCreateLimiter,
  postDailyLimiter,
  repostLimiter,
  repostDailyLimiter,
  commentCreateLimiter,
  commentDailyLimiter,
  likeLimiter,
  linkPreviewLimiter,
} = require("../middleware/actionLimits");
const {
  validate,
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  updateCommentSchema,
} = require("../validation");

// Saved posts feed & collections (MUST be declared before /:id)
router.get("/saved", savedPostController.list);
router.get("/saved/collections", savedCollectionController.list);
router.post("/saved/collections", requireVerified, savedCollectionController.create);
router.post("/saved/collections/:id/items", requireVerified, savedCollectionController.addItem);
router.delete("/saved/collections/:id/items/:postId", requireVerified, savedCollectionController.removeItem);
router.delete("/saved/collections/:id", requireVerified, savedCollectionController.remove);

// Routes (global requireAuth is applied when this router is mounted in app.js)
router.get("/", postController.getPosts);
router.get("/:id", postController.getPost);
router.post(
  "/",
  postCreateLimiter,
  postDailyLimiter,
  loadProfile,
  requireVerified,
  validate(createPostSchema),
  postController.createPost
);
router.put("/:id", requireVerified, validate(updatePostSchema), postController.updatePost);
router.delete("/:id", requireVerified, postController.deletePost);

// Saved posts bookmarking
router.post("/:id/save", requireVerified, savedPostController.save);
router.delete("/:id/save", requireVerified, savedPostController.unsave);

// Reposts
router.post("/:id/repost", repostLimiter, repostDailyLimiter, requireVerified, postController.createRepost);
router.delete("/:id/repost", requireVerified, postController.undoRepost);
router.get("/:id/reposts", postController.getReposts);

// Pure Raw SQL Likes and Comments
router.post("/:id/like", likeLimiter, requireVerified, postController.toggleLike);
router.get("/:id/comments", postController.getComments);
router.post(
  "/:id/comments",
  commentCreateLimiter,
  commentDailyLimiter,
  loadProfile,
  requireVerified,
  validate(createCommentSchema),
  postController.addComment
);
// Author-scoped comment edit/delete (ownership enforced in SQL -> 404).
router.put("/:id/comments/:commentId", loadProfile, requireVerified, validate(updateCommentSchema), postController.updateComment);
router.delete("/:id/comments/:commentId", requireVerified, postController.deleteComment);

// Post image signed URL (private assets bucket)
router.get("/:id/file", postController.getPostFile);

// Link preview generation
router.post("/preview", linkPreviewLimiter, requireVerified, postController.generatePreview);

module.exports = router;


