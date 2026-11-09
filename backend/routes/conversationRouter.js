const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const { messagingSendLimiter, messagingDailyLimiter } = require("../middleware/messagingLimits");
const { requireVerified } = require("../middleware/auth");
const {
  validate,
  createConversationSchema,
  sendMessageSchema,
  markReadSchema,
  muteConversationSchema,
} = require("../validation");

// Mounted at /api/conversations behind requireAuth + loadProfile.
// Ordering (literal paths before /:id) keeps them unambiguous.

router.get("/", messageController.getConversations);
router.get("/requests", messageController.getRequests);
router.get("/unread-count", messageController.getUnreadCount);
router.post("/", requireVerified, validate(createConversationSchema), messageController.createConversation);

router.post("/:id/accept", messageController.acceptRequest);
router.get("/:id/messages", messageController.getMessages);
router.post(
  "/:id/messages",
  requireVerified,
  messagingSendLimiter,
  messagingDailyLimiter,
  validate(sendMessageSchema),
  messageController.sendMessage
);
router.post("/:id/read", requireVerified, validate(markReadSchema), messageController.markRead);
router.post("/:id/mute", requireVerified, validate(muteConversationSchema), messageController.muteConversation);

module.exports = router;
