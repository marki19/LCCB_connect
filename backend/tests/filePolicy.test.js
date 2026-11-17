/**
 * Upload policy tests: naming, magic-byte validation, and rejection rules.
 *
 * This module has no I/O, so everything here runs without a bucket or a
 * database.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  CATEGORIES,
  PUBLIC_CATEGORIES,
  PRIVATE_CATEGORIES,
  CATEGORY_RULES,
  UploadRejectedError,
  isCategory,
  isPublicCategory,
  verifyMagicBytes,
  generateHashedFilename,
  normalizeExtension,
  resolveUpload,
  parseKey,
} = require("../services/filePolicy");

const samplePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const sampleJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const samplePdf = Buffer.from("%PDF-1.4 sample manuscript content");
const sampleDocx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
const sampleMp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypmp42")]);

describe("category model", () => {
  test("splits every category into exactly one visibility bucket", () => {
    assert.deepEqual(
      [...PUBLIC_CATEGORIES, ...PRIVATE_CATEGORIES].sort(),
      [...CATEGORIES].sort()
    );
  });

  test("treats theses and documents as private", () => {
    assert.equal(isPublicCategory("avatars"), true);
    assert.equal(isPublicCategory("posts"), true);
    assert.equal(isPublicCategory("videos"), true);
    assert.equal(isPublicCategory("theses"), false);
    assert.equal(isPublicCategory("documents"), false);
  });

  test("defines a rule set for every category", () => {
    for (const category of CATEGORIES) {
      assert.ok(CATEGORY_RULES[category], `missing rules for ${category}`);
      assert.ok(CATEGORY_RULES[category].maxBytes > 0);
      assert.ok(CATEGORY_RULES[category].allowedExtensions.length > 0);
    }
  });

  test("rejects unknown categories", () => {
    assert.equal(isCategory("secrets"), false);
    assert.equal(isCategory("posts"), true);
  });
});

describe("generateHashedFilename", () => {
  test("never collides for identical input", () => {
    const a = generateHashedFilename("photo.jpg", sampleJpg);
    const b = generateHashedFilename("photo.jpg", sampleJpg);
    assert.notEqual(a, b);
  });

  test("keeps a 32-character digest and the extension", () => {
    const name = generateHashedFilename("photo.jpg", sampleJpg);
    assert.equal(name.length, 32 + ".jpg".length);
    assert.match(name, /^[0-9a-f]{32}\.jpg$/);
  });

  test("normalises .jpeg to .jpg", () => {
    assert.equal(normalizeExtension("photo.JPEG"), ".jpg");
    assert.equal(normalizeExtension("photo.png"), ".png");
    assert.equal(normalizeExtension("noextension"), "");
  });
});

describe("verifyMagicBytes", () => {
  test("accepts genuine formats", () => {
    assert.equal(verifyMagicBytes(samplePng, ".png"), true);
    assert.equal(verifyMagicBytes(sampleJpg, ".jpg"), true);
    assert.equal(verifyMagicBytes(samplePdf, ".pdf"), true);
    assert.equal(verifyMagicBytes(sampleDocx, ".docx"), true);
    assert.equal(verifyMagicBytes(sampleMp4, ".mp4"), true);
  });

  test("rejects an executable renamed to an image", () => {
    const disguised = Buffer.from("MZ\x90\x00executable content disguised as png");
    assert.equal(verifyMagicBytes(disguised, ".png"), false);
  });

  test("rejects buffers too short to carry a signature", () => {
    assert.equal(verifyMagicBytes(Buffer.from([0x89]), ".png"), false);
    assert.equal(verifyMagicBytes(null, ".png"), false);
  });

  test("rejects extensions with no signature rule", () => {
    assert.equal(verifyMagicBytes(samplePng, ".exe"), false);
  });
});

describe("resolveUpload", () => {
  test("accepts a valid image and returns a category-prefixed key", () => {
    const resolved = resolveUpload({
      category: "posts",
      originalName: "card.png",
      buffer: samplePng,
    });

    assert.match(resolved.key, /^posts\/[0-9a-f]{32}\.png$/);
    assert.equal(resolved.key, `posts/${resolved.filename}`);
    assert.equal(resolved.contentType, "image/png");
    assert.equal(resolved.size, samplePng.length);
  });

  test("derives the content type from the extension, not the client", () => {
    const resolved = resolveUpload({
      category: "theses",
      originalName: "manuscript.pdf",
      buffer: samplePdf,
    });
    assert.equal(resolved.contentType, "application/pdf");
  });

  test("rejects an unknown category", () => {
    assert.throws(
      () => resolveUpload({ category: "secrets", originalName: "a.png", buffer: samplePng }),
      UploadRejectedError
    );
  });

  test("rejects an empty buffer", () => {
    assert.throws(
      () => resolveUpload({ category: "posts", originalName: "a.png", buffer: Buffer.alloc(0) }),
      /empty/
    );
  });

  test("rejects a file over the category ceiling", () => {
    const oversized = Buffer.concat([samplePng, Buffer.alloc(CATEGORY_RULES.avatars.maxBytes)]);
    assert.throws(
      () => resolveUpload({ category: "avatars", originalName: "a.png", buffer: oversized }),
      /exceeds category maximum/
    );
  });

  test("rejects an extension the category does not allow", () => {
    assert.throws(
      () => resolveUpload({ category: "theses", originalName: "a.png", buffer: samplePng }),
      /not allowed in category/
    );
  });

  test("rejects content that does not match its extension", () => {
    assert.throws(
      () =>
        resolveUpload({
          category: "posts",
          originalName: "fake.jpg",
          buffer: Buffer.from("NOT_A_REAL_JPEG"),
        }),
      /do not match the expected format/
    );
  });
});

describe("parseKey", () => {
  test("splits a canonical key", () => {
    assert.deepEqual(parseKey("posts/9f83ab24e10c71a39bd5.jpg"), {
      category: "posts",
      filename: "9f83ab24e10c71a39bd5.jpg",
    });
  });

  test("rejects traversal and malformed keys", () => {
    assert.equal(parseKey("posts/../../etc/passwd"), null);
    assert.equal(parseKey("posts/"), null);
    assert.equal(parseKey(""), null);
    assert.equal(parseKey(null), null);
  });
});
