const express = require("express");
const router = express.Router();
const controller = require("../controllers/verificationController");
const { requireAuth, loadProfile, requireActiveAccount, requireRole } = require("../middleware/auth");
const { validate, verificationSubmitSchema, verificationDecisionSchema } = require("../validation");

/**
 * Verification endpoints are mounted at /api/verification behind:
 *   requireAuth + loadProfile + requireActiveAccount
 *
 * They are NOT behind requireVerified — an unverified student is exactly
 * who calls these endpoints.
 */

// All routes need an authenticated, active account.
router.use(requireAuth, loadProfile, requireActiveAccount);

// Student self-service
router.get("/mine", controller.getMine);
router.post("/", validate(verificationSubmitSchema), controller.submit);
router.put("/mine", validate(verificationSubmitSchema), controller.updateMine);

// Admin/Department-admin queue and actions
router.get("/queue", requireRole("departmentAdmin", "admin", "superadmin"), controller.queue);
router.post("/:id/approve", requireRole("departmentAdmin", "admin", "superadmin"), controller.approve);
router.post(
  "/:id/decline",
  requireRole("departmentAdmin", "admin", "superadmin"),
  validate(verificationDecisionSchema),
  controller.decline
);

module.exports = router;