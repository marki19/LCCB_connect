#!/usr/bin/env node
/**
 * Live round-trip against the configured object bucket.
 *
 * SigV4 is hand-rolled in `services/sigv4.js`, and a signature that is wrong in
 * any small way (header casing, canonical ordering, key escaping, region) fails
 * with an opaque `SignatureDoesNotMatch`. Unit tests cannot catch that — they
 * assert structure, not acceptance. This script is the check that the provider
 * actually honours what we sign.
 *
 * It uploads one small object under `diagnostics/`, reads it back through a
 * presigned URL, compares the bytes, deletes it, and confirms the presigned URL
 * now 404s. Nothing else in the bucket is touched.
 *
 * Usage:
 *   node scripts/check-storage.js
 *
 * Exit codes: 0 = every step passed, 1 = a step failed, 2 = not configured.
 */

const path = require("path");
const crypto = require("crypto");

require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const objectStorage = require("../services/objectStorage");

const KEY = `diagnostics/smoke-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.txt`;

function step(name) {
  process.stdout.write(`  ${name} … `);
}

function ok(detail = "") {
  console.log(detail ? `ok (${detail})` : "ok");
}

function fail(detail) {
  console.log("FAILED");
  console.error(`\n  ${detail}\n`);
  process.exit(1);
}

async function main() {
  const config = objectStorage.readConfig();

  if (!config) {
    console.error(
      "Object storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,\n" +
        "R2_SECRET_ACCESS_KEY, and R2_BUCKET in backend/.env."
    );
    process.exit(2);
  }

  const body = Buffer.from(`lccb-connect storage smoke test ${new Date().toISOString()}\n`);
  const expected = crypto.createHash("sha256").update(body).digest("hex");

  console.log(`\nBucket: ${config.bucket}`);
  console.log(`Endpoint: ${config.endpoint}`);
  console.log(`Key: ${KEY}\n`);

  step("PUT object");
  try {
    await objectStorage.putObject({
      key: KEY,
      body,
      contentType: "text/plain",
    });
    ok(`${body.length} bytes`);
  } catch (err) {
    fail(`${err.name}: ${err.message}`);
  }

  step("GET via presigned URL");
  let presigned;
  try {
    presigned = objectStorage.presignGet(KEY, 60);
    const response = await fetch(presigned);

    if (!response.ok) {
      fail(`HTTP ${response.status} — ${(await response.text()).slice(0, 300)}`);
    }

    const received = Buffer.from(await response.arrayBuffer());
    const actual = crypto.createHash("sha256").update(received).digest("hex");

    if (actual !== expected) {
      fail(`byte mismatch: sent ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…`);
    }

    ok("bytes match");
  } catch (err) {
    fail(`${err.name}: ${err.message}`);
  }

  step("DELETE object");
  try {
    await objectStorage.deleteObject(KEY);
    ok();
  } catch (err) {
    fail(`${err.name}: ${err.message}`);
  }

  step("GET after delete is refused");
  try {
    const response = await fetch(objectStorage.presignGet(KEY, 60));
    if (response.status !== 404) {
      fail(`expected 404, got ${response.status}`);
    }
    ok("404");
  } catch (err) {
    fail(`${err.name}: ${err.message}`);
  }

  console.log("\nStorage is working end to end.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
