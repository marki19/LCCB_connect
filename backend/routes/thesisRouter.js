const express = require("express");
const router = express.Router();
const thesisController = require("../controllers/thesisController");
const { loadProfile } = require("../middleware/auth");
const {
  validate,
  createThesisSchema,
  updateThesisSchema,
} = require("../validation");

// Routes (global requireAuth is applied when this router is mounted in app.js)
router.get("/", thesisController.getTheses);
router.get("/:id", thesisController.getThesis);
router.post("/", loadProfile, validate(createThesisSchema), thesisController.createThesis);
router.put("/:id", validate(updateThesisSchema), thesisController.updateThesis);
router.delete("/:id", thesisController.deleteThesis);

module.exports = router;


