/**
 * Google Avatar Mirroring Service
 *
 * Fetches upstream Google avatars and stores them into object storage as content-addressed
 * avatar assets. Prevents hotlinking, tracking, and third-party image rot.
 */

const db = require("../db");
const objectStorage = require("./objectStorage");
const uploadService = require("./uploadService");

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB cap
const FETCH_TIMEOUT_MS = 10000;

/**
 * Validates whether a URL points to Google's profile image CDN.
 */
function isGoogleAvatarUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "googleusercontent.com" ||
        parsed.hostname.endsWith(".googleusercontent.com"))
    );
  } catch {
    return false;
  }
}

/**
 * Strips Google's resizing suffix (e.g., `=s96-c`, `=s120`, `=s400-c`) to obtain
 * the canonical source URL.
 */
function canonicalizeGoogleAvatarUrl(url) {
  if (!url || typeof url !== "string") return "";
  return url.replace(/=s\d+(-c)?$/i, "");
}

/**
 * Extension mapper from response Content-Type.
 */
function extensionForMime(mime) {
  const normalized = (mime || "").toLowerCase().split(";")[0].trim();
  switch (normalized) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/jpeg":
    case "image/jpg":
    default:
      return ".jpg";
  }
}

/**
 * Mirrors a Google user's profile avatar into our local/S3 object storage.
 *
 * Invariant: Never throws. All network and storage errors are caught and swallowed
 * so the authentication flow is never blocked.
 *
 * @param {string} userId
 * @param {string} rawGoogleUrl
 * @returns {Promise<{ key: string } | null>}
 */
async function mirrorGoogleAvatar(userId, rawGoogleUrl) {
  if (!userId || !rawGoogleUrl || !isGoogleAvatarUrl(rawGoogleUrl)) {
    return null;
  }

  const canonicalUrl = canonicalizeGoogleAvatarUrl(rawGoogleUrl);

  try {
    // 1. Check current profile state
    const { rows } = await db.query(
      `SELECT avatar_url, avatar_source, google_avatar_url FROM public.profiles WHERE id = $1`,
      [userId]
    );

    if (rows.length === 0) return null;
    const profile = rows[0];

    // If the user previously uploaded their own custom photo, never overwrite it.
    // Only record the latest Google picture reference.
    if (profile.avatar_source === "upload") {
      if (profile.google_avatar_url !== canonicalUrl) {
        await db.query(
          `UPDATE public.profiles SET google_avatar_url = $1 WHERE id = $2`,
          [canonicalUrl, userId]
        );
      }
      return null;
    }

    // If already mirrored and the upstream picture has not changed, skip fetch.
    if (
      profile.avatar_source === "google" &&
      profile.google_avatar_url === canonicalUrl &&
      profile.avatar_url
    ) {
      return { key: profile.avatar_url };
    }

    // 2. Fetch the upstream image
    const response = await fetch(canonicalUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: "image/jpeg,image/png,image/webp,image/*",
      },
    });

    if (!response.ok) {
      console.warn(`[googleAvatar] Upstream returned HTTP ${response.status} for ${userId}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      console.warn(`[googleAvatar] Unexpected content-type ${contentType} for ${userId}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_AVATAR_BYTES) {
      console.warn(`[googleAvatar] Avatar exceeds size limit (${buffer.length} bytes) for ${userId}`);
      return null;
    }

    // 3. Store into object storage under 'avatars' category
    const ext = extensionForMime(contentType);
    const stored = await uploadService.storeUpload({
      category: "avatars",
      originalName: `google-avatar${ext}`,
      buffer,
    });

    // 4. Update user profile columns
    await db.query(
      `UPDATE public.profiles
       SET avatar_url = $1,
           avatar_source = 'google',
           google_avatar_url = $2
       WHERE id = $3`,
      [stored.key, canonicalUrl, userId]
    );

    // 5. Clean up the previous mirrored object if one exists
    const oldAvatarKey = profile.avatar_url;
    if (
      oldAvatarKey &&
      profile.avatar_source === "google" &&
      oldAvatarKey !== stored.key &&
      !oldAvatarKey.startsWith("http")
    ) {
      objectStorage.deleteObject(oldAvatarKey).catch(() => {});
    }

    return { key: stored.key };
  } catch (err) {
    console.error("[googleAvatar] Mirroring failed:", err.message);
    return null;
  }
}

module.exports = {
  isGoogleAvatarUrl,
  canonicalizeGoogleAvatarUrl,
  mirrorGoogleAvatar,
};
