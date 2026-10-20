const express = require("express");
const router = express.Router();
const moderationController = require("../controllers/moderationController");
const { loadProfile, requireRole } = require("../middleware/auth");

// Notifications routes (any authenticated user)
router.get("/notifications", moderationController.getNotifications);
router.put("/notifications/:id/read", moderationController.markNotificationRead);
router.post("/notifications/read-all", moderationController.markAllNotificationsRead);

// Moderation queue & actions (departmentAdmin, admin, superAdmin)
const requireModerator = [
  loadProfile,
  requireRole("departmentAdmin", "department_admin", "admin", "superadmin", "superAdmin"),
];

router.get("/queue", ...requireModerator, moderationController.getModerationQueue);
router.post("/posts/:id", ...requireModerator, moderationController.moderatePost);
router.post("/comments/:id", ...requireModerator, moderationController.moderateComment);
router.post("/theses/:id", ...requireModerator, moderationController.moderateThesis);
router.post("/message-reports/:id", ...requireModerator, moderationController.moderateMessageReport);

module.exports = router;
