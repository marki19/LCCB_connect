const express = require("express");
const router = express.Router();
const controller = require("../controllers/announcementController");
const { validate, announcementSchema, announcementUpdateSchema } = require("../validation");

/**
 * Mounted at /api/announcements behind requireAuth + loadProfile +
 * requireActiveAccount + requireRole(departmentAdmin, admin, superadmin).
 *
 * Announcements live outside /api/admin on purpose: department admins send them,
 * and the admin mount is gated to admin + superadmin. Per-audience scope (a
 * department admin may only target their own department) is enforced in the
 * controller, not by the mount.
 */
router.get("/audience-count", controller.getAudienceCount);
router.get("/", controller.list);
router.post("/", validate(announcementSchema), controller.create);
router.patch("/:id", validate(announcementUpdateSchema), controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
