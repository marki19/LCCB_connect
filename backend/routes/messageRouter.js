const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const { reportLimiter } = require("../middleware/messagingLimits");
const { validate, reportMessageSchema } = require("../validation");

// Mounted at /api/messages behind requireAuth + loadProfile.

router.post("/:id/delivered", messageController.markDelivered);
router.post("/:id/report", reportLimiter, validate(reportMessageSchema), messageController.reportMessage);

module.exports = router;
