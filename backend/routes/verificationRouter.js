const express = require("express");
const router = express.Router();
const controller = require("../controllers/verificationController");
const { requireAuth, loadProfile, requireActiveAccount, requireRole } = require("../middleware/auth");
const { verificationOtpLimiter } = require("../middleware/actionLimits");
const {
  validate,
  verificationSubmitSchema,
  verificationOtpSchema,
  verificationDecisionSchema,
} = require("../validation");

/**
 * Verification endpoints are mounted at /api/verification behind:
 *   requireAuth + loadProfile + requireActiveAccount
 *
 * They are NOT behind requireVerified — an unverified account is exactly who
 * calls these endpoints. Which role may verify at all (everyone except
 * superadmin) and who reviews whom is decided in
 * `services/verificationPolicy.js`, not by the mount.
 */

// All routes need an authenticated, active account.
router.use(requireAuth, loadProfile, requireActiveAccount);

// Self-service. The code is emailed to the caller's own school account, so the
// body is empty and the address never comes from the client.
router.post("/otp", verificationOtpLimiter, validate(verificationOtpSchema), controller.sendOtp);
router.get("/mine", controller.getMine);
router.post("/", validate(verificationSubmitSchema), controller.submit);
router.put("/mine", validate(verificationSubmitSchema), controller.updateMine);

// Reviewer queue and decisions. The mount admits every reviewer role; the
// controller applies the matrix per request.
router.get("/queue", requireRole("departmentAdmin", "admin", "superadmin"), controller.queue);
router.post("/:id/approve", requireRole("departmentAdmin", "admin", "superadmin"), controller.approve);
router.post(
  "/:id/decline",
  requireRole("departmentAdmin", "admin", "superadmin"),
  validate(verificationDecisionSchema),
  controller.decline
);

module.exports = router;
