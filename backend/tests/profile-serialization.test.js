require("./env.helper");

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const userModel = require("../models/userModel");
const nativeAuth = require("../services/nativeAuth");
const { sanitizeProfile } = require("../utils/profile");
const app = require("../app");

describe("Profile Serialization & Security Hardening", () => {
  const TEST_USER_ID = "11111111-2222-3333-4444-555555555555";
  const ADMIN_USER_ID = "99999999-8888-7777-6666-555555555555";

  describe("sanitizeProfile utility", () => {
    it("strips password_hash from an object without mutating caller source", () => {
      const source = {
        id: "123",
        username: "testuser",
        password_hash: "$2b$12$somehashvaluehere",
        email: "test@lccbonline.edu.ph",
      };

      const sanitized = sanitizeProfile(source);
      assert.strictEqual(sanitized.id, "123");
      assert.strictEqual(sanitized.username, "testuser");
      assert.strictEqual(sanitized.email, "test@lccbonline.edu.ph");
      assert.strictEqual("password_hash" in sanitized, false);
      assert.strictEqual(sanitized.password_hash, undefined);

      // Verify source object was not mutated
      assert.strictEqual(source.password_hash, "$2b$12$somehashvaluehere");
    });

    it("handles null and non-object inputs safely", () => {
      assert.strictEqual(sanitizeProfile(null), null);
      assert.strictEqual(sanitizeProfile(undefined), undefined);
      assert.strictEqual(sanitizeProfile("string"), "string");
    });
  });

  describe("userModel PROFILE_COLUMNS", () => {
    it("never includes password_hash in PROFILE_COLUMNS", () => {
      assert.ok(Array.isArray(userModel.PROFILE_COLUMNS));
      assert.strictEqual(userModel.PROFILE_COLUMNS.includes("password_hash"), false);
      assert.ok(userModel.PROFILE_COLUMNS.includes("id"));
      assert.ok(userModel.PROFILE_COLUMNS.includes("email"));
    });
  });

  describe("HTTP endpoints profile serialization", () => {
    it("GET /api/users/:id never returns password_hash", async () => {
      const studentUser = {
        id: TEST_USER_ID,
        username: "student1",
        email: "student@lccbonline.edu.ph",
        role: "student",
        password_hash: "$2b$12$accidental_hash_that_must_be_stripped",
      };

      stub(userModel, "getUserById", async (id) => (id === TEST_USER_ID ? studentUser : null));

      const tokens = await nativeAuth.signTokens(studentUser);

      const res = await request(app)
        .get(`/api/users/${TEST_USER_ID}`)
        .set("Authorization", `Bearer ${tokens.access_token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, TEST_USER_ID);
      assert.strictEqual("password_hash" in res.body, false);
      assert.strictEqual(res.body.password_hash, undefined);
    });

    it("GET /api/users (admin) never returns password_hash", async () => {
      const adminUser = {
        id: ADMIN_USER_ID,
        role: "admin",
        email: "admin@lccbonline.edu.ph",
      };

      stub(userModel, "getUserById", async (id) => (id === ADMIN_USER_ID ? adminUser : null));
      stub(userModel, "getAllUsers", async () => [
        {
          id: TEST_USER_ID,
          username: "student1",
          password_hash: "$2b$12$leaked_hash_1",
        },
        {
          id: ADMIN_USER_ID,
          username: "admin1",
          password_hash: "$2b$12$leaked_hash_2",
        },
      ]);

      const tokens = await nativeAuth.signTokens(adminUser);

      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${tokens.access_token}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.strictEqual(res.body.length, 2);

      for (const user of res.body) {
        assert.strictEqual("password_hash" in user, false);
        assert.strictEqual(user.password_hash, undefined);
      }
    });

    it("PUT /api/users/:id never returns password_hash", async () => {
      const studentUser = {
        id: TEST_USER_ID,
        role: "student",
        email: "student@lccbonline.edu.ph",
        verification_status: "unverified",
      };

      stub(userModel, "getUserById", async (id) => (id === TEST_USER_ID ? studentUser : null));
      stub(userModel, "updateUser", async () => ({
        id: TEST_USER_ID,
        bio: "Updated bio description",
        password_hash: "$2b$12$dangerous_hash_in_update",
      }));

      const tokens = await nativeAuth.signTokens(studentUser);

      const res = await request(app)
        .put(`/api/users/${TEST_USER_ID}`)
        .set("Authorization", `Bearer ${tokens.access_token}`)
        .send({ bio: "Updated bio description" });

      assert.strictEqual(res.status, 200);
      assert.strictEqual("password_hash" in res.body, false);
      assert.strictEqual(res.body.password_hash, undefined);
    });
  });
});
