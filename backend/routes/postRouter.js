const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");

router.get("/", postController.getPosts);
router.get("/:id", postController.getPost);
router.post("/", postController.createPost);
router.put("/:id", postController.updatePost);
router.delete("/:id", postController.deletePost);

// Pure Raw SQL Likes and Comments
router.post("/:id/like", postController.toggleLike);
router.get("/:id/comments", postController.getComments);
router.post("/:id/comments", postController.addComment);

module.exports = router;
