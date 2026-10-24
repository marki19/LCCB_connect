// Unit tests for the storage-URL service. This works purely at the service
// boundary: given a stored object key, it infers the public URL and expands
// any *_url field it recognises. No mocking is necessary because this is pure
// string/object work.
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_URL = "https://test-project.supabase.co";
const {
  publicStorageUrl,
  withStorageUrls,
} = require("../services/storageService");

const BASE = "https://test-project.supabase.co/storage/v1/object/public";

beforeEach(() => {
  process.env.SUPABASE_URL = "https://test-project.supabase.co";
});

describe("publicStorageUrl", () => {
  it("builds a public URL for an assets key", () => {
    assert.equal(
      publicStorageUrl("assets", "posts/1/2.jpg"),
      `${BASE}/assets/posts/1/2.jpg`
    );
  });

  it("builds a public URL for a theses key", () => {
    assert.equal(
      publicStorageUrl("theses", "1/2.pdf"),
      `${BASE}/theses/1/2.pdf`
    );
  });

  it("does not re-encode an already absolute URL", () => {
    assert.equal(
      publicStorageUrl("assets", `${BASE}/posts/1/2.jpg`),
      `${BASE}/posts/1/2.jpg`
    );
  });

  it("returns null for missing values", () => {
    assert.equal(publicStorageUrl("assets", null), null);
    assert.equal(publicStorageUrl("assets", ""), null);
  });
});

describe("withStorageUrls", () => {
  it("expands a post image key to its public URL", () => {
    assert.deepEqual(
      withStorageUrls({ id: "p1", image_url: "posts/1/2.jpg" }),
      {
        id: "p1",
        image_url: `${BASE}/assets/posts/1/2.jpg`,
      }
    );
  });

  it("expands a thesis pdf key to its public URL", () => {
    assert.deepEqual(
      withStorageUrls({ id: "t1", pdf_url: "1/2.pdf" }),
      {
        id: "t1",
        pdf_url: `${BASE}/theses/1/2.pdf`,
      }
    );
  });

  it("expands a nested avatar key", () => {
    assert.deepEqual(
      withStorageUrls({
        id: "p2",
        author: { avatar_url: "avatars/1/2.jpg" },
      }),
      {
        id: "p2",
        author: {
          avatar_url: `${BASE}/assets/avatars/1/2.jpg`,
        },
      }
    );
  });

  it("expands keys inside arrays", () => {
    assert.deepEqual(
      withStorageUrls([
        { id: "p3", image_url: "posts/3/4.jpg" },
        { id: "p4", image_url: `${BASE}/posts/5/6.jpg` },
      ]),
      [
        { id: "p3", image_url: `${BASE}/assets/posts/3/4.jpg` },
        { id: "p4", image_url: `${BASE}/posts/5/6.jpg` },
      ]
    );
  });

  it("does not touch unrelated fields", () => {
    assert.deepEqual(
      withStorageUrls({ id: "p5", github_url: "https://github.com/x" }),
      { id: "p5", github_url: "https://github.com/x" }
    );
  });
});
