/**
 * Object storage backed by Cloudflare R2 (S3-compatible API).
 *
 * This module is the only place that knows files live in a bucket rather than
 * on disk. Callers deal in opaque keys of the form `<category>/<filename>`,
 * which is exactly what PostgreSQL stores.
 *
 * Reads are presigned rather than proxied: the backend authorises the request,
 * hands back a short-lived URL, and the bytes flow from R2 straight to the
 * client. That keeps file traffic off the API instance and costs nothing,
 * because R2 does not charge for egress.
 */

const sigv4 = require("./sigv4");

/** Default lifetime for a presigned read URL, in seconds. */
const DEFAULT_URL_TTL_SECONDS = 300;

/** Upload timeout. Generous enough for a 50 MB manuscript on a slow link. */
const UPLOAD_TIMEOUT_MS = 60_000;

class StorageNotConfiguredError extends Error {
  constructor() {
    super("Object storage is not configured");
    this.name = "StorageNotConfiguredError";
  }
}

class StorageRequestError extends Error {
  constructor(message, { status, key } = {}) {
    super(message);
    this.name = "StorageRequestError";
    this.status = status;
    this.key = key;
  }
}

function readConfig() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return {
    endpoint: (
      process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`
    ).replace(/\/+$/, ""),
    bucket,
    accessKeyId,
    secretAccessKey,
  };
}

/** True when every credential needed to talk to R2 is present. */
function isConfigured() {
  return readConfig() !== null;
}

function config() {
  const cfg = readConfig();
  if (!cfg) throw new StorageNotConfiguredError();
  return cfg;
}

/**
 * Uploads an object.
 *
 * @param {object} opts
 * @param {string} opts.key          `<category>/<filename>`
 * @param {Buffer} opts.body
 * @param {string} opts.contentType  Validated MIME type; sent as object metadata
 *                                   so browsers render rather than download.
 * @returns {Promise<void>}
 */
async function putObject({ key, body, contentType, cacheControl }) {
  const cfg = config();

  const { url, headers } = sigv4.signPut({
    endpoint: cfg.endpoint,
    bucket: cfg.bucket,
    key,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    body,
    contentType,
    cacheControl,
  });

  let response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers,
      body,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
  } catch (err) {
    throw new StorageRequestError(`Upload failed: ${err.message}`, { key });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new StorageRequestError(
      `Upload rejected by storage (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      { status: response.status, key }
    );
  }
}

/**
 * Issues a presigned read URL for an object.
 *
 * Signing is local, so this never fails on network errors and never blocks.
 *
 * @param {string} key
 * @param {number} [expiresIn] Seconds until the link stops working.
 * @returns {string}
 */
function presignGet(key, expiresIn = DEFAULT_URL_TTL_SECONDS) {
  const cfg = config();

  return sigv4.presignGet({
    endpoint: cfg.endpoint,
    bucket: cfg.bucket,
    key,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    expiresIn,
  });
}

/**
 * Deletes an object. Deleting a missing key succeeds, matching S3 semantics.
 *
 * @param {string} key
 * @returns {Promise<void>}
 */
async function deleteObject(key) {
  const cfg = config();

  const { url, headers } = sigv4.signDelete({
    endpoint: cfg.endpoint,
    bucket: cfg.bucket,
    key,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
  });

  let response;
  try {
    response = await fetch(url, {
      method: "DELETE",
      headers,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
  } catch (err) {
    throw new StorageRequestError(`Delete failed: ${err.message}`, { key });
  }

  if (!response.ok && response.status !== 404) {
    throw new StorageRequestError(`Delete rejected by storage (${response.status})`, {
      status: response.status,
      key,
    });
  }
}

module.exports = {
  isConfigured,
  putObject,
  presignGet,
  deleteObject,
  readConfig,
  DEFAULT_URL_TTL_SECONDS,
  StorageNotConfiguredError,
  StorageRequestError,
};
