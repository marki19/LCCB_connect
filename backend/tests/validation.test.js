// Contract tests for the storage object keys the client is allowed to send.
// The API accepts bucket-relative storage keys, never raw URLs, so an external
// URL cannot be smuggled into an object column.
require("./env.helper");

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  createPostSchema,
  createThesisSchema,
  createProfileSchema,
} = require("../validation");

describe("post image keys", () => {
  it("accepts a storage object key", () => {
    const parsed = createPostSchema.safeParse({
      content: "x",
      type: "image",
      image_url: "posts/1/2.jpg",
    });
    assert.equal(parsed.success, true);
  });

  it("rejects an external image URL", () => {
    const parsed = createPostSchema.safeParse({
      content: "x",
      type: "image",
      image_url: "https://evil.example/x.jpg",
    });
    assert.equal(parsed.success, false);
  });

  it("rejects path traversal", () => {
    const parsed = createPostSchema.safeParse({
      content: "x",
      type: "image",
      image_url: "posts/1/../2.jpg",
    });
    assert.equal(parsed.success, false);
  });

  it("rejects a protocol-style key", () => {
    const parsed = createPostSchema.safeParse({
      content: "x",
      type: "image",
      image_url: "file:///etc/passwd",
    });
    assert.equal(parsed.success, false);
  });
});

describe("thesis pdf keys", () => {
  it("accepts a storage object key", () => {
    const parsed = createThesisSchema.safeParse({
      title: "t",
      abstract: "a",
      category: "c",
      pdf_url: "1/2.pdf",
    });
    assert.equal(parsed.success, true);
  });

  it("rejects an external pdf URL", () => {
    const parsed = createThesisSchema.safeParse({
      title: "t",
      abstract: "a",
      category: "c",
      pdf_url: "https://w3.org/dummy.pdf",
    });
    assert.equal(parsed.success, false);
  });

  it("rejects a nested path with traversal", () => {
    const parsed = createThesisSchema.safeParse({
      title: "t",
      abstract: "a",
      category: "c",
      pdf_url: "1/../2.pdf",
    });
    assert.equal(parsed.success, false);
  });
});

describe("avatar keys", () => {
  it("accepts a storage object key", () => {
    const parsed = createProfileSchema.safeParse({
      username: "x",
      avatar_url: "avatars/1/2.jpg",
    });
    assert.equal(parsed.success, true);
  });

  it("rejects an external avatar URL", () => {
    const parsed = createProfileSchema.safeParse({
      username: "x",
      avatar_url: "https://evil.example/x.jpg",
    });
    assert.equal(parsed.success, false);
  });
});

// The visibility rule itself lives in Postgres (visible_posts/visible_theses).
// These cover the request contract: only the four levels are accepted, and
// `custom` must name at least one friend.
describe("visibility contract", () => {
  const post = (extra) => createPostSchema.safeParse({ content: "x", ...extra });
  const thesis = (extra) =>
    createThesisSchema.safeParse({ title: "t", abstract: "a", category: "c", pdf_url: "1/2.pdf", ...extra });

  it("accepts each of the five levels", () => {
    for (const visibility of ["public", "department", "friends", "private"]) {
      assert.equal(post({ visibility }).success, true, visibility);
      assert.equal(thesis({ visibility }).success, true, visibility);
    }
    assert.equal(
      post({ visibility: "custom", audience: ["11111111-1111-4111-8111-111111111111"] }).success,
      true
    );
  });

  it("defaults to no visibility field, so the column default applies", () => {
    const parsed = post({});
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.visibility, undefined);
  });

  it("rejects an unknown level", () => {
    assert.equal(post({ visibility: "squad" }).success, false);
    assert.equal(thesis({ visibility: "squad" }).success, false);
  });

  it("rejects custom without an audience", () => {
    assert.equal(post({ visibility: "custom" }).success, false);
    assert.equal(post({ visibility: "custom", audience: [] }).success, false);
    assert.equal(thesis({ visibility: "custom", audience: [] }).success, false);
  });

  it("rejects a non-uuid audience member", () => {
    assert.equal(post({ visibility: "custom", audience: ["not-a-uuid"] }).success, false);
    assert.equal(thesis({ visibility: "custom", audience: ["not-a-uuid"] }).success, false);
  });
});

// Admin console forms send a few UI-only keys that `.strict()` rejects. The
// middleware strips those keys and re-validates; it must never let an invalid
// *field* through just because the caller is an admin.
describe("validate middleware admin leniency", () => {
  const express = require("express");
  const request = require("supertest");
  const { validate } = require("../validation");

  const buildApp = (role) => {
    const app = express();
    app.use(express.json());
    app.post(
      "/posts",
      (req, _res, next) => {
        req.profile = role ? { role } : undefined;
        next();
      },
      validate(createPostSchema),
      (req, res) => res.json({ body: req.body })
    );
    return app;
  };

  it("still rejects an invalid field for an admin", async () => {
    const res = await request(buildApp("superadmin"))
      .post("/posts")
      .send({ content: "hello", visibility: "not-a-visibility" });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, "Validation failed");
  });

  it("rejects an empty post for an admin", async () => {
    const res = await request(buildApp("admin"))
      .post("/posts")
      .send({ visibility: "public" });

    assert.equal(res.status, 400);
  });

  it("strips UI-only keys for an admin and validates the rest", async () => {
    const res = await request(buildApp("superadmin"))
      .post("/posts")
      .send({ content: "hello", composerMode: "expanded" });

    assert.equal(res.status, 200);
    assert.equal(res.body.body.content, "hello");
    assert.equal("composerMode" in res.body.body, false);
  });

  it("does not relax anything for a student", async () => {
    const res = await request(buildApp("student"))
      .post("/posts")
      .send({ content: "hello", composerMode: "expanded" });

    assert.equal(res.status, 400);
  });
});
