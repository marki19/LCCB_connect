const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth, loadProfile } = require("../middleware/auth");
const { normalizeRole } = require("../utils/roles");
const { escapeLike } = require("../utils/queryFilters");
const { isCategory, isPublicCategory } = require("../services/filePolicy");
const objectStorage = require("../services/objectStorage");

/** Filenames are generated hex digests; this also rejects traversal attempts. */
const FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function isSafeFilename(filename) {
  return (
    typeof filename === "string" &&
    filename.length <= 128 &&
    FILENAME_PATTERN.test(filename) &&
    !filename.includes("..")
  );
}

/**
 * Checks whether the authenticated caller owns the referenced file or is an
 * administrator.
 */
async function verifyFileOwnership(category, filename, user) {
  if (!user || !user.id) return false;

  const role = normalizeRole(user.role);
  if (role === "admin" || role === "superadmin") {
    return true;
  }

  // Filenames are hashed, but escape anyway: this value is interpolated into
  // an ILIKE pattern, and an unescaped `%` or `_` would widen the match.
  const likePattern = `%${escapeLike(filename)}`;

  // Snap media is audience-scoped and expires. Visibility, not upload
  // ownership, decides who may read it, so ask the same function the rail
  // uses. The key is matched exactly: every snap row is written with its
  // `snaps/` prefix, so the legacy bare-filename tolerance is unnecessary.
  if (category === "snaps") {
    const { rows } = await db.query(
      `SELECT 1
         FROM public.visible_snaps($1) s
        WHERE s.media_key = $2
        LIMIT 1`,
      [String(user.id), `${category}/${filename}`]
    );
    return rows.length > 0;
  }

  if (category === "theses") {
    const { rows } = await db.query(
      `SELECT p.author_id AS uploader_id
         FROM public.post_attachments a
         JOIN public.posts p ON p.id = a.post_id
        WHERE a.storage_key ILIKE $1
        LIMIT 1`,
      [likePattern]
    );
    if (!rows.length) return false;
    return String(rows[0].uploader_id) === String(user.id);
  }

  if (category === "documents") {
    const { rows } = await db.query(
      `SELECT user_id FROM public.user_documents WHERE file_url ILIKE $1 LIMIT 1`,
      [likePattern]
    );
    if (!rows.length) return false;
    return String(rows[0].user_id) === String(user.id);
  }

  const postRes = await db.query(
    `SELECT p.author_id
     FROM public.post_attachments pa
     JOIN public.posts p ON p.id = pa.post_id
     WHERE pa.storage_key ILIKE $1 OR pa.storage_key = $2
     LIMIT 1`,
    [likePattern, filename]
  );
  if (postRes.rows.length && String(postRes.rows[0].author_id) === String(user.id)) {
    return true;
  }

  const profileRes = await db.query(
    `SELECT id FROM public.profiles WHERE avatar_url ILIKE $1 LIMIT 1`,
    [likePattern]
  );
  if (profileRes.rows.length && String(profileRes.rows[0].id) === String(user.id)) {
    return true;
  }

  return false;
}

/**
 * Redirects to a short-lived presigned URL.
 *
 * The bytes never traverse this process: R2 serves them directly, which keeps
 * file traffic off the API instance and costs nothing because R2 charges no
 * egress. Private categories must not be stored by shared caches, so they get
 * `no-store`; public ones are content-addressed by hash and never change.
 */
function redirectToObject(res, key, { isPublic }) {
  const url = objectStorage.presignGet(key);

  res.setHeader(
    "Cache-Control",
    isPublic ? "private, max-age=240" : "private, no-store"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

  return res.redirect(302, url);
}

/**
 * GET /api/files/:category/:filename
 *
 * avatars/posts/videos/covers are public.
 * theses/documents require auth + ownership (or admin) and return 404 otherwise.
 * snaps require auth and are served only to a viewer who can see the snap.
 */
router.get("/:category/:filename", (req, res, next) => {
  const category = (req.params.category || "").toLowerCase();
  const { filename } = req.params;

  if (!isCategory(category) || !isSafeFilename(filename)) {
    return res.status(404).json({ error: "File not found" });
  }

  if (!objectStorage.isConfigured()) {
    return res.status(503).json({ error: "File storage is not configured" });
  }

  const key = `${category}/${filename}`;
  const isPublic = isPublicCategory(category);

  if (isPublic) {
    return redirectToObject(res, key, { isPublic });
  }

  return requireAuth(req, res, () => {
    return loadProfile(req, res, async () => {
      try {
        const user = req.profile || req.user;
        const allowed = await verifyFileOwnership(category, filename, user);
        if (!allowed) {
          return res.status(404).json({ error: "File not found" });
        }
        return redirectToObject(res, key, { isPublic });
      } catch (err) {
        return next(err);
      }
    });
  });
});

module.exports = router;
