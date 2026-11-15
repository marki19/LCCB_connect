const multer = require("multer");
const { CATEGORIES, CATEGORY_RULES, UploadRejectedError } = require("../services/filePolicy");
const objectStorage = require("../services/objectStorage");

/**
 * Upload plumbing: buffering, the global size ceiling, the concurrency ceiling,
 * and the mapping from upload failures onto HTTP responses.
 *
 * Uploads are buffered in memory because they are streamed onward to object
 * storage in a single PUT. That is the right trade-off for files up to 50 MB,
 * but it means a handful of concurrent large uploads can exhaust a small
 * instance, so the buffer ceiling and the concurrency ceiling are both enforced
 * here rather than left to the request rate limiter.
 */

/** Absolute ceiling for any category, so one limit guards the whole process. */
const MAX_GLOBAL_BYTES = 50 * 1024 * 1024;

const MAX_CONCURRENT_UPLOADS = 4;

function fileFilterFor(category) {
  const rules = CATEGORY_RULES[category];

  return (req, file, cb) => {
    const fileMime = (file.mimetype || "").toLowerCase();

    if (!rules.allowedMimes.includes(fileMime)) {
      return cb(
        new Error(`File type "${fileMime}" is not permitted for category "${category}"`),
        false
      );
    }

    cb(null, true);
  };
}

/**
 * One multer instance per category, created once at load.
 *
 * The instance knows its own category, so the size limit is the smaller of the
 * global ceiling and the category ceiling: an oversized avatar is refused while
 * it is still being read instead of after 50 MB have been buffered.
 *
 * @param {string} category
 */
function createUploader(category) {
  const rules = CATEGORY_RULES[category];

  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: Math.min(MAX_GLOBAL_BYTES, rules.maxBytes),
      files: 1,
    },
    fileFilter: fileFilterFor(category),
  });
}

const uploaders = Object.fromEntries(
  CATEGORIES.map((category) => [category, createUploader(category)])
);

/**
 * The multer instance for a category.
 * @param {string} category
 * @returns {import("multer").Multer | undefined}
 */
function uploadFor(category) {
  return uploaders[category];
}

let inFlight = 0;

/**
 * Refuses new uploads once `MAX_CONCURRENT_UPLOADS` are already buffering.
 * Returns 429 rather than queueing, so the caller can retry instead of the
 * process being killed for memory.
 */
function uploadConcurrencyGuard(req, res, next) {
  if (inFlight >= MAX_CONCURRENT_UPLOADS) {
    return res.status(429).json({
      error: "Too many uploads in progress. Try again shortly.",
      code: "upload_busy",
    });
  }

  inFlight += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    inFlight -= 1;
  };

  res.on("finish", release);
  res.on("close", release);

  next();
}

/**
 * Maps a storage failure onto a response, so every upload path reports the same
 * status for the same cause.
 *
 * @param {import("express").Response} res
 * @param {Error} err
 * @returns {boolean} `true` when the error was a storage failure and has been answered.
 */
function respondToUploadError(res, err) {
  if (err instanceof UploadRejectedError) {
    res.status(400).json({ error: err.message });
    return true;
  }

  if (err instanceof objectStorage.StorageNotConfiguredError) {
    res.status(503).json({ error: "File storage is not configured" });
    return true;
  }

  if (err instanceof objectStorage.StorageRequestError) {
    res.status(502).json({ error: "File storage rejected the upload" });
    return true;
  }

  return false;
}

module.exports = {
  uploadFor,
  uploadConcurrencyGuard,
  respondToUploadError,
  MAX_GLOBAL_BYTES,
  MAX_CONCURRENT_UPLOADS,
};
