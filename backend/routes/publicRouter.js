const express = require("express");
const router = express.Router();
const publicController = require("../controllers/publicController");
const catalogController = require("../controllers/catalogController");

// Pure read-only public routes (accessible without bearer token)
router.get("/posts", publicController.getPosts);
router.get("/posts/:id", publicController.getPostById);
router.get("/posts/:id/comments", publicController.getComments);
router.get("/theses", publicController.getTheses);
router.get("/theses/:id", publicController.getThesisById);
router.get("/peers", publicController.getPeers);

// Catalog pickers for the (pre-login) registration form — active entries only.
router.get("/departments", catalogController.getDepartments);
router.get("/departments/:id/courses", catalogController.getCourses);

module.exports = router;
