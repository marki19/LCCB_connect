/**
 * Storage helpers for local object keys stored in PostgreSQL.
 *
 * Postgres stores the storage path (relative to the object's bucket), not the
 * full public URL. This service is the only place that knows how to turn a
 * stored key back into a URL the client can render.
 */
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const PUBLIC_OBJECT_ROOT = `${SUPABASE_URL}/storage/v1/object/public`;

/** Bucket each file column points into; used to expand the stored key. */
const FILE_FIELD_BUCKETS = {
  image_url: "assets",
  pdf_url: "theses",
  avatar_url: "assets",
};

/** True when a string already looks like an absolute URL. */
function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(value);
}

/**
 * Builds the public URL of a stored object.
 * @param {string} bucket Storage bucket (`assets` / `theses`).
 * @param {string} key Object path inside the bucket.
 * @returns {string|null} Public URL, or `null` when no key is available.
 */
function publicStorageUrl(bucket, key) {
  if (!key) return null;
  if (isAbsoluteUrl(key)) return key;
  return `${PUBLIC_OBJECT_ROOT}/${bucket}/${key}`;
}

/**
 * Recursively expands stored object keys into their public URLs.
 * Only the known file fields (`image_url`, `pdf_url`, `avatar_url`) are transformed.
 * Nested `author.avatar_url` is handled explicitly.
 * Other nested objects (like `metadata: Record<string, any>`) are passed through untouched
 * to avoid corrupting arbitrary JSON payloads.
 */
function withStorageUrls(value) {
  if (Array.isArray(value)) {
    return value.map((item) => withStorageUrls(item));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const output = { ...value };
    for (const [field, bucket] of Object.entries(FILE_FIELD_BUCKETS)) {
      if (typeof output[field] === "string" && !isAbsoluteUrl(output[field])) {
        output[field] = publicStorageUrl(bucket, output[field]);
      }
    }
    // Handle nested author.avatar_url for posts/users that embed author info.
    if (output.author && typeof output.author === "object") {
      if (typeof output.author.avatar_url === "string" && !isAbsoluteUrl(output.author.avatar_url)) {
        output.author.avatar_url = publicStorageUrl("assets", output.author.avatar_url);
      }
    }
    return output;
  }
  return value;
}

module.exports = {
  publicStorageUrl,
  withStorageUrls,
};
