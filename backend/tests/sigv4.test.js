/**
 * Signature v4 tests.
 *
 * These assert structure, determinism, and encoding rather than a hand-copied
 * golden signature: the authoritative check that the algorithm is correct is
 * the live smoke test in `scripts/check-storage.js`, which performs a real
 * PUT/GET/DELETE against the bucket. What matters here is that nothing drifts
 * silently — a wrong canonical ordering or an unescaped key segment changes
 * every URL and would break all reads at once.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const sigv4 = require("../services/sigv4");

const CREDS = {
  endpoint: "https://abc123.r2.cloudflarestorage.com",
  bucket: "lccb-connect",
  key: "posts/9f83ab24e10c71a39bd5.jpg",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "secret-example-key",
};

const FIXED_NOW = new Date("2026-11-15T13:45:00.000Z");

describe("sigv4.presignGet", () => {
  test("produces a complete presigned URL", () => {
    const url = sigv4.presignGet({ ...CREDS, expiresIn: 300, now: FIXED_NOW });
    const parsed = new URL(url);

    assert.equal(parsed.origin, CREDS.endpoint);
    assert.equal(parsed.pathname, `/lccb-connect/${CREDS.key}`);

    assert.equal(parsed.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
    assert.equal(
      parsed.searchParams.get("X-Amz-Credential"),
      "AKIDEXAMPLE/20261115/auto/s3/aws4_request"
    );
    assert.equal(parsed.searchParams.get("X-Amz-Date"), "20261115T134500Z");
    assert.equal(parsed.searchParams.get("X-Amz-Expires"), "300");
    assert.equal(parsed.searchParams.get("X-Amz-SignedHeaders"), "host");
    assert.match(parsed.searchParams.get("X-Amz-Signature"), /^[0-9a-f]{64}$/);
  });

  test("is deterministic for a fixed clock", () => {
    const a = sigv4.presignGet({ ...CREDS, expiresIn: 300, now: FIXED_NOW });
    const b = sigv4.presignGet({ ...CREDS, expiresIn: 300, now: FIXED_NOW });
    assert.equal(a, b);
  });

  test("changes signature when the clock advances", () => {
    const a = sigv4.presignGet({ ...CREDS, expiresIn: 300, now: FIXED_NOW });
    const later = new Date(FIXED_NOW.getTime() + 1000);
    const b = sigv4.presignGet({ ...CREDS, expiresIn: 300, now: later });
    assert.notEqual(new URL(a).searchParams.get("X-Amz-Signature"), new URL(b).searchParams.get("X-Amz-Signature"));
  });

  test("changes signature when the object key changes", () => {
    const a = sigv4.presignGet({ ...CREDS, expiresIn: 300, now: FIXED_NOW });
    const b = sigv4.presignGet({
      ...CREDS,
      key: "posts/00000000000000000000.jpg",
      expiresIn: 300,
      now: FIXED_NOW,
    });
    assert.notEqual(new URL(a).searchParams.get("X-Amz-Signature"), new URL(b).searchParams.get("X-Amz-Signature"));
  });

  test("clamps expiry into the range S3 accepts", () => {
    const low = new URL(sigv4.presignGet({ ...CREDS, expiresIn: 0, now: FIXED_NOW }));
    assert.equal(low.searchParams.get("X-Amz-Expires"), "1");

    const high = new URL(sigv4.presignGet({ ...CREDS, expiresIn: 999999, now: FIXED_NOW }));
    assert.equal(high.searchParams.get("X-Amz-Expires"), "604800");
  });

  test("preserves path separators but escapes everything else in the key", () => {
    const url = sigv4.presignGet({
      ...CREDS,
      key: "documents/a b+c(1).pdf",
      expiresIn: 300,
      now: FIXED_NOW,
    });
    const parsed = new URL(url);
    assert.equal(parsed.pathname, "/lccb-connect/documents/a%20b%2Bc%281%29.pdf");
  });
});

describe("sigv4.signPut", () => {
  const body = Buffer.from("%PDF-1.4 manuscript");

  test("signs the payload hash and the content type", () => {
    const { url, headers } = sigv4.signPut({
      ...CREDS,
      body,
      contentType: "application/pdf",
      now: FIXED_NOW,
    });

    assert.equal(url, `${CREDS.endpoint}/lccb-connect/${CREDS.key}`);
    assert.equal(headers["Content-Type"], "application/pdf");
    assert.equal(
      headers["x-amz-content-sha256"],
      require("crypto").createHash("sha256").update(body).digest("hex")
    );
    assert.equal(headers["x-amz-date"], "20261115T134500Z");
    assert.match(headers.Authorization, /^AWS4-HMAC-SHA256 Credential=/);
  });

  test("declares its signed headers in sorted order", () => {
    const { headers } = sigv4.signPut({
      ...CREDS,
      body,
      contentType: "application/pdf",
      now: FIXED_NOW,
    });

    const signedHeaders = /SignedHeaders=([^,]+)/.exec(headers.Authorization)[1];
    assert.equal(signedHeaders, "content-type;host;x-amz-content-sha256;x-amz-date");
  });

  test("a different body yields a different signature", () => {
    const a = sigv4.signPut({ ...CREDS, body, contentType: "application/pdf", now: FIXED_NOW });
    const b = sigv4.signPut({
      ...CREDS,
      body: Buffer.from("different"),
      contentType: "application/pdf",
      now: FIXED_NOW,
    });
    assert.notEqual(a.headers.Authorization, b.headers.Authorization);
  });
});

describe("sigv4.signDelete", () => {
  test("hashes the empty body", () => {
    const { headers } = sigv4.signDelete({ ...CREDS, now: FIXED_NOW });
    assert.equal(
      headers["x-amz-content-sha256"],
      require("crypto").createHash("sha256").update("").digest("hex")
    );
  });

  test("signs different bytes than the equivalent PUT", () => {
    const del = sigv4.signDelete({ ...CREDS, now: FIXED_NOW });
    const put = sigv4.signPut({
      ...CREDS,
      body: Buffer.alloc(0),
      contentType: "application/octet-stream",
      now: FIXED_NOW,
    });
    assert.notEqual(del.headers.Authorization, put.headers.Authorization);
  });
});
