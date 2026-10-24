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
