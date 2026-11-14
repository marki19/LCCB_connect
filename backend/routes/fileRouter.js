const express = require("express");
const router = express.Router();
const db = require("../db");
const { getLocalFilePath, CATEGORIES } = require("../services/localStorage");
const { requireAuth, loadProfile } = require("../middleware/auth");
const { normalizeRole } = require("../utils/roles");

const PRIVATE_CATEGORIES = ["theses", "documents"];

/**
 * Checks whether the authenticated caller owns the referenced file or is an administrator.
 */
async function verifyFileOwnership(category, filename, user) {
  if (!user || !user.id) return false;
  const role = normalizeRole(user.role);
  if (role === "admin" || role === "superadmin") {
    return true;
  }

  const likePattern = `%${filename}`;

  if (category === "theses") {
    const { rows } = await db.query(
      `SELECT uploader_id FROM public.theses WHERE pdf_url ILIKE $1 LIMIT 1`,
      [likePattern]
    );
    if (!rows.length) return false;
    return String(rows[0].uploader_id) === String(user.id);
  }

  if (category === "documents") {
    // 1. Check theses
    const thesisRes = await db.query(
      `SELECT uploader_id FROM public.theses WHERE pdf_url ILIKE $1 LIMIT 1`,
      [likePattern]
    );
    if (thesisRes.rows.length && String(thesisRes.rows[0].uploader_id) === String(user.id)) {
      return true;
    }

    // 2. Check posts
    const postRes = await db.query(
      `SELECT author_id FROM public.posts WHERE image_url ILIKE $1 OR $2 = ANY(image_urls) LIMIT 1`,
      [likePattern, filename]
    );
    if (postRes.rows.length && String(postRes.rows[0].author_id) === String(user.id)) {
      return true;
    }

    // 3. Check profiles
    const profileRes = await db.query(
      `SELECT id FROM public.profiles WHERE avatar_url ILIKE $1 LIMIT 1`,
      [likePattern]
    );
    if (profileRes.rows.length && String(profileRes.rows[0].id) === String(user.id)) {
      return true;
    }

    return false;
  }

  return true;
}

function serveLocalFile(res, filePath) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

  return res.sendFile(filePath, {
    acceptRanges: true,
    dotfiles: "deny",
  });
}

/**
 * GET /api/files/:category/:filename
 * Safely serves locally stored files.
 * avatars/posts are public.
 * theses/documents require auth + ownership (or admin) and return 404 otherwise.
 */
router.get("/:category/:filename", (req, res, next) => {
  const category = req.params.category?.toLowerCase();
  const { filename } = req.params;

  if (!CATEGORIES.includes(category)) {
    return res.status(404).json({ error: "File not found" });
  }

  const filePath = getLocalFilePath(category, filename);
  if (!filePath) {
    return res.status(404).json({ error: "File not found" });
  }

  if (PRIVATE_CATEGORIES.includes(category)) {
    return requireAuth(req, res, () => {
      return loadProfile(req, res, async () => {
        try {
          const user = req.profile || req.user;
          const allowed = await verifyFileOwnership(category, filename, user);
          if (!allowed) {
            return res.status(404).json({ error: "File not found" });
          }
          return serveLocalFile(res, filePath);
        } catch {
          return res.status(404).json({ error: "File not found" });
        }
      });
    });
  }

  return serveLocalFile(res, filePath);
});

module.exports = router;
