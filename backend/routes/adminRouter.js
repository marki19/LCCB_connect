const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const auth = require("../middleware/auth");
const {
  validate,
  roleChangeSchema,
  suspendUserSchema,
  reasonBodySchema,
  announcementSchema,
} = require("../validation");

// Mounted at /api/admin behind requireAuth + loadProfile + requireActiveAccount
// + requireRole(admin, superadmin) in app.js. Keep the catalog router after this
// one; unmatched paths fall through to it.
router.get("/overview", adminController.getOverview);
router.get("/users", adminController.listUsers);
router.get("/users/:id", adminController.getUser);
router.patch(
  "/users/:id/role",
  validate(roleChangeSchema),
  adminController.changeRole
);
router.post(
  "/users/:id/suspend",
  validate(suspendUserSchema),
  adminController.suspendUser
);
router.post(
  "/users/:id/unsuspend",
  validate(reasonBodySchema),
  adminController.unsuspendUser
);
router.post(
  "/users/:id/force-signout",
  auth.requireRole("superadmin"),
  validate(reasonBodySchema),
  adminController.forceSignOut
);

router.post(
  "/users/:id/impersonate",
  auth.requireRole("superadmin"),
  validate(reasonBodySchema),
  adminController.generateImpersonation
);

router.post(
  "/users/:id/unlock",
  auth.requireRole("superadmin"),
  validate(reasonBodySchema),
  adminController.unlockUser
);

// Account deletion removed per policy. Use POST /users/:id/suspend for disable.
// Manual DB query only for permanent deletion.

router.get("/content", adminController.listContent);
router.get(
  "/audit",
  auth.requireRole("superadmin"),
  adminController.listAudit
);

router.get(
  "/announcements/audience-count",
  adminController.getAudienceCount
);
router.post(
  "/announcements",
  validate(announcementSchema),
  adminController.sendAnnouncement
);
router.get("/announcements", adminController.listAnnouncements);

module.exports = router;
