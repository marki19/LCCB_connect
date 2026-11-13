const express = require("express");
const router = express.Router();
const path = require("path");
const { getLocalFilePath, CATEGORIES } = require("../services/localStorage");

/**
 * GET /api/files/:category/:filename
 * Safely serves a locally stored file with path-traversal prevention,
 * aggressive caching for immutable hashed filenames, and range request support.
 */
router.get("/:category/:filename", (req, res) => {
  const { category, filename } = req.params;

  if (!CATEGORIES.includes(category?.toLowerCase())) {
    return res.status(404).json({ error: "File not found" });
  }

  const filePath = getLocalFilePath(category.toLowerCase(), filename);
  if (!filePath) {
    return res.status(404).json({ error: "File not found" });
  }

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

  res.sendFile(filePath, {
    acceptRanges: true,
    dotfiles: "deny",
  });
});

module.exports = router;

