const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const { requireVerified } = require("../middleware/auth");
const { reportLimiter } = require("../middleware/actionLimits");

// Mounted at /api/reports. Listing and resolution live in the moderation
// queue (`GET /api/moderation/queue`, `POST /api/moderation/reports/:id`);
// this endpoint only creates reports.
router.post("/", reportLimiter, requireVerified, postController.createReport);

module.exports = router;
