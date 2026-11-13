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
 * In-memory LRU cache for signed storage URLs.
 * Key: `${bucket}:${key}` -> { url: string, expiresAt: number }
 */
const MAX_CACHE_SIZE = 1000;
const urlCache = new Map();

function __clearStorageCache() {
  urlCache.clear();
}

function getCachedUrl(bucket, key) {
  const cacheKey = `${bucket}:${key}`;
  const entry = urlCache.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    urlCache.delete(cacheKey);
    return null;
  }
  // Refresh recency
  urlCache.delete(cacheKey);
  urlCache.set(cacheKey, entry);
  return entry.url;
}

function setCachedUrl(bucket, key, url, ttlMs) {
  const cacheKey = `${bucket}:${key}`;
  if (urlCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = urlCache.keys().next().value;
    if (oldestKey) urlCache.delete(oldestKey);
  }
  urlCache.set(cacheKey, {
    url,
    expiresAt: Date.now() + ttlMs,
  });
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

  const cached = getCachedUrl(bucket, key);
  if (cached) return { url: cached };

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

  const ttlMs = Math.max((expiresIn - 60) * 1000, 1000);
  setCachedUrl(bucket, key, data.signedUrl, ttlMs);
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
 * Signs a batch of keys in a single bucket with a 3000ms timeout guard.
 * Returns a Map of `key -> signedUrl`.
 * Invariant: NEVER throws. On error or timeout, unresolvable keys return raw keys.
 */
async function bulkSignBucket(bucket, keys, { expiresIn = DEFAULT_SIGNED_URL_EXPIRES } = {}) {
  const resultMap = new Map();
  if (!keys || keys.length === 0) return resultMap;

  if (PUBLIC_BUCKETS.has(bucket)) {
    for (const key of keys) {
      resultMap.set(key, publicStorageUrl(bucket, key));
    }
    return resultMap;
  }

  // Check cache first
  const uncached = [];
  for (const key of keys) {
    const cached = getCachedUrl(bucket, key);
    if (cached) {
      resultMap.set(key, cached);
    } else {
      uncached.push(key);
    }
  }

  if (uncached.length === 0) return resultMap;

  let admin;
  try {
    admin = getAdmin();
  } catch {
    for (const key of uncached) resultMap.set(key, key);
    return resultMap;
  }

  const BATCH_SIZE = 100;
  const ttlMs = Math.max((expiresIn - 60) * 1000, 1000);

  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const chunk = uncached.slice(i, i + BATCH_SIZE);
    try {
      const signPromise = (async () => {
        const fromBucket = admin.storage.from(bucket);
        if (typeof fromBucket.createSignedUrls === "function") {
          return await fromBucket.createSignedUrls(chunk, expiresIn);
        }
        // Fallback for stubs or clients without createSignedUrls
        if (typeof fromBucket.createSignedUrl === "function") {
          const results = await Promise.all(
            chunk.map(async (k) => {
              try {
                const res = await fromBucket.createSignedUrl(k, expiresIn);
                return { path: k, signedUrl: res.data?.signedUrl || null, error: res.error };
              } catch (e) {
                return { path: k, signedUrl: null, error: e };
              }
            })
          );
          return { data: results, error: null };
        }
        return { data: null, error: new Error("createSignedUrls unavailable") };
      })();

      const timeoutPromise = new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error("Storage signing timed out")), 3000);
        if (typeof timer.unref === "function") timer.unref();
      });

      const { data, error } = await Promise.race([signPromise, timeoutPromise]);

      if (error || !Array.isArray(data)) {
        for (const k of chunk) resultMap.set(k, k);
        continue;
      }

      for (const item of data) {
        const path = item.path || item.error?.path;
        if (path && item.signedUrl && !item.error) {
          resultMap.set(path, item.signedUrl);
          setCachedUrl(bucket, path, item.signedUrl, ttlMs);
        } else if (path) {
          resultMap.set(path, path);
        }
      }

      for (const k of chunk) {
        if (!resultMap.has(k)) resultMap.set(k, k);
      }
    } catch {
      // Timeout or network rejection: return raw keys to unblock response
      for (const k of chunk) resultMap.set(k, k);
    }
  }

  return resultMap;
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
      }
    }
    if (Array.isArray(output.image_urls)) {
      output.image_urls = output.image_urls.map((key) => key);
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

function collectStorageKeys(value, bucketKeys) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectStorageKeys(item, bucketKeys);
    return;
  }
  if (typeof value === "object") {
    for (const [field, bucket] of Object.entries(FILE_FIELD_BUCKETS)) {
      if (typeof value[field] === "string" && !isAbsoluteUrl(value[field])) {
        if (!PUBLIC_BUCKETS.has(bucket)) {
          if (!bucketKeys.has(bucket)) bucketKeys.set(bucket, new Set());
          bucketKeys.get(bucket).add(value[field]);
        }
      }
    }
    if (Array.isArray(value.image_urls)) {
      for (const key of value.image_urls) {
        if (typeof key === "string" && !isAbsoluteUrl(key)) {
          if (!bucketKeys.has("assets")) bucketKeys.set("assets", new Set());
          bucketKeys.get("assets").add(key);
        }
      }
    }
    for (const [k, v] of Object.entries(value)) {
      if (v && typeof v === "object" && k !== "image_urls") {
        collectStorageKeys(v, bucketKeys);
      }
    }
  }
}

async function resolveAllBuckets(bucketKeys) {
  const resolved = new Map();
  const promises = [];
  for (const [bucket, keySet] of bucketKeys.entries()) {
    const keysArray = Array.from(keySet);
    promises.push(
      bulkSignBucket(bucket, keysArray).then((map) => {
        for (const [k, url] of map.entries()) {
          resolved.set(`${bucket}:${k}`, url);
        }
      })
    );
  }
  await Promise.all(promises);
  return resolved;
}

function applyStorageUrls(value, resolvedMap) {
  if (Array.isArray(value)) {
    return value.map((item) => applyStorageUrls(item, resolvedMap));
  }
  if (value && typeof value === "object") {
    const output = { ...value };
    for (const [field, bucket] of Object.entries(FILE_FIELD_BUCKETS)) {
      if (typeof output[field] === "string" && !isAbsoluteUrl(output[field])) {
        if (PUBLIC_BUCKETS.has(bucket)) {
          output[field] = publicStorageUrl(bucket, output[field]);
        } else {
          output[field] = resolvedMap.get(`${bucket}:${output[field]}`) || output[field];
        }
      }
    }
    if (Array.isArray(output.image_urls)) {
      output.image_urls = output.image_urls.map((key) => {
        if (typeof key === "string" && !isAbsoluteUrl(key)) {
          return resolvedMap.get(`assets:${key}`) || key;
        }
        return key;
      });
    }
    if (output.author && typeof output.author === "object") {
      output.author = { ...output.author };
      if (typeof output.author.avatar_url === "string" && !isAbsoluteUrl(output.author.avatar_url)) {
        output.author.avatar_url = publicStorageUrl("avatars", output.author.avatar_url);
      }
    }
    for (const [k, v] of Object.entries(output)) {
      if (v && typeof v === "object" && k !== "image_urls" && k !== "author") {
        output[k] = applyStorageUrls(v, resolvedMap);
      }
    }
    return output;
  }
  return value;
}

/**
 * Asynchronous expansion pass. Resolves stored keys into renderable URLs
 * using two-phase bulk resolution and LRU caching.
 *
 * Invariant: NEVER throws. On any error or timeout, unresolvable keys return raw keys.
 *
 * @returns {Promise<any>}
 */
async function withStorageUrls(value) {
  try {
    const bucketKeys = new Map();
    collectStorageKeys(value, bucketKeys);
    if (bucketKeys.size === 0) {
      return applyStorageUrls(value, new Map());
    }
    const resolvedMap = await resolveAllBuckets(bucketKeys);
    return applyStorageUrls(value, resolvedMap);
  } catch {
    return value;
  }
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
  __clearStorageCache,
};
