const express = require("express");
const router = express.Router();
const searchController = require("../controllers/searchController");
const { searchLimiter } = require("../middleware/actionLimits");

// Mounted at /api/search behind requireAuth + loadProfile + requireActiveAccount
router.get("/", searchLimiter, searchController.search);
router.get("/suggestions", searchLimiter, searchController.suggestions);

module.exports = router;

