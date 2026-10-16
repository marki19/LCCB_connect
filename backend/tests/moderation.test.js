require("./env.helper");

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const moderationService = require("../services/moderationService");
const auth = require("../middleware/auth");

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
