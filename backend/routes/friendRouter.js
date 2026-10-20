const express = require("express");
const router = express.Router();
const friendController = require("../controllers/friendController");
const { friendRequestLimiter } = require("../middleware/messagingLimits");
const { validate, friendRequestSchema } = require("../validation");

// Mounted at /api/friends behind requireAuth + loadProfile.

router.get("/", friendController.listFriends);
router.get("/requests", friendController.getRequests);
router.post(
  "/requests",
  friendRequestLimiter,
  validate(friendRequestSchema),
  friendController.createRequest
);
router.post("/requests/:id/accept", friendController.acceptRequest);
router.post("/requests/:id/decline", friendController.declineRequest);
router.delete("/:userId", friendController.removeFriend);

module.exports = router;
