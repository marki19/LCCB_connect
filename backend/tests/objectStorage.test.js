/**
 * Object storage transport tests.
 *
 * The network is replaced with a local stub: what is under test is the request
 * this module builds (method, URL, signed headers, body) and how it maps
 * provider responses onto errors. Real connectivity is covered by
 * `scripts/check-storage.js`.
 */

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const objectStorage = require("../services/objectStorage");

const ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_ENDPOINT",
];

let savedEnv;
let originalFetch;
let calls;

function configure(overrides = {}) {
  process.env.R2_ACCOUNT_ID = "abc123";
  process.env.R2_ACCESS_KEY_ID = "AKIDEXAMPLE";
  process.env.R2_SECRET_ACCESS_KEY = "secret-example-key";
  process.env.R2_BUCKET = "lccb-connect";
  delete process.env.R2_ENDPOINT;
  Object.assign(process.env, overrides);
}

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  originalFetch = global.fetch;
  calls = [];

  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, text: async () => "" };
  };

  configure();
});

afterEach(() => {
  global.fetch = originalFetch;
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("objectStorage configuration", () => {
  test("reports configured only when every credential is present", () => {
    assert.equal(objectStorage.isConfigured(), true);

    delete process.env.R2_SECRET_ACCESS_KEY;
    assert.equal(objectStorage.isConfigured(), false);

    configure();
    delete process.env.R2_BUCKET;
    assert.equal(objectStorage.isConfigured(), false);
  });

  test("derives the endpoint from the account id", () => {
    assert.equal(
      objectStorage.readConfig().endpoint,
      "https://abc123.r2.cloudflarestorage.com"
    );
  });

  test("honours an explicit endpoint override", () => {
    configure({ R2_ENDPOINT: "http://127.0.0.1:9000/" });
    assert.equal(objectStorage.readConfig().endpoint, "http://127.0.0.1:9000");
  });
});

describe("objectStorage.putObject", () => {
  test("sends a signed PUT with the body and content type", async () => {
    const body = Buffer.from("%PDF-1.4 manuscript");

    await objectStorage.putObject({
      key: "theses/abc.pdf",
      body,
      contentType: "application/pdf",
    });

    assert.equal(calls.length, 1);
    const [{ url, init }] = calls;

    assert.equal(url, "https://abc123.r2.cloudflarestorage.com/lccb-connect/theses/abc.pdf");
    assert.equal(init.method, "PUT");
    assert.equal(init.body, body);
    assert.equal(init.headers["Content-Type"], "application/pdf");
    assert.match(init.headers.Authorization, /^AWS4-HMAC-SHA256 /);
  });

  test("throws StorageNotConfiguredError when credentials are missing", async () => {
    delete process.env.R2_ACCESS_KEY_ID;

    await assert.rejects(
      () =>
        objectStorage.putObject({
          key: "theses/abc.pdf",
          body: Buffer.from("x"),
          contentType: "application/pdf",
        }),
      objectStorage.StorageNotConfiguredError
    );

    assert.equal(calls.length, 0);
  });

  test("surfaces provider rejections as StorageRequestError", async () => {
    global.fetch = async () => ({
      ok: false,
      status: 403,
      text: async () => "<Error><Code>SignatureDoesNotMatch</Code></Error>",
    });

    await assert.rejects(
      () =>
        objectStorage.putObject({
          key: "theses/abc.pdf",
          body: Buffer.from("x"),
          contentType: "application/pdf",
        }),
      (err) => {
        assert.equal(err.name, "StorageRequestError");
        assert.equal(err.status, 403);
        assert.match(err.message, /SignatureDoesNotMatch/);
        return true;
      }
    );
  });

  test("wraps network failures", async () => {
    global.fetch = async () => {
      throw new Error("ECONNREFUSED");
    };

    await assert.rejects(
      () =>
        objectStorage.putObject({
          key: "theses/abc.pdf",
          body: Buffer.from("x"),
          contentType: "application/pdf",
        }),
      /Upload failed: ECONNREFUSED/
    );
  });
});

describe("objectStorage.presignGet", () => {
  test("signs locally without touching the network", () => {
    const url = objectStorage.presignGet("posts/abc.jpg", 300);

    assert.equal(calls.length, 0);
    assert.match(url, /^https:\/\/abc123\.r2\.cloudflarestorage\.com\/lccb-connect\/posts\/abc\.jpg\?/);
    assert.match(url, /X-Amz-Signature=[0-9a-f]{64}/);
  });

  test("defaults to a five minute lifetime", () => {
    const url = objectStorage.presignGet("posts/abc.jpg");
    assert.equal(new URL(url).searchParams.get("X-Amz-Expires"), "300");
  });
});

describe("objectStorage.deleteObject", () => {
  test("sends a signed DELETE", async () => {
    await objectStorage.deleteObject("theses/abc.pdf");

    const [{ url, init }] = calls;
    assert.equal(url, "https://abc123.r2.cloudflarestorage.com/lccb-connect/theses/abc.pdf");
    assert.equal(init.method, "DELETE");
    assert.match(init.headers.Authorization, /^AWS4-HMAC-SHA256 /);
  });

  test("treats a missing object as already deleted", async () => {
    global.fetch = async () => ({ ok: false, status: 404, text: async () => "" });

    await assert.doesNotReject(() => objectStorage.deleteObject("theses/gone.pdf"));
  });

  test("raises other failures", async () => {
    global.fetch = async () => ({ ok: false, status: 500, text: async () => "" });

    await assert.rejects(
      () => objectStorage.deleteObject("theses/abc.pdf"),
      /Delete rejected by storage \(500\)/
    );
  });
});
