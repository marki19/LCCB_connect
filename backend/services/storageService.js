/**
 * Storage helpers for local object keys stored in PostgreSQL.
 *
 * Postgres stores the storage path (relative to the object's bucket), not the
 * full URL. This service is the only place that knows how to turn a stored key
 * back into something a client can render.
 *
 * Buckets (migration 015):
 *   avatars  — public. Profile pictures render to guests with no plumbing
 *              changes, so they keep their plain public URL.
 *   assets   — private. Post images; resolved through the backend.
 *   theses   — private. Manuscripts; resolved through the backend after a
 *              visibility check, never handed out directly.
 */

const { getSupabaseAdmin, AdminAuthUnavailableError } = require("./supabaseAdmin");

/**
 * Injectable admin-client factory. Tests swap this out so the async URL
 * resolver never touches the network; production uses the real service-role
 * client.
 */
let getAdmin = () => getSupabaseAdmin();
function __setAdminFactory(fn) {
  getAdmin = fn;
}

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const PUBLIC_OBJECT_ROOT = `${SUPABASE_URL}/storage/v1/object/public`;

/** Default signed-URL expiry, in seconds. */
const DEFAULT_SIGNED_URL_EXPIRES = 300;

/** Bucket each file column points into; used to expand the stored key. */
const FILE_FIELD_BUCKETS = {
  image_url: "assets",
  pdf_url: "theses",
  avatar_url: "avatars",
};

/** Buckets whose objects are readable by anonymous visitors. */
const PUBLIC_BUCKETS = new Set(["avatars"]);

/** True when a string already looks like an absolute URL. */
function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(value);
}

/**
 * Builds the public URL of a stored object.
 * @param {string} bucket Storage bucket (`avatars` / `assets` / `theses`).
 * @param {string} key Object path inside the bucket.
 * @returns {string|null} Public URL, or `null` when no key is available.
 */
function publicStorageUrl(bucket, key) {
  if (!key) return null;
  if (isAbsoluteUrl(key)) return key;
  return `${PUBLIC_OBJECT_ROOT}/${bucket}/${key}`;
}

/**
 * Issues a short-lived signed URL for a private object.
 *
 * `avatars` is public, so callers asking for one get the plain URL instead —
 * that path never touches Supabase and stays cheap.
 *
 * @param {string} bucket
 * @param {string} key
 * @param {object} [opts]
 * @param {number} [opts.expiresIn] Signed-URL TTL in seconds (default 300).
 * @returns {Promise<{ url: string | null; error?: string }>}
 */
async function signedStorageUrl(bucket, key, { expiresIn = DEFAULT_SIGNED_URL_EXPIRES } = {}) {
  if (!key) return { url: null };
  if (PUBLIC_BUCKETS.has(bucket)) return { url: publicStorageUrl(bucket, key) };

  let admin;
  try {
    admin = getAdmin();
  } catch (err) {
    if (err instanceof AdminAuthUnavailableError) {
      return { url: null, error: "Storage is not configured" };
    }
    throw err;
  }

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(key, expiresIn);

  if (error || !data?.signedUrl) {
    return { url: null, error: error?.message || "Could not sign storage URL" };
  }

  return { url: data.signedUrl };
}

/**
 * Resolves a stored key into a URL the client can use, choosing the public or
 * signed path based on the bucket.
 * @param {string} bucket
 * @param {string} key
 * @returns {Promise<string | null>}
 */
async function resolveStorageUrl(bucket, key) {
  if (!key) return null;
  if (PUBLIC_BUCKETS.has(bucket)) return publicStorageUrl(bucket, key);
  const { url } = await signedStorageUrl(bucket, key);
  return url;
}

/**
 * Synchronous expansion pass. Public buckets (`avatars`) are expanded inline;
 * private buckets (`assets`, `theses`) keep their raw key so the client can
 * ask the backend for a signed URL. Used by `withStorageUrlsSync`.
 */
function withStorageUrlsSync(value) {
  if (Array.isArray(value)) {
    return value.map((item) => withStorageUrlsSync(item));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const output = { ...value };
    for (const [field, bucket] of Object.entries(FILE_FIELD_BUCKETS)) {
      if (typeof output[field] === "string" && !isAbsoluteUrl(output[field])) {
        if (PUBLIC_BUCKETS.has(bucket)) {
          output[field] = publicStorageUrl(bucket, output[field]);
        }
        // Private buckets keep the raw key.
      }
    }
    if (Array.isArray(output.image_urls)) {
      output.image_urls = output.image_urls.map((key) => {
        if (typeof key === "string" && !isAbsoluteUrl(key) && PUBLIC_BUCKETS.has("assets")) {
          return publicStorageUrl("assets", key);
        }
        return key;
      });
    }
    if (output.author && typeof output.author === "object") {
      if (typeof output.author.avatar_url === "string" && !isAbsoluteUrl(output.author.avatar_url)) {
        output.author.avatar_url = publicStorageUrl("avatars", output.author.avatar_url);
      }
    }
    return output;
  }
  return value;
}

/**
 * Asynchronous expansion pass. Resolves every stored key into a URL the client
 * can render, issuing signed URLs for private buckets. Used by the response
 * middleware, which is the only place that may touch Supabase.
 *
 * @returns {Promise<any>}
 */
async function withStorageUrls(value) {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => withStorageUrls(item)));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const output = { ...value };
    const pending = [];
    for (const [field, bucket] of Object.entries(FILE_FIELD_BUCKETS)) {
      if (typeof output[field] === "string" && !isAbsoluteUrl(output[field])) {
        if (PUBLIC_BUCKETS.has(bucket)) {
          output[field] = publicStorageUrl(bucket, output[field]);
        } else {
          pending.push(
            resolveStorageUrl(bucket, output[field]).then((url) => {
              output[field] = url;
            })
          );
        }
      }
    }
    if (Array.isArray(output.image_urls)) {
      output.image_urls = [...output.image_urls];
      output.image_urls.forEach((key, idx) => {
        if (typeof key === "string" && !isAbsoluteUrl(key)) {
          if (PUBLIC_BUCKETS.has("assets")) {
            output.image_urls[idx] = publicStorageUrl("assets", key);
          } else {
            pending.push(
              resolveStorageUrl("assets", key).then((url) => {
                output.image_urls[idx] = url;
              })
            );
          }
        }
      });
    }
    if (output.author && typeof output.author === "object") {
      if (typeof output.author.avatar_url === "string" && !isAbsoluteUrl(output.author.avatar_url)) {
        output.author.avatar_url = publicStorageUrl("avatars", output.author.avatar_url);
      }
    }
    await Promise.all(pending);
    return output;
  }
  return value;
}

module.exports = {
  publicStorageUrl,
  signedStorageUrl,
  resolveStorageUrl,
  withStorageUrls,
  withStorageUrlsSync,
  FILE_FIELD_BUCKETS,
  PUBLIC_BUCKETS,
  DEFAULT_SIGNED_URL_EXPIRES,
  __setAdminFactory,
};