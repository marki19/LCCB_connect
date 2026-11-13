// Unit tests for the storage-URL service. This works purely at the service
// boundary: given a stored object key, it infers the public URL and expands
// any *_url field it recognises. No mocking is necessary for the synchronous
// pass; the async pass (private buckets) is exercised with an injected admin
// factory so the test never touches the network.
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_URL = "https://test-project.supabase.co";
const {
  publicStorageUrl,
  withStorageUrlsSync,
  withStorageUrls,
  __setAdminFactory,
  __clearStorageCache,
} = require("../services/storageService");

const BASE = "https://test-project.supabase.co/storage/v1/object/public";

beforeEach(() => {
  process.env.SUPABASE_URL = "https://test-project.supabase.co";
});

describe("publicStorageUrl", () => {
  it("builds a public URL for an avatars key", () => {
    assert.equal(
      publicStorageUrl("avatars", "avatars/1/2.jpg"),
      `${BASE}/avatars/avatars/1/2.jpg`
    );
  });

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

describe("withStorageUrlsSync", () => {
  // `assets` and `theses` are private (migration 015): the stored key is left
  // intact and the client must ask the backend for a signed URL. Only
  // `avatars` is expanded inline.
  it("leaves a private assets key as the raw key", () => {
    assert.deepEqual(
      withStorageUrlsSync({ id: "p1", image_url: "posts/1/2.jpg" }),
      { id: "p1", image_url: "posts/1/2.jpg" }
    );
  });

  it("leaves a private theses key as the raw key", () => {
    assert.deepEqual(
      withStorageUrlsSync({ id: "t1", pdf_url: "1/2.pdf" }),
      { id: "t1", pdf_url: "1/2.pdf" }
    );
  });

  it("expands a nested avatar key (avatars is public)", () => {
    assert.deepEqual(
      withStorageUrlsSync({
        id: "p2",
        author: { avatar_url: "avatars/1/2.jpg" },
      }),
      {
        id: "p2",
        author: {
          avatar_url: `${BASE}/avatars/avatars/1/2.jpg`,
        },
      }
    );
  });

  it("expands keys inside arrays", () => {
    assert.deepEqual(
      withStorageUrlsSync([
        { id: "p3", image_url: "posts/3/4.jpg" },
        { id: "p4", image_url: `${BASE}/posts/5/6.jpg` },
      ]),
      [
        { id: "p3", image_url: "posts/3/4.jpg" },
        { id: "p4", image_url: `${BASE}/posts/5/6.jpg` },
      ]
    );
  });

  it("does not touch unrelated fields", () => {
    assert.deepEqual(
      withStorageUrlsSync({ id: "p5", github_url: "https://github.com/x" }),
      { id: "p5", github_url: "https://github.com/x" }
    );
  });

  it("passes through opaque JSON metadata untouched", () => {
    assert.deepEqual(
      withStorageUrlsSync({
        id: "a1",
        action: "user.suspend",
        metadata: {
          reason_code: 42,
          extra: { deep: { nested: {} } },
        },
      }),
      {
        id: "a1",
        action: "user.suspend",
        metadata: {
          reason_code: 42,
          extra: { deep: { nested: {} } },
        },
      }
    );
  });
});

describe("withStorageUrls (async, private buckets)", () => {
  let bulkCalls;

  beforeEach(() => {
    __clearStorageCache();
    bulkCalls = [];
    __setAdminFactory(() => ({
      storage: {
        from: (bucket) => ({
          createSignedUrls: async (paths) => {
            bulkCalls.push({ bucket, paths });
            return {
              data: paths.map((p) => ({
                path: p,
                signedUrl: `https://signed/${bucket}/${p}`,
                error: null,
              })),
              error: null,
            };
          },
          createSignedUrl: async (key) => {
            return {
              data: { signedUrl: `https://signed/${bucket}/${key}` },
              error: null,
            };
          },
        }),
      },
    }));
  });

  it("resolves a private assets key to a signed URL", async () => {
    const out = await withStorageUrls({ id: "p1", image_url: "posts/1/2.jpg" });
    assert.deepEqual(out, { id: "p1", image_url: "https://signed/assets/posts/1/2.jpg" });
    assert.deepEqual(bulkCalls, [{ bucket: "assets", paths: ["posts/1/2.jpg"] }]);
  });

  it("resolves a private theses key to a signed URL", async () => {
    const out = await withStorageUrls({ id: "t1", pdf_url: "1/2.pdf" });
    assert.deepEqual(out, { id: "t1", pdf_url: "https://signed/theses/1/2.pdf" });
    assert.deepEqual(bulkCalls, [{ bucket: "theses", paths: ["1/2.pdf"] }]);
  });

  it("leaves public avatars keys as plain URLs (no admin call)", async () => {
    const out = await withStorageUrls({ id: "u1", avatar_url: "avatars/1/2.jpg" });
    assert.equal(out.avatar_url, `${BASE}/avatars/avatars/1/2.jpg`);
    assert.deepEqual(bulkCalls, []);
  });

  it("batches multiple keys in the same bucket into a single bulk call", async () => {
    const out = await withStorageUrls([
      { id: "a", image_url: "a/1.jpg" },
      { id: "b", image_url: "b/2.jpg", image_urls: ["b/3.jpg", "b/4.jpg"] },
      { id: "c", image_url: "c/5.jpg" },
    ]);
    assert.equal(out[0].image_url, "https://signed/assets/a/1.jpg");
    assert.equal(out[1].image_urls[0], "https://signed/assets/b/3.jpg");
    assert.equal(out[1].image_urls[1], "https://signed/assets/b/4.jpg");
    // All 5 distinct assets keys batched into 1 call for bucket 'assets'
    assert.equal(bulkCalls.length, 1);
    assert.equal(bulkCalls[0].bucket, "assets");
    assert.equal(bulkCalls[0].paths.length, 5);
  });

  it("uses the LRU cache on repeat resolution without hitting storage again", async () => {
    await withStorageUrls({ id: "p1", image_url: "posts/cached/1.jpg" });
    assert.equal(bulkCalls.length, 1);

    // Second call with same key should hit cache
    const out2 = await withStorageUrls({ id: "p2", image_url: "posts/cached/1.jpg" });
    assert.equal(out2.image_url, "https://signed/assets/posts/cached/1.jpg");
    assert.equal(bulkCalls.length, 1, "Cache hit must not invoke bulk signing again");
  });

  it("never throws and returns raw keys when storage fails or times out", async () => {
    __setAdminFactory(() => ({
      storage: {
        from: () => ({
          createSignedUrls: async () => {
            throw new Error("Supabase storage down");
          },
        }),
      },
    }));

    const out = await withStorageUrls({ id: "err1", image_url: "failed/key.jpg" });
    assert.equal(out.image_url, "failed/key.jpg");
  });
});