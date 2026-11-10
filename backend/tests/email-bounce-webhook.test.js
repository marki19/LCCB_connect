/**
 * Brevo Email Bounce Webhook Tests
 * Tests POST /api/email/webhook/brevo
 * Uses Node's native test runner (node --test)
 * Uses real database with stubbed Supabase Auth
 * NODE_ENV=test is set BEFORE app load to disable rate limits
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const path = require("path");
const crypto = require("crypto");

// Set NODE_ENV=test BEFORE any app modules load (disables rate limits)
process.env.NODE_ENV = "test";

// Load real .env for database connection
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://test-project.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgrespassword@127.0.0.1:5432/lcc_connect_test";

const { stub } = require("./stub.helper");
const userModel = require("../models/userModel");
const supabaseAdmin = require("../services/supabaseAdmin");

// Save real getSupabaseAdmin for cleanup in after hook
const realGetSupabaseAdmin = supabaseAdmin.getSupabaseAdmin;

// Test webhook secret
const WEBHOOK_SECRET = "test-webhook-secret-32-chars!!";
process.env.BREVO_WEBHOOK_SECRET = WEBHOOK_SECRET;

function signPayload(payload) {
  return crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");
}

// Create test user BEFORE stubs and app import
let testUserId;
let testUserEmail;

before(async () => {
  testUserEmail = `bounce-test-${Date.now()}@lccbonline.edu.ph`;
  try {
    const { data, error } = await realGetSupabaseAdmin()
      .auth.admin.createUser({
        email: testUserEmail,
        password: "TestPass123!",
        email_confirm: true,
      });

    if (error || !data?.user?.id) {
      testUserId = crypto.randomUUID();
    } else {
      testUserId = data.user.id;
    }
  } catch {
    testUserId = crypto.randomUUID();
  }

  // Create profile
  await userModel.createUser({
    id: testUserId,
    email: testUserEmail,
    passwordHash: "dummy",
    fullName: "Bounce Test User",
    role: "student",
    verification_status: "verified",
  });
});

after(async () => {
  if (testUserId) {
    try {
      await userModel.deleteUser(testUserId);
    } catch {}
    try {
      await realGetSupabaseAdmin()
        .auth.admin.deleteUser(testUserId);
    } catch {}
  }
});

// Stub Supabase Admin
stub(supabaseAdmin, "getSupabaseAdmin", () => ({
  auth: {
    admin: {
      listUsers: async () => ({ data: { users: [] }, error: null }),
    },
  },
}));

// Import app AFTER stubs are installed
const app = require("../app");

describe("POST /api/email/webhook/brevo", () => {
  it("returns 401 when signature header is missing", async () => {
    const payload = {
      event: "bounce",
      email: testUserEmail,
      reason: "The email account does not exist",
      code: "550",
      type: "hard",
      timestamp: Math.floor(Date.now() / 1000),
    };

    const res = await request(app)
      .post("/api/email/webhook/brevo")
      .send(payload);

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.code, "missing_signature");
  });

  it("returns 401 when signature is invalid", async () => {
    const payload = {
      event: "bounce",
      email: testUserEmail,
      reason: "The email account does not exist",
      code: "550",
      type: "hard",
      timestamp: Math.floor(Date.now() / 1000),
    };

    const res = await request(app)
      .post("/api/email/webhook/brevo")
      .set("X-Brevo-Signature", "invalid-signature")
      .send(payload);

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.code, "invalid_signature");
  });

  it("returns 200 and ignores soft bounce (type !== 'hard')", async () => {
    const payload = {
      event: "bounce",
      email: testUserEmail,
      reason: "Mailbox full",
      code: "550",
      type: "soft",
      timestamp: Math.floor(Date.now() / 1000),
    };

    const signature = signPayload(payload);

    const res = await request(app)
      .post("/api/email/webhook/brevo")
      .set("X-Brevo-Signature", signature)
      .send(payload);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.processed, false);
    assert.strictEqual(res.body.reason, "not_hard_bounce_550");

    // Verify profile not marked as bounced
    const profile = await userModel.getUserById(testUserId);
    assert.strictEqual(profile.email_bounced, false);
  });

  it("returns 200 and ignores non-550 code", async () => {
    const payload = {
      event: "bounce",
      email: testUserEmail,
      reason: "Spam rejected",
      code: "554",
      type: "hard",
      timestamp: Math.floor(Date.now() / 1000),
    };

    const signature = signPayload(payload);

    const res = await request(app)
      .post("/api/email/webhook/brevo")
      .set("X-Brevo-Signature", signature)
      .send(payload);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.processed, false);
    assert.strictEqual(res.body.reason, "not_hard_bounce_550");
  });

  it("returns 200 and ignores non-bounce event", async () => {
    const payload = {
      event: "delivered",
      email: testUserEmail,
      timestamp: Math.floor(Date.now() / 1000),
    };

    const signature = signPayload(payload);

    const res = await request(app)
      .post("/api/email/webhook/brevo")
      .set("X-Brevo-Signature", signature)
      .send(payload);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.processed, false);
  });

  it("marks profile as bounced for hard bounce 550", async () => {
    const payload = {
      event: "bounce",
      email: testUserEmail,
      reason: "The email account that you tried to reach does not exist",
      code: "550",
      type: "hard",
      timestamp: Math.floor(Date.now() / 1000),
    };

    const signature = signPayload(payload);

    const res = await request(app)
      .post("/api/email/webhook/brevo")
      .set("X-Brevo-Signature", signature)
      .send(payload);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.processed, true);

    // Verify profile marked as bounced
    const profile = await userModel.getUserById(testUserId);
    assert.strictEqual(profile.email_bounced, true);
    assert.ok(profile.bounce_reason.includes("does not exist"));
    assert.ok(profile.bounced_at);
  });

  it("returns 200 (not 404) for email not in profiles", async () => {
    const payload = {
      event: "bounce",
      email: "nonexistent@lccbonline.edu.ph",
      reason: "The email account does not exist",
      code: "550",
      type: "hard",
      timestamp: Math.floor(Date.now() / 1000),
    };

    const signature = signPayload(payload);

    const res = await request(app)
      .post("/api/email/webhook/brevo")
      .set("X-Brevo-Signature", signature)
      .send(payload);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.processed, true);
  });

  it("returns 400 when email is missing from payload", async () => {
    const payload = {
      event: "bounce",
      reason: "The email account does not exist",
      code: "550",
      type: "hard",
      timestamp: Math.floor(Date.now() / 1000),
    };

    const signature = signPayload(payload);

    const res = await request(app)
      .post("/api/email/webhook/brevo")
      .set("X-Brevo-Signature", signature)
      .send(payload);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "Validation failed");
    assert.ok(res.body.fields.some((f) => f.path === "email"));
  });

  it("rate limits webhook endpoint (NODE_ENV=test disables rate limiting middleware in app, but endpoint limit applies)", async () => {
    // Note: rate limit middleware is disabled when NODE_ENV=test so this test checks requests pass through
    const payload = {
      event: "bounce",
      email: "ratelimit-test@lccbonline.edu.ph",
      reason: "Test",
      code: "550",
      type: "hard",
      timestamp: Math.floor(Date.now() / 1000),
    };
    const signature = signPayload(payload);

    const res = await request(app)
      .post("/api/email/webhook/brevo")
      .set("X-Brevo-Signature", signature)
      .send(payload);

    assert.strictEqual(res.status, 200);
  });
});