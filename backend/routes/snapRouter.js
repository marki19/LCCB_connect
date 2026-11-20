const express = require("express");
const router = express.Router();
const snapController = require("../controllers/snapController");
const { requireAuth, loadProfile, requireActiveAccount, requireVerified } = require("../middleware/auth");
const { validate, createSnapSchema, snapReactionSchema } = require("../validation");

// All snap routes require authentication and an active account
router.use(requireAuth, loadProfile, requireActiveAccount);

// Reads are open to any active account, guests included.
router.get("/rail", snapController.getRail);
router.get("/user/:userId", snapController.getUserSnaps);
router.get("/:id", snapController.getSnap);

// Every mutation is gated on a verified identity. Guest accounts are read-only,
// which is exactly what `requireVerified` enforces everywhere else.
router.post("/", requireVerified, validate(createSnapSchema), snapController.createSnap);
router.post("/:id/view", requireVerified, snapController.recordView);
router.post("/:id/react", requireVerified, validate(snapReactionSchema), snapController.react);
router.delete("/:id/react", requireVerified, snapController.unreact);
router.delete("/:id", requireVerified, snapController.deleteSnap);

module.exports = router;
