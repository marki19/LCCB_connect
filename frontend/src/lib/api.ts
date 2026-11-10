import { create, isAxiosError } from "axios";
import { supabase } from "./supabase";
import type { ContentVisibility } from "../types";

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api"
).replace(/\/+$/, "");

// ─── Axios instance ───────────────────────────────────────────────────────────
// One shared instance so the interceptor is registered once.
const client = create({ baseURL: API_URL });

// Attach the Supabase Bearer token before every request and rewrite
// guest GET paths to the public read-only endpoints.
client.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const method = (config.method || "get").toUpperCase();

  // If there is no active session (guest visitor) and this is a read request,
  // route to the dedicated public read-only endpoints. Guests must call
  // `/public/*` explicitly for anything else; `/users/:id` has no public
  // equivalent, so it must not be rewritten to a different resource shape.
  if (!session?.access_token && method === "GET") {
    if (typeof config.url === "string") {
      if (
        config.url.startsWith("/posts") ||
        config.url.startsWith("/theses")
      ) {
        config.url = `/public${config.url}`;
      }
    }
  }

  if (session?.access_token) {
    config.headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return config;
});

/**
 * Axios-backed drop-in for the old `fetch` wrapper. Returns a Fetch-Response-
 * shaped shim `{ ok, status, json }` so every existing caller (e.g.
 * AuthContext) works without modification.
 *
 * All backend calls must go through this so the API can authenticate and
 * authorize the caller — the server derives identity from the token, not from
 * the request body.
 */
/**
 * POST multipart/form-data through the authenticated client.
 *
 * Axios sets the `Content-Type` boundary itself when given a FormData object,
 * so the caller must NOT set a Content-Type header — doing so would drop the
 * boundary and the server would reject the upload.
 */
export async function apiFetchMultipart(
  path: string,
  formData: FormData
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  const res = await client.request({
    url: path,
    method: "POST",
    data: formData,
    validateStatus: () => true,
  });
  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    json: async () => res.data,
  };
}

export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  const res = await client.request({
    url: path,
    method: (init.method as any) || "GET",
    data: init.body,
    headers: init.headers as any,
    // Never throw on non-2xx — mirror native fetch behaviour for this shim so
    // callers that check `.ok` keep working as expected.
    validateStatus: () => true,
  });
  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    json: async () => res.data,
  };
}

/**
 * apiFetch + JSON parsing + throw on non-2xx (uses the server's error message).
 *
 * An API failure that carries the HTTP status, so callers can tell a permanent
 * rejection (4xx — e.g. a blocked send) from a transient one (network / 5xx)
 * and avoid retrying something that will never succeed.
 */
export async function apiJson<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  try {
    const headers = { ...(init.headers || {}) as Record<string, string> };
    if (typeof init.body === "string") {
      headers["Content-Type"] = "application/json";
    }
    const res = await client.request<T>({
      url: path,
      method: (init.method as any) || "GET",
      data: init.body,
      headers,
    });
    return res.data;
  } catch (err) {
      if (isAxiosError(err) && err.response) {
      const body = err.response.data as any;
      throw new ApiError(
        body?.error || body?.message || `Request failed (${err.response.status})`,
        err.response.status,
        body?.code
      );
    }
    throw err;
  }
}

/**
 * An API failure that carries the HTTP status, so callers can tell a permanent
 * rejection (4xx — e.g. a blocked send) from a transient one (network / 5xx)
 * and avoid retrying something that will never succeed.
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function updatePost(
  id: string | number,
  data: {
    content?: string;
    title?: string | null;
    technologies?: string[] | null;
    github_url?: string | null;
    image_url?: string | null;
    type?: string;
    preview_metadata?: any;
    visibility?: ContentVisibility;
    audience?: string[];
  }
): Promise<void> {
  return apiJson(`/posts/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deletePost(id: string | number): Promise<void> {
  return apiJson(`/posts/${id}`, { method: "DELETE" });
}

export async function updateComment(
  postId: string | number,
  commentId: string | number,
  content: string
): Promise<void> {
  return apiJson(`/posts/${postId}/comments/${commentId}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export async function deleteComment(
  postId: string | number,
  commentId: string | number
): Promise<void> {
  return apiJson(`/posts/${postId}/comments/${commentId}`, { method: "DELETE" });
}

export async function updateThesis(
  id: string | number,
  data: {
    title?: string;
    abstract?: string;
    category?: string;
    pdf_url?: string | null;
    visibility?: ContentVisibility;
    audience?: string[];
  }
): Promise<void> {
  return apiJson(`/theses/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteThesis(id: string | number): Promise<void> {
  return apiJson(`/theses/${id}`, { method: "DELETE" });
}

/**
 * Fetches a short-lived signed URL for a thesis' manuscript.
 *
 * Manuscripts live in a private bucket (migration 015), so the client never
 * receives a usable URL directly — it asks the backend, which checks
 * visibility first, and gets back a URL that expires after 5 minutes.
 */
export async function getThesisFileUrl(id: string | number): Promise<string> {
  const data = await apiJson<{ url?: string }>(`/theses/${id}/file`);
  if (!data?.url) {
    throw new ApiError("Could not generate file URL", 404);
  }
  return data.url;
}

/**
 * Fetches a short-lived signed URL for a post's image.
 *
 * Post images live in the private `assets` bucket (migration 015), so the
 * client asks the backend, which checks visibility first, and gets back a
 * URL that expires after 5 minutes.
 */
export async function getPostImageUrl(id: string | number): Promise<string> {
  const data = await apiJson<{ url?: string }>(`/posts/${id}/file`);
  if (!data?.url) {
    throw new ApiError("Could not generate image URL", 404);
  }
  return data.url;
}

// ============================================================================
// Repost endpoints
// ============================================================================

export async function createRepost(postId: string | number, caption?: string): Promise<any> {
  return apiJson(`/posts/${postId}/repost`, {
    method: "POST",
    body: JSON.stringify({ caption }),
  });
}

export async function undoRepost(postId: string | number): Promise<any> {
  return apiJson(`/posts/${postId}/repost`, { method: "DELETE" });
}

export async function updateRepostCaption(repostId: string | number, caption: string): Promise<any> {
  return apiJson(`/reposts/${repostId}`, {
    method: "PATCH",
    body: JSON.stringify({ caption }),
  });
}

export async function getReposts(postId: string | number): Promise<any[]> {
  return apiJson(`/posts/${postId}/reposts`);
}

// ============================================================================
// Report endpoints
// ============================================================================

export async function createReport(
  targetType: string,
  targetId: string | number,
  reason: string,
  note?: string
): Promise<any> {
  return apiJson("/reports", {
    method: "POST",
    body: JSON.stringify({ targetType, targetId, reason, note }),
  });
}

// ============================================================================
// Block endpoints
// ============================================================================

export async function blockUser(userId: string | number): Promise<any> {
  return apiJson("/blocks", {
    method: "POST",
    body: JSON.stringify({ blockedId: userId }),
  });
}

export async function unblockUser(userId: string | number): Promise<any> {
  return apiJson(`/blocks/${userId}`, { method: "DELETE" });
}

export async function listBlocked(): Promise<any[]> {
  return apiJson("/blocks");
}

// ============================================================================
// Profile endpoints
// ============================================================================

export async function dismissBanner(): Promise<any> {
  return apiJson("/me/banner-dismissed", {
    method: "PATCH",
    body: JSON.stringify({ dismissed: true }),
  });
}

// ============================================================================
// Feed endpoint
// ============================================================================

export async function getFeed(cursor?: string, type?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (type) params.set("type", type);
  return apiJson(`/feed?${params.toString()}`);
}
