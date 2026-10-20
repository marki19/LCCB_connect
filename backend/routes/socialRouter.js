const express = require("express");
const router = express.Router();
const socialController = require("../controllers/socialController");
const {
  validate,
  messagePolicySchema,
  presenceSchema,
  heartbeatSchema,
  deviceTokenSchema,
  deleteDeviceTokenSchema,
} = require("../validation");

// Mounted at /api/users behind requireAuth. Literal `/me/...` paths never collide
// with the profile-CRUD router's single-segment `/:id` routes, so Express falls
// through to this router after requireAuth has already verified the token.

router.get("/me/message-policy", socialController.getMessagePolicy);
router.put(
  "/me/message-policy",
  validate(messagePolicySchema),
  socialController.setMessagePolicy
);

router.post("/me/presence", validate(presenceSchema), socialController.setPresence);
router.post("/me/heartbeat", validate(heartbeatSchema), socialController.heartbeat);

router.post("/me/device-tokens", validate(deviceTokenSchema), socialController.addDeviceToken);
router.delete(
  "/me/device-tokens",
  validate(deleteDeviceTokenSchema),
  socialController.removeDeviceToken
);

router.get("/me/blocks", socialController.listBlocked);
router.post("/:id/block", socialController.blockUser);
router.delete("/:id/block", socialController.unblockUser);

module.exports = router;
