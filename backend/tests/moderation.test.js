require("./env.helper");

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const moderationService = require("../services/moderationService");
const auth = require("../middleware/auth");
const { stub } = require("./stub.helper");

describe("Moderation AI / Heuristic Service", () => {
  it("flags foul or hate speech in posts", async () => {
    const post = {
      title: "Sample title",
      content: "This is stupid trash and you should kill yourself",
    };
    const result = await moderationService.scanPost(post);
    assert.equal(result.flagged, true);
    assert.ok(result.reason.length > 0);
  });

  it("passes clean academic discussions", async () => {
    const post = {
      title: "Machine Learning Seminar",
      content: "Join us for an overview of neural networks in the IT laboratory tomorrow.",
    };
    const result = await moderationService.scanPost(post);
    assert.equal(result.flagged, false);
  });

  it("flags profanity in comments", async () => {
    const comment = {
      content: "Shut up idiot you bitch",
    };
    const result = await moderationService.scanComment(comment);
    assert.equal(result.flagged, true);
  });

  it("sends x-goog-api-key header and caps prompt text when GEMINI_API_KEY is configured", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-secret-key";

    const fetchStub = stub(global, "fetch", async (url, options) => {
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      flagged: false,
                      score: 0.1,
                      reason: null,
                      category: null,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    });

    try {
      const longText = "a".repeat(6000);
      const res = await moderationService.scanText(longText);

      assert.equal(fetchStub.calls.length, 1);
      const [url, options] = fetchStub.calls[0];

      assert.equal(
        url,
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
      );
      assert.ok(!url.includes("test-secret-key"));
      assert.equal(options.headers["x-goog-api-key"], "test-secret-key");
      assert.ok(options.signal);

      const reqBody = JSON.parse(options.body);
      const prompt = reqBody.contents[0].parts[0].text;
      assert.ok(!prompt.includes("a".repeat(5001)));
      assert.ok(prompt.includes("a".repeat(5000)));

      assert.equal(res.flagged, false);
    } finally {
      fetchStub.restore();
      if (originalKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  it("falls back to local heuristic scan when Gemini API fetch fails", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-secret-key";

    const fetchStub = stub(global, "fetch", async () => {
      throw new Error("Network timeout or connection refused");
    });

    try {
      const foulText = "You are a total asshole and idiot";
      const res = await moderationService.scanText(foulText);

      assert.equal(fetchStub.calls.length, 1);
      assert.equal(res.flagged, true);
      assert.match(res.reason, /asshole/);
    } finally {
      fetchStub.restore();
      if (originalKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });
});

describe("Role and Permission Gates", () => {
  it("normalizes and accepts superAdmin, admin, and departmentAdmin", () => {
    const reqSuper = { profile: { role: "superAdmin" } };
    const reqAdmin = { profile: { role: "admin" } };
    const reqDept = { profile: { role: "department_admin" } };
    const reqStudent = { profile: { role: "student" } };

    assert.equal(auth.isSuperAdmin(reqSuper), true);
    assert.equal(auth.isAdmin(reqAdmin), true);
    assert.equal(auth.isDepartmentAdmin(reqDept), true);
    assert.equal(auth.isSuperAdmin(reqStudent), false);
    assert.equal(auth.isAdmin(reqStudent), false);
    assert.equal(auth.isDepartmentAdmin(reqStudent), false);
  });
});
