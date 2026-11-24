const express = require("express");
const router = express.Router();
const moderationController = require("../controllers/moderationController");
const { loadProfile, requireRole } = require("../middleware/auth");

// Notifications live under /api/notifications (notificationRouter); this router
// only owns moderation queue actions.

// Moderation queue & actions (departmentAdmin, admin, superAdmin)
const requireModerator = [
  loadProfile,
  requireRole("departmentAdmin", "department_admin", "admin", "superadmin", "superAdmin"),
];

router.get("/queue", ...requireModerator, moderationController.getModerationQueue);
router.post("/posts/:id", ...requireModerator, moderationController.moderatePost);
router.post("/comments/:id", ...requireModerator, moderationController.moderateComment);
router.post("/theses/:id", ...requireModerator, moderationController.moderatePost); // Backwards-compatible alias for thesis posts
router.post("/message-reports/:id", ...requireModerator, moderationController.moderateMessageReport);
router.post("/reports/:id", ...requireModerator, moderationController.moderateReport);

module.exports = router;
