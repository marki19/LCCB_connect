const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { localUpload } = require("../middleware/localUpload");
const { saveLocalFile, CATEGORIES } = require("../services/localStorage");

/**
 * POST /api/upload/:category
 * Uploads a file to the categorized local storage folder.
 *
 * Supported categories: avatars, posts, theses, documents, videos.
 * Database stores the returned `filename` (e.g. "posts/a1b2c3d4.jpg").
 */
router.post(
  "/:category",
  (req, res, next) => {
    const category = (req.params.category || "").toLowerCase();
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `Invalid storage category "${req.params.category}". Allowed: ${CATEGORIES.join(", ")}`,
      });
    }

    localUpload.single("file")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          error: err.message || "File upload failed",
        });
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file was uploaded" });
      }

      const category = req.params.category.toLowerCase();
      const result = await saveLocalFile({
        category,
        originalName: req.file.originalname,
        buffer: req.file.buffer,
      });

      return res.status(201).json({
        success: true,
        filename: result.relativeKey,
        url: result.url,
        size: result.size,
      });
    } catch (err) {
      if (
        err.message.includes("exceeds category maximum") ||
        err.message.includes("not allowed in category") ||
        err.message.includes("do not match the expected format")
      ) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  }
);

module.exports = router;
