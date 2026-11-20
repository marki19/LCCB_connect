require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { stub } = require("./stub.helper");

const auth = require("../middleware/auth");

let session = { id: "test-user-123", role: "student" };

stub(auth, "requireAuth", (req, res, next) => {
  if (!(req.headers.authorization || "").startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: session.id };
  return next();
});

stub(auth, "loadProfile", (req, res, next) => {
  req.profile = { id: session.id, role: session.role };
  return next();
});

stub(auth, "requireActiveAccount", (req, res, next) => {
  return next();
});

const app = require("../app");
const {
  isGoogleAvatarUrl,
  canonicalizeGoogleAvatarUrl,
  mirrorGoogleAvatar,
} = require("../services/googleAvatar");
const objectStorage = require("../services/objectStorage");
const db = require("../db");

describe("googleAvatar service", () => {
  it("validates googleusercontent URLs accurately", () => {
    assert.equal(isGoogleAvatarUrl("https://lh3.googleusercontent.com/a/ACg8ocK=s96-c"), true);
    assert.equal(isGoogleAvatarUrl("https://lh4.googleusercontent.com/photo.jpg"), true);
    assert.equal(isGoogleAvatarUrl("https://evilgoogleusercontent.com/pic.jpg"), false);
    assert.equal(isGoogleAvatarUrl("https://attacker.com/googleusercontent.com"), false);
    assert.equal(isGoogleAvatarUrl("http://lh3.googleusercontent.com/a/pic.jpg"), false);
    assert.equal(isGoogleAvatarUrl("not a url"), false);
    assert.equal(isGoogleAvatarUrl(null), false);
  });

  it("strips resize suffix =sNN-c to get canonical URL", () => {
    assert.equal(
      canonicalizeGoogleAvatarUrl("https://lh3.googleusercontent.com/a/ACg8ocK=s96-c"),
      "https://lh3.googleusercontent.com/a/ACg8ocK"
    );
    assert.equal(
      canonicalizeGoogleAvatarUrl("https://lh3.googleusercontent.com/a/ACg8ocK=s400"),
      "https://lh3.googleusercontent.com/a/ACg8ocK"
    );
    assert.equal(
      canonicalizeGoogleAvatarUrl("https://lh3.googleusercontent.com/a/ACg8ocK"),
      "https://lh3.googleusercontent.com/a/ACg8ocK"
    );
  });

  it("never overwrites avatar if avatar_source is upload", async () => {
    const originalQuery = db.query;
    let queryCalls = [];
    db.query = async (sql, params) => {
      queryCalls.push({ sql, params });
      if (sql.includes("SELECT avatar_url")) {
        return {
          rows: [
            {
              avatar_url: "avatars/my-custom-upload.jpg",
              avatar_source: "upload",
              google_avatar_url: "https://lh3.googleusercontent.com/old",
            },
          ],
        };
      }
      return { rows: [] };
    };

    try {
      const res = await mirrorGoogleAvatar(
        "u1",
        "https://lh3.googleusercontent.com/new-pic=s96-c"
      );
      assert.equal(res, null);

      // Verify it did not set avatar_url, but only updated google_avatar_url
      const updateCall = queryCalls.find((c) => c.sql.includes("UPDATE public.profiles SET google_avatar_url"));
      assert.ok(updateCall);
      assert.equal(updateCall.params[0], "https://lh3.googleusercontent.com/new-pic");
    } finally {
      db.query = originalQuery;
    }
  });

  it("skips download if avatar_source is google and url matches", async () => {
    const originalQuery = db.query;
    db.query = async (sql) => {
      if (sql.includes("SELECT avatar_url")) {
        return {
          rows: [
            {
              avatar_url: "avatars/mirrored-pic.jpg",
              avatar_source: "google",
              google_avatar_url: "https://lh3.googleusercontent.com/same-pic",
            },
          ],
        };
      }
      return { rows: [] };
    };

    try {
      const res = await mirrorGoogleAvatar(
        "u1",
        "https://lh3.googleusercontent.com/same-pic=s96-c"
      );
      assert.deepEqual(res, { key: "avatars/mirrored-pic.jpg" });
    } finally {
      db.query = originalQuery;
    }
  });

  it("mirrors upstream Google picture to storage on happy path", async () => {
    const originalQuery = db.query;
    const originalFetch = global.fetch;
    const uploadService = require("../services/uploadService");

    let updateParams = null;
    db.query = async (sql, params) => {
      if (sql.includes("SELECT avatar_url")) {
        return {
          rows: [
            {
              avatar_url: null,
              avatar_source: null,
              google_avatar_url: null,
            },
          ],
        };
      }
      if (sql.includes("UPDATE public.profiles")) {
        updateParams = params;
        return { rows: [] };
      }
      return { rows: [] };
    };

    global.fetch = async () => ({
      ok: true,
      status: 200,
      headers: { get: (h) => (h.toLowerCase() === "content-type" ? "image/jpeg" : null) },
      arrayBuffer: async () => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
    });

    uploadService.__setStoreUpload(async () => ({
      key: "avatars/hashed-key-123.jpg",
    }));

    try {
      const res = await mirrorGoogleAvatar(
        "u1",
        "https://lh3.googleusercontent.com/new-user=s96-c"
      );
      assert.deepEqual(res, { key: "avatars/hashed-key-123.jpg" });
      assert.ok(updateParams);
      assert.equal(updateParams[0], "avatars/hashed-key-123.jpg");
      assert.equal(updateParams[1], "https://lh3.googleusercontent.com/new-user");
      assert.equal(updateParams[2], "u1");
    } finally {
      db.query = originalQuery;
      global.fetch = originalFetch;
      uploadService.__resetStoreUpload();
    }
  });

  it("updateUser sets avatar_source='upload' when avatar_url is provided", async () => {
    const originalQuery = db.query;
    const userModel = require("../models/userModel");
    let querySql = "";
    let queryParams = [];

    db.query = async (sql, params) => {
      querySql = sql;
      queryParams = params;
      const avatarIdx = params.indexOf("avatars/custom-upload.jpg");
      return { rows: [{ id: "u1", avatar_url: params[avatarIdx], avatar_source: "upload" }] };
    };

    try {
      const user = await userModel.updateUser("u1", { avatar_url: "avatars/custom-upload.jpg" });
      const avatarParamIdx = queryParams.indexOf("avatars/custom-upload.jpg") + 1;
      assert.ok(querySql.includes(`avatar_source = CASE WHEN $${avatarParamIdx} IS NOT NULL THEN 'upload'`));
      assert.equal(user.avatar_source, "upload");
    } finally {
      db.query = originalQuery;
    }
  });
});

describe("DELETE /api/users/me/avatar", () => {
  it("removes avatar and nulls avatar columns", async () => {
    const originalQuery = db.query;

    let updatedParams = null;
    db.query = async (sql, params) => {
      if (sql.includes("SELECT avatar_url")) {
        return {
          rows: [
            {
              avatar_url: "avatars/user-123-upload.jpg",
              avatar_source: "upload",
            },
          ],
        };
      }
      if (sql.includes("UPDATE public.profiles")) {
        updatedParams = params;
        return { rows: [{ id: "test-user-123", avatar_url: null }] };
      }
      return { rows: [] };
    };

    try {
      const res = await request(app)
        .delete("/api/users/me/avatar")
        .set("Authorization", "Bearer valid-token");
      assert.equal(res.status, 200);
      assert.equal(res.body.avatar_url, null);
      assert.ok(updatedParams);
      assert.equal(updatedParams[0], "test-user-123");
    } finally {
      db.query = originalQuery;
    }
  });
});
