const express = require("express");
const router = express.Router();
const searchController = require("../controllers/searchController");
const { searchLimiter } = require("../middleware/actionLimits");

// Mounted at /api/search behind requireAuth + loadProfile + requireActiveAccount.
router.use(searchLimiter);

router.get("/", searchController.search);
router.get("/suggestions", searchController.suggestions);

module.exports = router;

