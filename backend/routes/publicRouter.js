const express = require("express");
const router = express.Router();
const publicController = require("../controllers/publicController");

// Pure read-only public routes (accessible without bearer token)
router.get("/posts", publicController.getPosts);
router.get("/posts/:id", publicController.getPostById);
router.get("/posts/:id/comments", publicController.getComments);
router.get("/theses", publicController.getTheses);
router.get("/theses/:id", publicController.getThesisById);
router.get("/peers", publicController.getPeers);

module.exports = router;
