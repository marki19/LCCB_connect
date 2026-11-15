/**
 * Upload policy: what may be stored, how large, and under what key.
 *
 * Deliberately free of I/O. Storage transport lives in `objectStorage`; this
 * module only decides whether a buffer is acceptable and what it should be
 * called. Keeping the two apart means the rules can be unit-tested without a
 * bucket, and the transport can change without touching them.
 */

const crypto = require("crypto");
const path = require("path");

const CATEGORIES = ["avatars", "posts", "theses", "documents", "videos"];

/**
 * Categories whose contents are safe for anonymous visitors: profile pictures,
 * post images, and video attachments. Everything else is gated behind an
 * ownership check.
 */
const PUBLIC_CATEGORIES = ["avatars", "posts", "videos"];

const PRIVATE_CATEGORIES = CATEGORIES.filter((c) => !PUBLIC_CATEGORIES.includes(c));

/** Canonical MIME type for each accepted extension. */
const EXTENSION_MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const CATEGORY_RULES = {
  avatars: {
    maxBytes: 2 * 1024 * 1024, // 2 MB
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
    allowedMimes: ["image/jpeg", "image/png", "image/webp"],
  },
  posts: {
    maxBytes: 10 * 1024 * 1024, // 10 MB
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
    allowedMimes: ["image/jpeg", "image/png", "image/webp"],
  },
  theses: {
    maxBytes: 50 * 1024 * 1024, // 50 MB
    allowedExtensions: [".pdf"],
    allowedMimes: ["application/pdf"],
  },
  documents: {
    maxBytes: 25 * 1024 * 1024, // 25 MB
    allowedExtensions: [".pdf", ".docx", ".doc"],
    allowedMimes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ],
  },
  videos: {
    maxBytes: 50 * 1024 * 1024, // 50 MB
    allowedExtensions: [".mp4", ".webm"],
    allowedMimes: ["video/mp4", "video/webm"],
  },
};

/** A `category/filename` key as stored in PostgreSQL. */
const KEY_PATTERN = /^([a-z]+)\/([0-9a-f]{16,64}\.[a-z0-9]+)$/i;

class UploadRejectedError extends Error {
  constructor(message) {
    super(message);
    this.name = "UploadRejectedError";
  }
}

function isCategory(category) {
  return CATEGORIES.includes(category);
}

function isPublicCategory(category) {
  return PUBLIC_CATEGORIES.includes(category);
}

/**
 * Magic-byte signatures, so a renamed executable cannot masquerade as an
 * image. Returns `false` for buffers that do not match their extension.
 */
function verifyMagicBytes(buffer, extension) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return false;
  }

  const ext = extension.toLowerCase();

  switch (ext) {
    case ".png":
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    case ".jpg":
    case ".jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case ".webp":
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case ".pdf":
      return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    case ".docx":
      // Office Open XML is a zip container starting with PK\x03\x04
      return (
        buffer[0] === 0x50 &&
        buffer[1] === 0x4b &&
        buffer[2] === 0x03 &&
        buffer[3] === 0x04
      );
    case ".mp4":
      return (
        buffer.length >= 8 && buffer.subarray(4, 8).toString("ascii") === "ftyp"
      );
    case ".webm":
      // Matroska / WebM EBML header \x1A\x45\xDF\xA3
      return (
        buffer[0] === 0x1a &&
        buffer[1] === 0x45 &&
        buffer[2] === 0xdf &&
        buffer[3] === 0xa3
      );
    default:
      return false;
  }
}

/** Normalises `.jpeg` to `.jpg` and lowercases the extension. */
function normalizeExtension(originalName) {
  const raw = path.extname(originalName || "").toLowerCase();
  return raw === ".jpeg" ? ".jpg" : raw;
}

/** Collision-resistant filename that leaks nothing about the original. */
function generateHashedFilename(originalName, buffer) {
  const hash = crypto
    .createHash("sha256")
    .update(buffer || "")
    .update(crypto.randomBytes(16))
    .update(String(Date.now()))
    .digest("hex")
    .slice(0, 32);

  return `${hash}${normalizeExtension(originalName)}`;
}

/**
 * Validates a candidate upload and returns the key it should be stored under.
 *
 * @param {object} opts
 * @param {string} opts.category
 * @param {string} opts.originalName
 * @param {Buffer} opts.buffer
 * @returns {{ key: string, filename: string, category: string, contentType: string, size: number }}
 * @throws {UploadRejectedError} when the category, size, extension, or contents are unacceptable.
 */
function resolveUpload({ category, originalName, buffer }) {
  if (!isCategory(category)) {
    throw new UploadRejectedError(`Invalid storage category: ${category}`);
  }

  const rules = CATEGORY_RULES[category];

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new UploadRejectedError("Uploaded file is empty");
  }

  if (buffer.length > rules.maxBytes) {
    throw new UploadRejectedError(
      `File size (${buffer.length} bytes) exceeds category maximum (${rules.maxBytes} bytes)`
    );
  }

  const extension = normalizeExtension(originalName);

  if (!rules.allowedExtensions.includes(extension)) {
    throw new UploadRejectedError(
      `Extension "${extension || "(none)"}" is not allowed in category "${category}"`
    );
  }

  if (!verifyMagicBytes(buffer, extension)) {
    throw new UploadRejectedError(
      `File contents do not match the expected format for ${extension}`
    );
  }

  const filename = generateHashedFilename(originalName, buffer);

  return {
    key: `${category}/${filename}`,
    filename,
    category,
    contentType: EXTENSION_MIME[extension],
    size: buffer.length,
  };
}

/**
 * Splits a `category/filename` key into its parts.
 * @returns {{ category: string, filename: string } | null}
 */
function parseKey(key) {
  if (typeof key !== "string") return null;
  const match = KEY_PATTERN.exec(key);
  if (!match) return null;
  return { category: match[1].toLowerCase(), filename: match[2] };
}

module.exports = {
  CATEGORIES,
  PUBLIC_CATEGORIES,
  PRIVATE_CATEGORIES,
  CATEGORY_RULES,
  EXTENSION_MIME,
  UploadRejectedError,
  isCategory,
  isPublicCategory,
  verifyMagicBytes,
  generateHashedFilename,
  normalizeExtension,
  resolveUpload,
  parseKey,
};
