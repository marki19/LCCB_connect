const express = require("express");
const router = express.Router();
const friendController = require("../controllers/friendController");
const { friendRequestLimiter } = require("../middleware/messagingLimits");
const { requireVerified } = require("../middleware/auth");
const { validate, friendRequestSchema } = require("../validation");

// Mounted at /api/friends behind requireAuth + loadProfile.

router.get("/", friendController.listFriends);
router.get("/requests", friendController.getRequests);
router.post(
  "/requests",
  requireVerified,
  friendRequestLimiter,
  validate(friendRequestSchema),
  friendController.createRequest
);
router.post("/requests/:id/accept", requireVerified, friendController.acceptRequest);
router.post("/requests/:id/decline", requireVerified, friendController.declineRequest);
router.delete("/:userId", requireVerified, friendController.removeFriend);

module.exports = router;
