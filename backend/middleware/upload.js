const multer = require("multer");

/**
 * File-upload middleware.
 *
 * Manuscripts are the only files the app accepts through this boundary. Post
 * images and avatars are still uploaded by the client (they live in public or
 * caller-owned buckets), but a thesis PDF is private content: the bytes must
 * never reach the browser's Supabase client, because the client would need a
 * service-role key to read them back.
 *
 * `multer` buffers the file in memory so the controller can inspect the magic
 * bytes before touching Supabase. The memory buffer is small relative to the
 * 50 MB ceiling and is released immediately after the upload completes.
 */

const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB, matches migrations/012
const PDF_MAGIC = Buffer.from("%PDF-");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype !== "application/pdf") {
    return cb(new Error("Only PDF manuscripts are accepted"));
  }
  return cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_PDF_BYTES, files: 1 },
  fileFilter,
});

/**
 * Rejects a buffer that does not start with the PDF magic bytes.
 *
 * Content-type is a client-supplied header and is trivially spoofed; the magic
 * bytes are what the file actually is. This runs before the upload, so a
 * rejected file never reaches Supabase Storage.
 */
function assertPdfMagic(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5) {
    throw new Error("Uploaded file is too small to be a PDF");
  }
  if (!buffer.subarray(0, 5).equals(PDF_MAGIC)) {
    throw new Error("Uploaded file is not a PDF (magic bytes mismatch)");
  }
}

module.exports = {
  upload,
  assertPdfMagic,
  MAX_PDF_BYTES,
};