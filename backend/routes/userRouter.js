const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
// Read off the module object (rather than destructuring) so the test suite can
// install spies before this router is loaded.
const auth = require("../middleware/auth");
const {
  validate,
  createProfileSchema,
  updateProfileSchema,
} = require("../validation");

// CRUD routes (global requireAuth is applied when this router is mounted in app.js)
router.get("/", userController.getUsers);
router.get("/directory", userController.getDirectory);   // <-- before /:id
router.get("/:id", userController.getUser);
router.post("/", validate(createProfileSchema), userController.createUser);

// Self-or-admin actions need the caller's profile (for the role check).
router.put("/:id", auth.loadProfile, validate(updateProfileSchema), userController.updateUser);
// Account deletion is disabled via API per policy. Use PATCH /admin/users/:id/suspend for disable.
// Self-disable is removed. Manual DB query only for permanent deletion.

module.exports = router;

