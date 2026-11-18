const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api"
).replace(/\/+$/, "");

/**
 * Derives the stable `/api/files/:category/:filename` URL for a storage key.
 */
export function fileUrl(key: string): string {
  if (!key || typeof key !== "string") return "";
  const origin = API_URL.replace(/\/api$/, "");
  return `${origin}/api/files/${key.replace(/^\/+/, "")}`;
}

/**
 * Resolves a stored file value into a fully qualified URL for rendering.
 * - Falsy values return `null`.
 * - Absolute URLs (`http:`, `https:`, `data:`, `blob:`, `file:`) return untouched.
 * - Storage keys (e.g. `avatars/xyz.jpg`, `posts/abc.png`) are expanded via `fileUrl`.
 */
export function resolveFileUrl(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(https?:|data:|blob:|file:)/i.test(trimmed)) {
    return trimmed;
  }
  return fileUrl(trimmed);
}

/**
 * Resolves an array of stored file values / keys into valid URLs.
 */
export function resolveFileUrls(
  list: (string | null | undefined)[] | null | undefined
): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => resolveFileUrl(item))
    .filter((url): url is string => Boolean(url));
}

const STORAGE_CATEGORIES = "avatars|posts|covers|theses|documents|videos|snaps|assets";
const STORAGE_KEY_RE = new RegExp(`^(${STORAGE_CATEGORIES})\\/[A-Za-z0-9._-]+$`, "i");
const API_FILE_RE = new RegExp(`\\/api\\/files\\/((${STORAGE_CATEGORIES})\\/[A-Za-z0-9._-]+)(?:\\?.*)?$`, "i");

/**
 * Extracts a content-addressed storage key from a `/api/files/:category/:filename` URL or raw key.
 * e.g. 'https://.../api/files/posts/9f83ab24e10c71a39bd5.jpg' -> 'posts/9f83ab24e10c71a39bd5.jpg'
 * e.g. 'avatars/9f83ab24e10c71a39bd5.jpg' -> 'avatars/9f83ab24e10c71a39bd5.jpg'
 * Returns undefined for non-storage URLs (Google avatars, link previews, local relative/picker paths).
 */
export function fileKeyFromUrl(uri: string | null | undefined): string | undefined {
  if (!uri || typeof uri !== "string") return undefined;
  const match = uri.match(API_FILE_RE);
  if (match) {
    return match[1];
  }
  // If the uri is already a canonical storage key:
  if (STORAGE_KEY_RE.test(uri)) {
    return uri;
  }
  return undefined;
}
