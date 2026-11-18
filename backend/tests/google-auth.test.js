require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { stub } = require("./stub.helper");

const supabaseAdmin = require("../services/supabaseAdmin");
const userModel = require("../models/userModel");
const mfaService = require("../services/mfaService");

// Mock admin client
const mockAdminClient = {
  auth: {
    signInWithIdToken: async () => ({ data: { session: null, user: null }, error: { message: "not stubbed" } }),
    getUser: async () => ({ data: { user: null }, error: { message: "not stubbed" } }),
    admin: {
      deleteUser: async () => ({ data: {}, error: null }),
    },
  },
};

stub(supabaseAdmin, "getSupabaseAdmin", () => mockAdminClient);
stub(mfaService, "hasVerifiedTotp", async () => false);
stub(mfaService, "recordLogin", async () => {});

let testUserDb = new Map();
stub(userModel, "getUserById", async (id) => testUserDb.get(id) || null);
stub(userModel, "createUser", async (userData) => {
  testUserDb.set(userData.id, { ...userData });
  return testUserDb.get(userData.id);
});
stub(userModel, "updateUser", async (id, updates) => {
  const current = testUserDb.get(id) || {};
  testUserDb.set(id, { ...current, ...updates });
  return testUserDb.get(id);
});

const app = require("../app");

describe("POST /api/auth/google", () => {
  beforeEach(() => {
    testUserDb.clear();
  });

  it("fails with 400 when neither id_token nor access_token is provided", async () => {
    const res = await request(app).post("/api/auth/google").send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "Google ID token or access token is required");
  });

  it("authenticates via id_token (native/GIS) for valid @lccbonline.edu.ph user", async () => {
    mockAdminClient.auth.signInWithIdToken = async ({ token }) => {
      if (token === "valid-id-token") {
        return {
          data: {
            session: {
              access_token: "supa-access-tok",
              refresh_token: "supa-refresh-tok",
              expires_at: 1234567890,
            },
            user: {
              id: "google-uid-1",
              email: "student@lccbonline.edu.ph",
              user_metadata: {
                full_name: "Google Student",
                avatar_url: "https://avatar.url/pic.jpg",
              },
            },
          },
          error: null,
        };
      }
      return { data: null, error: { message: "Invalid id token" } };
    };

    const res = await request(app)
      .post("/api/auth/google")
      .send({ id_token: "valid-id-token" });

    assert.equal(res.status, 200);
    assert.equal(res.body.access_token, "supa-access-tok");
    assert.equal(res.body.user.email, "student@lccbonline.edu.ph");
    assert.equal(res.body.user.role, "user");
  });

  it("authenticates via access_token (web OAuth) and mints native token", async () => {
    mockAdminClient.auth.getUser = async (token) => {
      if (token === "valid-supa-access-token") {
        return {
          data: {
            user: {
              id: "google-uid-2",
              email: "webstudent@lccbonline.edu.ph",
              user_metadata: {
                name: "Web Student",
              },
            },
          },
          error: null,
        };
      }
      return { data: null, error: { message: "Invalid access token" } };
    };

    const res = await request(app)
      .post("/api/auth/google")
      .send({ access_token: "valid-supa-access-token" });

    assert.equal(res.status, 200);
    assert.ok(res.body.access_token);
    assert.ok(res.body.refresh_token);
    assert.equal(res.body.user.email, "webstudent@lccbonline.edu.ph");
    assert.equal(res.body.user.role, "user");
  });

  it("allows non-@lccbonline.edu.ph email domains (e.g. gmail.com) as role: user", async () => {
    mockAdminClient.auth.getUser = async () => ({
      data: {
        user: {
          id: "google-uid-3",
          email: "outsider@gmail.com",
          user_metadata: { name: "External User" },
        },
      },
      error: null,
    });

    const res = await request(app)
      .post("/api/auth/google")
      .send({ access_token: "some-token" });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, "outsider@gmail.com");
    assert.equal(res.body.user.role, "user");
  });

  it("rejects Google accounts without an email with 400", async () => {
    mockAdminClient.auth.getUser = async () => ({
      data: {
        user: {
          id: "google-uid-no-email",
          email: null,
          user_metadata: {},
        },
      },
      error: null,
    });

    const res = await request(app)
      .post("/api/auth/google")
      .send({ access_token: "some-token" });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "missing_email");
  });
});
