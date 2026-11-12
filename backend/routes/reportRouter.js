const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const { requireVerified } = require("../middleware/auth");
const { reportLimiter } = require("../middleware/actionLimits");

// Mounted at /api/reports. The handlers live in postController because reports
// share the post visibility rules.
router.post("/", reportLimiter, requireVerified, postController.createReport);
router.get("/", requireVerified, postController.listReports);
router.put("/:id", requireVerified, postController.updateReportStatus);

module.exports = router;
