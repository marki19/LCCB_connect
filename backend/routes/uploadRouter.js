const express = require("express");
const router = express.Router();
const { uploadFor, uploadConcurrencyGuard, respondToUploadError } = require("../middleware/upload");
const { CATEGORIES } = require("../services/filePolicy");
const { storeUpload } = require("../services/uploadService");

/**
 * POST /api/upload/:category
 *
 * Stores a file under `<category>/<hashed-name>` and returns that key, which is
 * what PostgreSQL records. Mounted behind authentication, so `req.user` is
 * always present.
 */
router.post(
  "/:category",
  uploadConcurrencyGuard,
  (req, res, next) => {
    const category = (req.params.category || "").toLowerCase();

    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `Invalid storage category "${req.params.category}". Allowed: ${CATEGORIES.join(", ")}`,
      });
    }

    uploadFor(category).single("file")(req, res, (err) => {
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

      const stored = await storeUpload({
        category: req.params.category.toLowerCase(),
        originalName: req.file.originalname,
        buffer: req.file.buffer,
      });

      return res.status(201).json({
        success: true,
        filename: stored.key,
        url: `/api/files/${stored.key}`,
        size: stored.size,
      });
    } catch (err) {
      if (respondToUploadError(res, err)) return;
      next(err);
    }
  }
);

module.exports = router;
