const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const { createPostSchema } = require("../validation");
const { withStorageUrls, withStorageUrlsSync, __setAdminFactory } = require("../services/storageService");

describe("multi-image posts", () => {
  describe("validation", () => {
    it("accepts valid image_urls array with 1 to 4 storage keys", () => {
      const valid = createPostSchema.safeParse({
        content: "Check out these photos",
        type: "image",
        image_urls: [
          "posts/user1/photo1.jpg",
          "posts/user1/photo2.jpg",
          "posts/user1/photo3.jpg",
          "posts/user1/photo4.jpg",
        ],
      });
      assert.equal(valid.success, true);
    });

    it("rejects image_urls with more than 4 keys", () => {
      const invalid = createPostSchema.safeParse({
        content: "Too many photos",
        type: "image",
        image_urls: [
          "posts/1.jpg",
          "posts/2.jpg",
          "posts/3.jpg",
          "posts/4.jpg",
          "posts/5.jpg",
        ],
      });
      assert.equal(invalid.success, false);
      assert.match(invalid.error.issues[0].message, /too big|<=4|at most 4/i);
    });

    it("rejects invalid storage keys in image_urls (traversal, absolute URLs)", () => {
      const invalidTraversal = createPostSchema.safeParse({
        content: "Bad key",
        type: "image",
        image_urls: ["posts/../evil.jpg"],
      });
      assert.equal(invalidTraversal.success, false);

      const invalidHttp = createPostSchema.safeParse({
        content: "External url",
        type: "image",
        image_urls: ["https://external.com/photo.jpg"],
      });
      assert.equal(invalidHttp.success, false);
    });
  });

  describe("storageService URL resolution", () => {
    let signedUrlCalls = [];

    before(() => {
      process.env.SUPABASE_URL = "https://mock.supabase.co";
      __setAdminFactory(() => ({
        storage: {
          from: (bucket) => ({
            createSignedUrl: async (key, expiresIn) => {
              signedUrlCalls.push({ bucket, key, expiresIn });
              return {
                data: { signedUrl: `https://signed/${bucket}/${key}` },
                error: null,
              };
            },
          }),
        },
      }));
    });

    afterEach(() => {
      signedUrlCalls = [];
    });

    it("withStorageUrlsSync preserves raw keys in image_urls", () => {
      const post = {
        id: "p1",
        image_urls: ["posts/1/a.jpg", "posts/1/b.jpg"],
      };
      const synced = withStorageUrlsSync(post);
      assert.deepEqual(synced.image_urls, ["posts/1/a.jpg", "posts/1/b.jpg"]);
    });

    it("withStorageUrls signs each key in image_urls array", async () => {
      const post = {
        id: "p1",
        image_url: "posts/1/a.jpg",
        image_urls: ["posts/1/a.jpg", "posts/1/b.jpg", "posts/1/c.jpg"],
      };
      const resolved = await withStorageUrls(post);
      assert.equal(resolved.image_url, "https://signed/assets/posts/1/a.jpg");
      assert.deepEqual(resolved.image_urls, [
        "https://signed/assets/posts/1/a.jpg",
        "https://signed/assets/posts/1/b.jpg",
        "https://signed/assets/posts/1/c.jpg",
      ]);
      assert.equal(signedUrlCalls.length, 4); // 1 for image_url + 3 for image_urls
    });
  });
});
