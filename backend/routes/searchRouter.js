const express = require("express");
const router = express.Router();
const searchController = require("../controllers/searchController");

// Mounted at /api/search behind requireAuth + loadProfile + requireActiveAccount
router.get("/", searchController.search);
router.get("/suggestions", searchController.suggestions);

module.exports = router;

