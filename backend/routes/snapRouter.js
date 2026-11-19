const express = require("express");
const router = express.Router();
const snapController = require("../controllers/snapController");
const { requireAuth, loadProfile, requireActiveAccount } = require("../middleware/auth");
const { validate, createSnapSchema, snapReactionSchema } = require("../validation");

// All snap routes require authentication and an active account
router.use(requireAuth, loadProfile, requireActiveAccount);

router.get("/rail", snapController.getRail);
router.get("/user/:userId", snapController.getUserSnaps);
router.get("/:id", snapController.getSnap);
router.post("/", validate(createSnapSchema), snapController.createSnap);
router.post("/:id/view", snapController.recordView);
router.post("/:id/react", validate(snapReactionSchema), snapController.react);
router.delete("/:id/react", snapController.unreact);
router.delete("/:id", snapController.deleteSnap);

module.exports = router;
