/**
 * Upload and file-serving routes.
 *
 * Object storage is stubbed at the module boundary: these tests are about
 * authorisation, validation, and cache semantics, not about R2 itself.
 */

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const auth = require("../middleware/auth");
const userModel = require("../models/userModel");
const db = require("../db");
const objectStorage = require("../services/objectStorage");

const SIGNED = "https://abc123.r2.cloudflarestorage.com/lccb-connect";

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

const isConfigured = stub(objectStorage, "isConfigured", () => true);
const putObject = stub(objectStorage, "putObject", async () => {});
const presignGet = stub(objectStorage, "presignGet", (key) => `${SIGNED}/${key}?X-Amz-Signature=deadbeef`);
const query = stub(db, "query", async () => ({ rows: [] }));

const app = require("../app");

const samplePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const samplePdf = Buffer.from("%PDF-1.4 sample manuscript content");

function asUser(id, email = "student@lccbonline.edu.ph") {
  getUser.setImpl(async () => ({ data: { user: { id, email } }, error: null }));
}

beforeEach(() => {
  getUser.setImpl(async () => ({
    data: { user: null },
    error: { message: "not authenticated" },
  }));
  getProfile.setImpl(async (id) => ({
    id,
    role: "student",
    profile_completed: true,
    status: "active",
  }));
  isConfigured.setImpl(() => true);
  putObject.setImpl(async () => {});
  presignGet.setImpl((key) => `${SIGNED}/${key}?X-Amz-Signature=deadbeef`);
  query.setImpl(async () => ({ rows: [] }));
  putObject.calls.length = 0;
});

describe("POST /api/upload/:category", () => {
  test("requires authentication", async () => {
    const res = await request(app)
      .post("/api/upload/posts")
      .attach("file", samplePng, "test.png");

    assert.equal(res.status, 401);
    assert.equal(putObject.calls.length, 0);
  });

  test("stores a valid file and returns its key", async () => {
    asUser("test-user-id");

    const res = await request(app)
      .post("/api/upload/posts")
      .set("Authorization", "Bearer valid-token")
      .attach("file", samplePng, "card.png");

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.match(res.body.filename, /^posts\/[0-9a-f]{32}\.png$/);
    assert.equal(res.body.url, `/api/files/${res.body.filename}`);
    assert.equal(res.body.size, samplePng.length);

    assert.equal(putObject.calls.length, 1);
    const [{ key, contentType }] = putObject.calls[0];
    assert.equal(key, res.body.filename);
    assert.equal(contentType, "image/png");
  });

  test("rejects content that does not match its extension", async () => {
    asUser("test-user-id");

    const res = await request(app)
      .post("/api/upload/posts")
      .set("Authorization", "Bearer valid-token")
      .attach("file", Buffer.from("NOT_A_REAL_JPEG_IMAGE_CONTENT"), "fake.jpg");

    assert.equal(res.status, 400);
    assert.match(res.body.error, /do not match the expected format/);
    assert.equal(putObject.calls.length, 0);
  });

  test("rejects an unknown category", async () => {
    asUser("test-user-id");

    const res = await request(app)
      .post("/api/upload/secrets")
      .set("Authorization", "Bearer valid-token")
      .attach("file", samplePng, "test.png");

    assert.equal(res.status, 400);
    assert.match(res.body.error, /Invalid storage category/);
  });

  test("reports unconfigured storage as 503 rather than 500", async () => {
    asUser("test-user-id");
    putObject.setImpl(async () => {
      throw new objectStorage.StorageNotConfiguredError();
    });

    const res = await request(app)
      .post("/api/upload/posts")
      .set("Authorization", "Bearer valid-token")
      .attach("file", samplePng, "card.png");

    assert.equal(res.status, 503);
  });

  test("reports a provider rejection as 502", async () => {
    asUser("test-user-id");
    putObject.setImpl(async () => {
      throw new objectStorage.StorageRequestError("nope", { status: 403 });
    });

    const res = await request(app)
      .post("/api/upload/posts")
      .set("Authorization", "Bearer valid-token")
      .attach("file", samplePng, "card.png");

    assert.equal(res.status, 502);
  });
});

describe("GET /api/files/:category/:filename", () => {
  const publicFile = "avatars/9f83ab24e10c71a39bd5.jpg";

  test("redirects public files with a short-lived cache under signature lifetime", async () => {
    const res = await request(app).get(`/api/files/${publicFile}`);

    assert.equal(res.status, 302);
    assert.equal(res.headers.location, `${SIGNED}/${publicFile}?X-Amz-Signature=deadbeef`);
    assert.match(res.headers["cache-control"], /max-age=240/);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(res.headers["cross-origin-resource-policy"], "cross-origin");
  });

  test("serves post images without authentication", async () => {
    const res = await request(app).get("/api/files/posts/9f83ab24e10c71a39bd5.jpg");

    assert.equal(res.status, 302);
    assert.match(res.headers["cache-control"], /max-age=240/);
  });

  test("requires authentication for theses", async () => {
    const res = await request(app).get("/api/files/theses/9f83ab24e10c71a39bd5.pdf");

    assert.equal(res.status, 401);
  });

  test("returns 404 to a caller who does not own the thesis", async () => {
    asUser("other-user-id");
    query.setImpl(async () => ({ rows: [{ uploader_id: "owner-user-id" }] }));

    const res = await request(app)
      .get("/api/files/theses/9f83ab24e10c71a39bd5.pdf")
      .set("Authorization", "Bearer valid-token");

    assert.equal(res.status, 404);
  });

  test("redirects the owner with a non-cacheable response", async () => {
    asUser("owner-user-id");
    query.setImpl(async () => ({ rows: [{ uploader_id: "owner-user-id" }] }));

    const res = await request(app)
      .get("/api/files/theses/9f83ab24e10c71a39bd5.pdf")
      .set("Authorization", "Bearer valid-token");

    assert.equal(res.status, 302);
    assert.equal(res.headers["cache-control"], "private, no-store");
    assert.match(res.headers.location, /theses\/9f83ab24e10c71a39bd5\.pdf/);
  });

  test("returns 404 for traversal attempts", async () => {
    const res = await request(app).get("/api/files/posts/..%2f..%2fsecret.jpg");
    assert.equal(res.status, 404);
  });

  test("requires authentication for snap media", async () => {
    const res = await request(app).get("/api/files/snaps/9f83ab24e10c71a39bd5.jpg");
    assert.equal(res.status, 401);
  });

  test("returns 404 when the snap is not visible to the caller", async () => {
    asUser("viewer-user-id");
    query.setImpl(async () => ({ rows: [] }));

    const res = await request(app)
      .get("/api/files/snaps/9f83ab24e10c71a39bd5.jpg")
      .set("Authorization", "Bearer valid-token");

    assert.equal(res.status, 404);
  });

  test("redirects a viewer who can see the snap, without caching", async () => {
    asUser("viewer-user-id");
    query.setImpl(async () => ({ rows: [{ exists: 1 }] }));

    const res = await request(app)
      .get("/api/files/snaps/9f83ab24e10c71a39bd5.jpg")
      .set("Authorization", "Bearer valid-token");

    assert.equal(res.status, 302);
    assert.equal(res.headers["cache-control"], "private, no-store");
    assert.match(res.headers.location, /snaps\/9f83ab24e10c71a39bd5\.jpg/);
  });

  test("returns 404 for an unknown category", async () => {
    const res = await request(app).get("/api/files/secrets/test.jpg");
    assert.equal(res.status, 404);
  });

  test("returns 503 when storage is unconfigured", async () => {
    isConfigured.setImpl(() => false);

    const res = await request(app).get(`/api/files/${publicFile}`);
    assert.equal(res.status, 503);
  });
});
