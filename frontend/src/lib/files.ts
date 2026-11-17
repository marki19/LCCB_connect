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

/**
 * Extracts a content-addressed storage key from a `/api/files/:category/:filename` URL.
 * e.g. 'https://.../api/files/posts/abc.jpg' -> 'posts/abc.jpg'
 * e.g. '/api/files/avatars/xyz.jpg' -> 'avatars/xyz.jpg'
 * Returns undefined for non-storage URLs (Google avatars, link previews, data URIs).
 */
export function fileKeyFromUrl(uri: string | null | undefined): string | undefined {
  if (!uri || typeof uri !== "string") return undefined;
  const match = uri.match(/\/api\/files\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)(?:\?.*)?$/);
  if (match) {
    return match[1];
  }
  // If the uri is already a raw storage key like "posts/abc.jpg" or "avatars/xyz.jpg":
  if (/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(uri)) {
    return uri;
  }
  return undefined;
}
