const express = require("express");
const router = express.Router();
const moderationController = require("../controllers/moderationController");
const notificationModel = require("../models/notificationModel");

// Authenticated notification routes
router.get("/", moderationController.getNotifications);

router.get("/unread-count", async (req, res, next) => {
  try {
    const unread = await notificationModel.getUnreadCount(req.user.id);
    res.json({ unread });
  } catch (err) {
    next(err);
  }
});

router.put("/:id/read", moderationController.markNotificationRead);
router.post("/read-all", moderationController.markAllNotificationsRead);

module.exports = router;

