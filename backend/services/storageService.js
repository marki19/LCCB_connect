/**
 * Turns stored file keys into URLs a client can render.
 *
 * PostgreSQL records an opaque key (`<category>/<filename>`), never a URL, so
 * the bucket can change without a data migration. This service is the only
 * place that knows how to expand a key.
 *
 * Signing is a local HMAC, not a network call, so expansion is synchronous and
 * cannot fail on a storage outage. That is why there is no cache here: an
 * in-process cache would cost more bookkeeping than the signature it saves.
 */

const objectStorage = require("./objectStorage");
const { isCategory, isPublicCategory } = require("./filePolicy");

/** Default presigned-URL lifetime, in seconds. */
const DEFAULT_SIGNED_URL_EXPIRES = 300;

/**
 * Which bucket each file column points into. The bucket name selects the key
 * prefix, so legacy column names (`assets`) keep working.
 */
const FILE_FIELD_BUCKETS = {
  image_url: "assets",
  pdf_url: "theses",
  avatar_url: "avatars",
  video_url: "videos",
  cover_url: "covers",
};

/** Bucket name → key prefix. `assets` is the legacy name for post images. */
const BUCKET_CATEGORY = {
  avatars: "avatars",
  assets: "posts",
  posts: "posts",
  theses: "theses",
  documents: "documents",
  videos: "videos",
  covers: "covers",
};

/**
 * Injectable signer. Tests replace it so expansion never needs credentials.
 * @type {(key: string, expiresIn: number) => string}
 */
let sign = (key, expiresIn) => objectStorage.presignGet(key, expiresIn);

function __setSigner(fn) {
  sign = fn;
}

function __resetSigner() {
  sign = (key, expiresIn) => objectStorage.presignGet(key, expiresIn);
}

/** True when a string is already a URL a client can use as-is. */
function isAbsoluteUrl(value) {
  return /^(https?:|data:|blob:|file:)/i.test(value);
}

/**
 * Normalises a stored value into a `<category>/<filename>` object key.
 *
 * Tolerates three historical shapes: a bare filename, a key already prefixed
 * with its category, and the old `uploads/` prefix from local-disk days.
 *
 * @param {string} bucket
 * @param {string} key
 * @returns {string}
 */
function objectKey(bucket, key) {
  const rest = String(key).replace(/^\/+/, "").replace(/^uploads\//, "");
  const first = rest.split("/")[0];

  if (isCategory(first)) {
    return rest;
  }

  return `${BUCKET_CATEGORY[bucket] || "posts"}/${rest}`;
}

/**
 * Presigns a stored key.
 * @returns {string|null} `null` when the key is empty or storage is unconfigured.
 */
function signKey(bucket, key, expiresIn = DEFAULT_SIGNED_URL_EXPIRES) {
  if (!key || typeof key !== "string") return null;
  if (isAbsoluteUrl(key)) return key;

  try {
    return sign(objectKey(bucket, key), expiresIn);
  } catch {
    // Unconfigured or malformed credentials: hand back the key rather than
    // failing the whole response. The client will show a broken image, which
    // is a better outcome than an empty feed.
    return key;
  }
}

/**
 * Presigns a single stored key.
 *
 * @param {string} bucket
 * @param {string} key
 * @param {object} [opts]
 * @param {number} [opts.expiresIn]
 * @returns {Promise<{ url: string | null; error?: string }>}
 */
async function signedStorageUrl(bucket, key, { expiresIn = DEFAULT_SIGNED_URL_EXPIRES } = {}) {
  if (!key) return { url: null };

  try {
    return { url: signKey(bucket, key, expiresIn) };
  } catch (err) {
    return { url: null, error: err.message };
  }
}

/**
 * Convenience wrapper returning just the URL.
 * @returns {Promise<string | null>}
 */
async function resolveStorageUrl(bucket, key) {
  const { url } = await signedStorageUrl(bucket, key);
  return url;
}

/**
 * Kept for callers that expand a single key synchronously.
 * @returns {string|null}
 */
function publicStorageUrl(bucket, key) {
  return signKey(bucket, key);
}

function resolveFieldForSerialization(bucket, rawValue) {
  if (!rawValue || typeof rawValue !== "string" || isAbsoluteUrl(rawValue)) {
    return rawValue;
  }
  const category = BUCKET_CATEGORY[bucket] || bucket;
  if (isPublicCategory(category)) {
    return objectKey(bucket, rawValue);
  }
  return signKey(bucket, rawValue);
}

/**
 * Expands every recognised file field in a value, recursively.
 *
 * Invariant: never throws. Keys that cannot be signed are returned untouched.
 */
function expand(value) {
  if (value instanceof Date) return value;

  if (Array.isArray(value)) {
    return value.map((item) => expand(item));
  }

  if (value && typeof value === "object") {
    const output = { ...value };

    for (const [field, bucket] of Object.entries(FILE_FIELD_BUCKETS)) {
      if (typeof output[field] === "string" && !isAbsoluteUrl(output[field])) {
        output[field] = resolveFieldForSerialization(bucket, output[field]);
      }
    }

    if (Array.isArray(output.image_urls)) {
      output.image_urls = output.image_urls.map((key) =>
        typeof key === "string" && !isAbsoluteUrl(key)
          ? resolveFieldForSerialization("assets", key)
          : key
      );
    }

    if (output.author && typeof output.author === "object" && !(output.author instanceof Date)) {
      output.author = expand(output.author);
    }

    for (const [key, nested] of Object.entries(output)) {
      if (
        nested &&
        typeof nested === "object" &&
        !(nested instanceof Date) &&
        key !== "image_urls" &&
        key !== "author"
      ) {
        output[key] = expand(nested);
      }
    }

    return output;
  }

  return value;
}

/**
 * Asynchronous expansion, awaited by the response-serialisation middleware.
 * @returns {Promise<any>}
 */
async function withStorageUrls(value) {
  try {
    return expand(value);
  } catch {
    return value;
  }
}

/** Synchronous variant, for callers that build a response by hand. */
function withStorageUrlsSync(value) {
  try {
    return expand(value);
  } catch {
    return value;
  }
}

module.exports = {
  isAbsoluteUrl,
  objectKey,
  publicStorageUrl,
  signedStorageUrl,
  resolveStorageUrl,
  withStorageUrls,
  withStorageUrlsSync,
  FILE_FIELD_BUCKETS,
  BUCKET_CATEGORY,
  DEFAULT_SIGNED_URL_EXPIRES,
  __setSigner,
  __resetSigner,
};
