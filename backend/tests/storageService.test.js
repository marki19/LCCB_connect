/**
 * Storage-URL expansion tests.
 *
 * The signer is injected, so these run without credentials and without a
 * network. What is under test is the mapping from stored keys to object keys
 * and the shape of the expanded payload — the signature itself is covered by
 * `sigv4.test.js` and by the live smoke test.
 */
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  isAbsoluteUrl,
  objectKey,
  publicStorageUrl,
  signedStorageUrl,
  resolveStorageUrl,
  withStorageUrls,
  withStorageUrlsSync,
  __setSigner,
  __resetSigner,
} = require("../services/storageService");

let signed;

beforeEach(() => {
  signed = [];
  __setSigner((key, expiresIn) => {
    signed.push({ key, expiresIn });
    return `https://r2.example/${key}?sig=abc`;
  });
});

describe("objectKey", () => {
  it("prefixes a bare filename with the bucket's category", () => {
    assert.equal(objectKey("avatars", "abc.jpg"), "avatars/abc.jpg");
    assert.equal(objectKey("theses", "abc.pdf"), "theses/abc.pdf");
  });

  it("maps the legacy assets bucket onto the posts category", () => {
    assert.equal(objectKey("assets", "abc.jpg"), "posts/abc.jpg");
  });

  it("leaves a key that already carries its category alone", () => {
    assert.equal(objectKey("assets", "posts/abc.jpg"), "posts/abc.jpg");
    assert.equal(objectKey("theses", "theses/abc.pdf"), "theses/abc.pdf");
  });

  it("strips the local-disk uploads prefix", () => {
    assert.equal(objectKey("assets", "uploads/1794567913184-j2hvi1f.jpg"), "posts/1794567913184-j2hvi1f.jpg");
  });

  it("tolerates a leading slash", () => {
    assert.equal(objectKey("avatars", "/abc.jpg"), "avatars/abc.jpg");
  });
});

describe("isAbsoluteUrl", () => {
  it("recognises every scheme a client can render directly", () => {
    assert.equal(isAbsoluteUrl("https://example.com/a.jpg"), true);
    assert.equal(isAbsoluteUrl("http://example.com/a.jpg"), true);
    assert.equal(isAbsoluteUrl("data:image/png;base64,AAA"), true);
    assert.equal(isAbsoluteUrl("blob:abc"), true);
    assert.equal(isAbsoluteUrl("file:///tmp/a.jpg"), true);
  });

  it("treats stored keys as relative", () => {
    assert.equal(isAbsoluteUrl("posts/a.jpg"), false);
    assert.equal(isAbsoluteUrl("a.jpg"), false);
  });
});

describe("signedStorageUrl", () => {
  it("signs a stored key and reports the URL", async () => {
    const { url } = await signedStorageUrl("assets", "abc.jpg");

    assert.equal(url, "https://r2.example/posts/abc.jpg?sig=abc");
    assert.equal(signed.length, 1);
    assert.equal(signed[0].key, "posts/abc.jpg");
  });

  it("honours a caller-supplied lifetime", async () => {
    await signedStorageUrl("theses", "abc.pdf", { expiresIn: 60 });
    assert.equal(signed[0].expiresIn, 60);
  });

  it("returns null for an empty key instead of signing", async () => {
    assert.deepEqual(await signedStorageUrl("assets", ""), { url: null });
    assert.equal(signed.length, 0);
  });

  it("passes an absolute URL through untouched", async () => {
    const { url } = await signedStorageUrl("avatars", "https://lh3.googleusercontent.com/a.jpg");
    assert.equal(url, "https://lh3.googleusercontent.com/a.jpg");
    assert.equal(signed.length, 0);
  });

  it("hands back the raw key when signing is impossible", async () => {
    __setSigner(() => {
      throw new Error("not configured");
    });

    const { url } = await signedStorageUrl("assets", "abc.jpg");
    assert.equal(url, "abc.jpg");
  });
});

describe("resolveStorageUrl", () => {
  it("returns just the URL", async () => {
    assert.equal(await resolveStorageUrl("avatars", "abc.jpg"), "https://r2.example/avatars/abc.jpg?sig=abc");
  });
});

describe("publicStorageUrl", () => {
  it("expands a key synchronously", () => {
    assert.equal(publicStorageUrl("avatars", "abc.jpg"), "https://r2.example/avatars/abc.jpg?sig=abc");
  });
});

describe("withStorageUrls", () => {
  it("expands the recognised file columns", async () => {
    const resolved = await withStorageUrls({
      id: "p1",
      image_url: "abc.jpg",
      avatar_url: "me.png",
      pdf_url: "paper.pdf",
    });

    assert.equal(resolved.image_url, "https://r2.example/posts/abc.jpg?sig=abc");
    assert.equal(resolved.avatar_url, "https://r2.example/avatars/me.png?sig=abc");
    assert.equal(resolved.pdf_url, "https://r2.example/theses/paper.pdf?sig=abc");
  });

  it("expands every entry of image_urls", async () => {
    const resolved = await withStorageUrls({
      id: "p1",
      image_urls: ["a.jpg", "b.jpg"],
    });

    assert.deepEqual(resolved.image_urls, [
      "https://r2.example/posts/a.jpg?sig=abc",
      "https://r2.example/posts/b.jpg?sig=abc",
    ]);
  });

  it("expands nested authors and arrays of rows", async () => {
    const resolved = await withStorageUrls([
      { id: "p1", image_url: "a.jpg", author: { id: "u1", avatar_url: "me.png" } },
    ]);

    assert.equal(resolved[0].image_url, "https://r2.example/posts/a.jpg?sig=abc");
    assert.equal(resolved[0].author.avatar_url, "https://r2.example/avatars/me.png?sig=abc");
  });

  it("leaves absolute URLs, nulls, and non-strings alone", async () => {
    const resolved = await withStorageUrls({
      image_url: "https://cdn.example/a.jpg",
      avatar_url: null,
      pdf_url: 42,
    });

    assert.equal(resolved.image_url, "https://cdn.example/a.jpg");
    assert.equal(resolved.avatar_url, null);
    assert.equal(resolved.pdf_url, 42);
    assert.equal(signed.length, 0);
  });

  it("passes primitives and dates through unchanged", async () => {
    assert.equal(await withStorageUrls("hello"), "hello");
    assert.equal(await withStorageUrls(null), null);

    const when = new Date();
    assert.equal(await withStorageUrls(when), when);
  });

  it("does not mutate the input object", async () => {
    const post = { id: "p1", image_url: "a.jpg" };
    await withStorageUrls(post);
    assert.equal(post.image_url, "a.jpg");
  });

  it("never throws when the signer fails", async () => {
    __setSigner(() => {
      throw new Error("boom");
    });

    const resolved = await withStorageUrls({ image_url: "a.jpg" });
    assert.equal(resolved.image_url, "a.jpg");
  });
});

describe("withStorageUrlsSync", () => {
  it("expands the same fields synchronously", () => {
    const resolved = withStorageUrlsSync({ image_url: "a.jpg", avatar_url: "me.png" });

    assert.equal(resolved.image_url, "https://r2.example/posts/a.jpg?sig=abc");
    assert.equal(resolved.avatar_url, "https://r2.example/avatars/me.png?sig=abc");
  });

  it("matches the asynchronous result", async () => {
    const post = { image_url: "a.jpg", image_urls: ["a.jpg", "b.jpg"] };
    assert.deepEqual(withStorageUrlsSync(post), await withStorageUrls(post));
  });
});

describe("__resetSigner", () => {
  it("restores the real object-storage signer", () => {
    __resetSigner();
    // Unconfigured in tests, so the key survives rather than a URL appearing.
    assert.equal(publicStorageUrl("avatars", "abc.jpg"), "abc.jpg");
    __setSigner((key) => `https://r2.example/${key}`);
  });
});
