const express = require("express");
const router = express.Router();
const searchController = require("../controllers/searchController");

// Mounted at /api/search behind requireAuth + loadProfile + requireActiveAccount.
// No per-user limit: the global IP limiter in app.js is the backstop.
router.get("/", searchController.search);
router.get("/suggestions", searchController.suggestions);

module.exports = router;

