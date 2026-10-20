const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const { loadProfile } = require("../middleware/auth");
const {
  validate,
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  updateCommentSchema,
} = require("../validation");

// Routes (global requireAuth is applied when this router is mounted in app.js)
router.get("/", postController.getPosts);
router.get("/:id", postController.getPost);
router.post("/", loadProfile, validate(createPostSchema), postController.createPost);
router.put("/:id", validate(updatePostSchema), postController.updatePost);
router.delete("/:id", postController.deletePost);

// Pure Raw SQL Likes and Comments
router.post("/:id/like", postController.toggleLike);
router.get("/:id/comments", postController.getComments);
router.post("/:id/comments", loadProfile, validate(createCommentSchema), postController.addComment);
// Author-scoped comment edit/delete (ownership enforced in SQL -> 404).
router.put("/:id/comments/:commentId", loadProfile, validate(updateCommentSchema), postController.updateComment);
router.delete("/:id/comments/:commentId", postController.deleteComment);

// Link preview generation
router.post("/preview", postController.generatePreview);

module.exports = router;


