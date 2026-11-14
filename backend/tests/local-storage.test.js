const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { stub } = require("./stub.helper");
const auth = require("../middleware/auth");
const userModel = require("../models/userModel");
const db = require("../db");

// Stubs for requireAuth & loadProfile
const getUser = stub(auth.supabase.auth, "getUser", async () => ({
  data: { user: null },
  error: { message: "not authenticated" },
}));
const getProfile = stub(userModel, "getUserById", async (id) => ({
  id,
  role: "student",
  profile_completed: true,
  status: "active",
}));

const app = require("../app");
const {
  saveLocalFile,
  getLocalFilePath,
  deleteLocalFile,
  generateHashedFilename,
  verifyMagicBytes,
  resolveSafePath,
  UPLOADS_ROOT,
} = require("../services/localStorage");
const { isLocalKey, publicStorageUrl, signedStorageUrl } = require("../services/storageService");

describe("Backend Local File Storage Service", () => {
  const samplePng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const samplePdf = Buffer.from("%PDF-1.4 sample manuscript content");
  const sampleJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

  beforeEach(() => {
    getUser.setImpl(async () => ({
      data: { user: null },
      error: { message: "not authenticated" },
    }));
  });

  test("generates unique SHA-256 hashed filenames with preserved extensions", () => {
    const name1 = generateHashedFilename("photo.jpg", sampleJpg);
    const name2 = generateHashedFilename("photo.jpg", sampleJpg);

    assert.ok(name1.endsWith(".jpg"));
    assert.ok(name2.endsWith(".jpg"));
    assert.notStrictEqual(name1, name2, "Identical source filenames must not collide");
    assert.strictEqual(name1.length, 32 + 4); // 32 hex chars + .jpg
  });

  test("verifies magic bytes correctly", () => {
    assert.strictEqual(verifyMagicBytes(samplePng, ".png"), true);
    assert.strictEqual(verifyMagicBytes(sampleJpg, ".jpg"), true);
    assert.strictEqual(verifyMagicBytes(samplePdf, ".pdf"), true);

    // Mismatched magic bytes (executable disguised as png)
    const fakePng = Buffer.from("MZ\x90\x00executable content disguised as png");
    assert.strictEqual(verifyMagicBytes(fakePng, ".png"), false);
  });

  test("blocks path traversal attempts in filename resolution", () => {
    assert.throws(
      () => resolveSafePath("posts", "../secret.txt"),
      /traversal/i
    );
    assert.throws(
      () => resolveSafePath("posts", "..\\secret.txt"),
      /traversal/i
    );
    assert.throws(
      () => resolveSafePath("posts", "sub/folder/file.jpg"),
      /traversal/i
    );
    assert.throws(
      () => resolveSafePath("invalid_cat", "file.jpg"),
      /invalid storage category/i
    );
  });

  test("saves, retrieves, and deletes local files cleanly", async () => {
    const saved = await saveLocalFile({
      category: "posts",
      originalName: "test-card.png",
      buffer: samplePng,
    });

    assert.ok(saved.relativeKey.startsWith("posts/"));
    assert.strictEqual(saved.url, `/api/files/${saved.relativeKey}`);

    const resolved = getLocalFilePath("posts", saved.filename);
    assert.ok(resolved && fs.existsSync(resolved));

    const deleted = await deleteLocalFile("posts", saved.filename);
    assert.strictEqual(deleted, true);
    assert.strictEqual(getLocalFilePath("posts", saved.filename), null);
  });

  test("storageService detects and resolves local keys without cloud roundtrip", async () => {
    const localKey = "posts/9f83ab24e10c71a39bd5.jpg";
    assert.strictEqual(isLocalKey(localKey), true);

    const pubUrl = publicStorageUrl("assets", localKey);
    assert.strictEqual(pubUrl, `/api/files/${localKey}`);

    const signed = await signedStorageUrl("assets", localKey);
    assert.strictEqual(signed.url, `/api/files/${localKey}`);
  });

  test("GET /api/files/:category/:filename serves stored file with security headers", async () => {
    const saved = await saveLocalFile({
      category: "avatars",
      originalName: "avatar.png",
      buffer: samplePng,
    });

    const res = await request(app).get(`/api/files/avatars/${saved.filename}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["x-content-type-options"], "nosniff");
    assert.ok(res.headers["cache-control"]?.includes("immutable"));

    // Cleanup
    await deleteLocalFile("avatars", saved.filename);
  });

  test("GET /api/files/:category/:filename returns 404 for missing or traversal file", async () => {
    const res1 = await request(app).get("/api/files/posts/nonexistent.jpg");
    assert.strictEqual(res1.status, 404);

    const res2 = await request(app).get("/api/files/invalid_category/test.jpg");
    assert.strictEqual(res2.status, 404);
  });

  test("POST /api/upload/:category requires authentication", async () => {
    const res = await request(app)
      .post("/api/upload/posts")
      .attach("file", samplePng, "test.png");

    assert.strictEqual(res.status, 401);
  });

  test("POST /api/upload/:category uploads valid file and returns hashed path", async () => {
    getUser.setImpl(async () => ({
      data: { user: { id: "test-user-id", email: "student@lccbonline.edu.ph" } },
      error: null,
    }));

    const res = await request(app)
      .post("/api/upload/posts")
      .set("Authorization", "Bearer valid-token")
      .attach("file", samplePng, "card.png");

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.filename.startsWith("posts/"));
    assert.ok(res.body.filename.endsWith(".png"));
    assert.strictEqual(res.body.url, `/api/files/${res.body.filename}`);

    // Cleanup
    const savedName = res.body.filename.replace("posts/", "");
    await deleteLocalFile("posts", savedName);
  });

  test("POST /api/upload/:category rejects spoofed file content", async () => {
    getUser.setImpl(async () => ({
      data: { user: { id: "test-user-id", email: "student@lccbonline.edu.ph" } },
      error: null,
    }));

    const fakeJpg = Buffer.from("NOT_A_REAL_JPEG_IMAGE_CONTENT");
    const res = await request(app)
      .post("/api/upload/posts")
      .set("Authorization", "Bearer valid-token")
      .attach("file", fakeJpg, "fake.jpg");

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error?.includes("do not match the expected format"));
  });

  test("POST /api/upload/:category rejects invalid category", async () => {
    getUser.setImpl(async () => ({
      data: { user: { id: "test-user-id", email: "student@lccbonline.edu.ph" } },
      error: null,
    }));

    const res = await request(app)
      .post("/api/upload/secrets")
      .set("Authorization", "Bearer valid-token")
      .attach("file", samplePng, "test.png");

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error?.includes("Invalid storage category"));
  });

  test("GET /api/files/theses/:filename enforces auth and ownership", async () => {
    const saved = await saveLocalFile({
      category: "theses",
      originalName: "thesis.pdf",
      buffer: Buffer.from("%PDF-1.4 test content"),
    });

    // 1. Unauthenticated request -> 401
    const unauthRes = await request(app).get(`/api/files/theses/${saved.filename}`);
    assert.strictEqual(unauthRes.status, 401);

    // 2. Authenticated as non-owner -> 404
    getUser.setImpl(async () => ({
      data: { user: { id: "other-user-id", email: "other@lccbonline.edu.ph" } },
      error: null,
    }));
    stub(db, "query", async () => ({ rows: [{ uploader_id: "owner-user-id" }] }));

    const nonOwnerRes = await request(app)
      .get(`/api/files/theses/${saved.filename}`)
      .set("Authorization", "Bearer valid-token");
    assert.strictEqual(nonOwnerRes.status, 404);

    // 3. Authenticated as owner -> 200
    getUser.setImpl(async () => ({
      data: { user: { id: "owner-user-id", email: "owner@lccbonline.edu.ph" } },
      error: null,
    }));

    const ownerRes = await request(app)
      .get(`/api/files/theses/${saved.filename}`)
      .set("Authorization", "Bearer valid-token");
    assert.strictEqual(ownerRes.status, 200);

    await deleteLocalFile("theses", saved.filename);
  });
});
