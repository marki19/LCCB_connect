const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const { requireVerified } = require("../middleware/auth");

// Mounted at /api/reports. The handlers live in postController because reports
// share the post visibility rules.
router.post("/", requireVerified, postController.createReport);
router.get("/", requireVerified, postController.listReports);
router.put("/:id", requireVerified, postController.updateReportStatus);

module.exports = router;
