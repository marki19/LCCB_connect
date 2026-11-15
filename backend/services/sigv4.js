/**
 * Minimal AWS Signature Version 4 implementation for S3-compatible storage.
 *
 * Only the two shapes this application needs are provided:
 *   - `presignGet`     — query-string signing for browser/app GETs
 *   - `signPut`        — header signing for object uploads
 *
 * Signing is pure computation over `crypto`, so both functions are
 * synchronous and never touch the network. That matters for the read path:
 * `storageService` expands file keys into URLs on every response, and a
 * local HMAC is orders of magnitude cheaper than a round-trip to the storage
 * provider (which is what the previous Supabase implementation required).
 */

const crypto = require("crypto");

const ALGORITHM = "AWS4-HMAC-SHA256";
const SERVICE = "s3";
/** S3-compatible stores are region-agnostic; `auto` is the documented value. */
const REGION = "auto";

/** RFC 3986 encoding. `encodeURIComponent` leaves !'()* unescaped. */
function rfc3986(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/** Encodes an object key into a canonical URI path, preserving `/` separators. */
function encodeKeyPath(key) {
  return key
    .split("/")
    .map((segment) => rfc3986(segment))
    .join("/");
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmac(key, value) {
  return crypto.createHmac("sha256", key).update(value).digest();
}

/** `20261115T134500Z` plus its `20261115` date stamp. */
function amzDateParts(now = new Date()) {
  const iso = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function signingKey(secretAccessKey, dateStamp) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
}

function stringToSign(amzDate, dateStamp, canonicalRequest) {
  return [
    ALGORITHM,
    amzDate,
    `${dateStamp}/${REGION}/${SERVICE}/aws4_request`,
    sha256Hex(canonicalRequest),
  ].join("\n");
}

/**
 * Builds the canonical query string: parameters sorted by encoded name, each
 * name and value RFC 3986 encoded, joined with `&`.
 */
function canonicalQuery(params) {
  return Object.keys(params)
    .sort()
    .map((name) => `${rfc3986(name)}=${rfc3986(String(params[name]))}`)
    .join("&");
}

/**
 * Creates a presigned GET URL.
 *
 * @param {object} opts
 * @param {string} opts.endpoint   Origin, e.g. `https://acc.r2.cloudflarestorage.com`
 * @param {string} opts.bucket
 * @param {string} opts.key        Object key, e.g. `posts/abc.jpg`
 * @param {string} opts.accessKeyId
 * @param {string} opts.secretAccessKey
 * @param {number} opts.expiresIn  Link lifetime in seconds.
 * @param {Date}   [opts.now]      Injectable clock (tests).
 * @returns {string} Absolute URL including the signature.
 */
function presignGet({
  endpoint,
  bucket,
  key,
  accessKeyId,
  secretAccessKey,
  expiresIn,
  now = new Date(),
}) {
  const { amzDate, dateStamp } = amzDateParts(now);
  const host = new URL(endpoint).host;
  const canonicalUri = `/${rfc3986(bucket)}/${encodeKeyPath(key)}`;

  const query = {
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${accessKeyId}/${dateStamp}/${REGION}/${SERVICE}/aws4_request`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(Math.max(1, Math.min(expiresIn, 604800))),
    "X-Amz-SignedHeaders": "host",
  };

  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQuery(query),
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const signature = crypto
    .createHmac("sha256", signingKey(secretAccessKey, dateStamp))
    .update(stringToSign(amzDate, dateStamp, canonicalRequest))
    .digest("hex");

  return `${endpoint}${canonicalUri}?${canonicalQuery(query)}&X-Amz-Signature=${signature}`;
}

/**
 * Signs a request whose body is sent as-is, returning the headers to attach.
 *
 * @param {object} opts
 * @param {string} opts.method
 * @param {string} opts.endpoint
 * @param {string} opts.bucket
 * @param {string} opts.key
 * @param {string} opts.accessKeyId
 * @param {string} opts.secretAccessKey
 * @param {string} opts.payloadHash  Hex SHA-256 of the body.
 * @param {Record<string,string>} [opts.extraHeaders] Additional headers to sign.
 * @param {Date} [opts.now]
 * @returns {{ url: string, headers: Record<string,string> }}
 */
function signRequest({
  method,
  endpoint,
  bucket,
  key,
  accessKeyId,
  secretAccessKey,
  payloadHash,
  extraHeaders = {},
  now = new Date(),
}) {
  const { amzDate, dateStamp } = amzDateParts(now);
  const host = new URL(endpoint).host;
  const canonicalUri = `/${rfc3986(bucket)}/${encodeKeyPath(key)}`;

  // Signed header names must be lowercase and sorted for the canonical request.
  const signed = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  for (const [name, value] of Object.entries(extraHeaders)) {
    signed[name.toLowerCase()] = value;
  }

  const names = Object.keys(signed).sort();
  const canonicalHeaders = names.map((name) => `${name}:${signed[name]}\n`).join("");
  const signedHeaders = names.join(";");

  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const signature = crypto
    .createHmac("sha256", signingKey(secretAccessKey, dateStamp))
    .update(stringToSign(amzDate, dateStamp, canonicalRequest))
    .digest("hex");

  const headers = {
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    Authorization:
      `${ALGORITHM} Credential=${accessKeyId}/${dateStamp}/${REGION}/${SERVICE}/aws4_request, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };

  // Echo the extra headers back with their original casing for the caller.
  for (const [name, value] of Object.entries(extraHeaders)) {
    headers[name] = value;
  }

  return { url: `${endpoint}${canonicalUri}`, headers };
}

/**
 * Signs a PUT, returning the URL and headers to send with the body.
 *
 * @param {object} opts
 * @param {string} opts.endpoint
 * @param {string} opts.bucket
 * @param {string} opts.key
 * @param {string} opts.accessKeyId
 * @param {string} opts.secretAccessKey
 * @param {Buffer} opts.body
 * @param {string} opts.contentType
 * @param {Date}   [opts.now]
 * @returns {{ url: string, headers: Record<string,string> }}
 */
function signPut({ body, contentType, ...rest }) {
  return signRequest({
    ...rest,
    method: "PUT",
    payloadHash: sha256Hex(body),
    extraHeaders: { "Content-Type": contentType },
  });
}

/**
 * Signs a DELETE. The body is empty, so the payload hash is the digest of the
 * empty string.
 *
 * @param {object} opts
 * @returns {{ url: string, headers: Record<string,string> }}
 */
function signDelete(opts) {
  return signRequest({ ...opts, method: "DELETE", payloadHash: sha256Hex("") });
}

module.exports = {
  presignGet,
  signPut,
  signDelete,
  REGION,
  ALGORITHM,
};
