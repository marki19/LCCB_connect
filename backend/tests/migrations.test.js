/**
 * Migration structure test - runs against the LIVE database (requires .env)
 * This test verifies the applied migrations match the expected schema.
 * Run with: node --test tests/migrations.test.js
 * (does NOT use env.helper - uses real .env like verification tests)
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const db = require("../db");

test("migrations: pending_signups table exists with correct columns", async () => {
  const result = await db.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pending_signups'
    ORDER BY ordinal_position
  `);

  assert.ok(result.rows.length > 0, "pending_signups table should exist");

  const columns = Object.fromEntries(
    result.rows.map((r) => [r.column_name, { type: r.data_type, nullable: r.is_nullable }])
  );

  assert.ok(columns.id, "id column should exist");
  assert.equal(columns.id.type, "uuid", "id should be uuid");
  assert.equal(columns.id.nullable, "NO", "id should be NOT NULL");

  assert.ok(columns.email, "email column should exist");
  assert.equal(columns.email.type, "text", "email should be text");
  assert.equal(columns.email.nullable, "NO", "email should be NOT NULL");

  assert.ok(columns.password_hash, "password_hash column should exist");
  assert.equal(columns.password_hash.type, "text", "password_hash should be text");
  assert.equal(columns.password_hash.nullable, "NO", "password_hash should be NOT NULL");

  assert.ok(columns.full_name, "full_name column should exist");
  assert.equal(columns.full_name.type, "text", "full_name should be text");
  assert.equal(columns.full_name.nullable, "NO", "full_name should be NOT NULL");

  assert.ok(columns.otp_hash, "otp_hash column should exist");
  assert.equal(columns.otp_hash.type, "text", "otp_hash should be text");
  assert.equal(columns.otp_hash.nullable, "NO", "otp_hash should be NOT NULL");

  assert.ok(columns.otp_attempts, "otp_attempts column should exist");
  assert.equal(columns.otp_attempts.type, "integer", "otp_attempts should be integer");
  assert.equal(columns.otp_attempts.nullable, "NO", "otp_attempts should be NOT NULL");

  assert.ok(columns.otp_expires_at, "otp_expires_at column should exist");
  assert.equal(columns.otp_expires_at.type, "timestamp with time zone", "otp_expires_at should be timestamptz");
  assert.equal(columns.otp_expires_at.nullable, "NO", "otp_expires_at should be NOT NULL");

  assert.ok(columns.created_at, "created_at column should exist");
  assert.equal(columns.created_at.nullable, "NO", "created_at should be NOT NULL");

  assert.ok(columns.verified_at, "verified_at column should exist");
  assert.equal(columns.verified_at.nullable, "YES", "verified_at should be nullable");

  // Check unique constraint on email
  const idx = await db.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'pending_signups' AND indexname = 'pending_signups_email_key'
  `);
  assert.ok(idx.rows.length > 0, "Unique constraint on email should exist");

  // Check indexes
  const indexes = await db.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'pending_signups'
  `);
  const indexNames = indexes.rows.map((r) => r.indexname);
  assert.ok(indexNames.includes("idx_pending_signups_email"), "idx_pending_signups_email index should exist");
  assert.ok(indexNames.includes("idx_pending_signups_created_at"), "idx_pending_signups_created_at index should exist");
});

test("migrations: pending_signups RLS revoked from anon and authenticated", async () => {
  const result = await db.query(`
    SELECT grantee, privilege_type
    FROM information_schema.table_privileges
    WHERE table_schema = 'public' AND table_name = 'pending_signups'
  `);
  // Should have no grants to anon or authenticated
  const grantees = result.rows.map((r) => r.grantee);
  assert.ok(!grantees.includes("anon"), "anon should not have privileges on pending_signups");
  assert.ok(!grantees.includes("authenticated"), "authenticated should not have privileges on pending_signups");
});