const express = require("express");
const router = express.Router();
const thesisController = require("../controllers/thesisController");
const { loadProfile, requireVerified } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { thesisUploadLimiter } = require("../middleware/actionLimits");
const {
  validate,
  createThesisSchema,
  updateThesisSchema,
} = require("../validation");

// Routes (global requireAuth is applied when this router is mounted in app.js)
router.get("/", thesisController.getTheses);
router.get("/:id", thesisController.getThesis);
router.post(
  "/",
  thesisUploadLimiter,
  loadProfile,
  requireVerified,
  upload.single("pdf"),
  thesisController.createThesis
);
router.get("/:id/file", thesisController.getThesisFile);
router.put("/:id", requireVerified, upload.single("pdf"), validate(updateThesisSchema), thesisController.updateThesis);
router.delete("/:id", requireVerified, thesisController.deleteThesis);

module.exports = router;


