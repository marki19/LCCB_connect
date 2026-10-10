const express = require("express");
const router = express.Router();
const thesisController = require("../controllers/thesisController");

router.get("/", thesisController.getTheses);
router.get("/:id", thesisController.getThesis);
router.post("/", thesisController.createThesis);
router.put("/:id", thesisController.updateThesis);
router.delete("/:id", thesisController.deleteThesis);

module.exports = router;
