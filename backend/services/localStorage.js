const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UPLOADS_ROOT = path.resolve(
  process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads")
);

const CATEGORIES = ["avatars", "posts", "theses", "documents", "videos"];

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
    allowedExtensions: [".pdf", ".docx"],
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

/**
 * Magic bytes signatures for runtime format verification.
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
      return true;
  }
}

/**
 * Generates a collision-resistant SHA-256 hashed filename while preserving safe extension.
 */
function generateHashedFilename(originalName, buffer) {
  const parsedExt = path.extname(originalName || "").toLowerCase();
  const safeExt = parsedExt === ".jpeg" ? ".jpg" : parsedExt;

  const hash = crypto
    .createHash("sha256")
    .update(buffer || "")
    .update(crypto.randomBytes(16))
    .update(String(Date.now()))
    .digest("hex")
    .slice(0, 32);

  return `${hash}${safeExt}`;
}

/**
 * Validates and resolves a safe filesystem path, blocking directory traversal attempts.
 */
function resolveSafePath(category, filename) {
  if (!CATEGORIES.includes(category)) {
    throw new Error(`Invalid storage category: ${category}`);
  }

  // Reject paths containing traversal characters or null bytes
  if (
    !filename ||
    typeof filename !== "string" ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("\0")
  ) {
    throw new Error("Invalid filename or potential directory traversal attempt");
  }

  const categoryDir = path.join(UPLOADS_ROOT, category);
  const targetPath = path.resolve(categoryDir, filename);

  // Must remain strictly within the designated category subdirectory
  if (!targetPath.startsWith(categoryDir + path.sep)) {
    throw new Error("Resolved path outside category directory boundary");
  }

  return targetPath;
}

/**
 * Saves a file to the local uploads directory under the specified category.
 */
async function saveLocalFile({ category, originalName, buffer }) {
  if (!CATEGORIES.includes(category)) {
    throw new Error(`Invalid storage category: ${category}`);
  }

  const rules = CATEGORY_RULES[category];
  if (buffer.length > rules.maxBytes) {
    throw new Error(
      `File size (${buffer.length} bytes) exceeds category maximum (${rules.maxBytes} bytes)`
    );
  }

  const rawExt = path.extname(originalName || "").toLowerCase();
  const safeExt = rawExt === ".jpeg" ? ".jpg" : rawExt;

  if (!rules.allowedExtensions.includes(safeExt)) {
    throw new Error(
      `Extension "${safeExt}" is not allowed in category "${category}"`
    );
  }

  if (!verifyMagicBytes(buffer, safeExt)) {
    throw new Error(
      `File contents do not match the expected format for ${safeExt}`
    );
  }

  const filename = generateHashedFilename(originalName, buffer);
  const categoryDir = path.join(UPLOADS_ROOT, category);

  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
  }

  const targetPath = path.join(categoryDir, filename);
  await fs.promises.writeFile(targetPath, buffer);

  const relativeKey = `${category}/${filename}`;
  return {
    filename,
    category,
    relativeKey,
    size: buffer.length,
    url: `/api/files/${category}/${filename}`,
  };
}

/**
 * Checks if a stored file exists and returns its safe path.
 */
function getLocalFilePath(category, filename) {
  try {
    const safePath = resolveSafePath(category, filename);
    if (fs.existsSync(safePath)) {
      return safePath;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Deletes a stored file if it exists.
 */
async function deleteLocalFile(category, filename) {
  try {
    const safePath = resolveSafePath(category, filename);
    if (fs.existsSync(safePath)) {
      await fs.promises.unlink(safePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

module.exports = {
  UPLOADS_ROOT,
  CATEGORIES,
  CATEGORY_RULES,
  verifyMagicBytes,
  generateHashedFilename,
  resolveSafePath,
  saveLocalFile,
  getLocalFilePath,
  deleteLocalFile,
};

