import { supabase } from "./supabase";

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api"
).replace(/\/+$/, "");

/**
 * Fetch wrapper that attaches the current Supabase access token to every
 * request. All backend calls must go through this so the API can authenticate
 * and authorize the caller — the server derives identity from the token, not
 * from the request body.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let targetPath = path;
  const method = (init.method || "GET").toUpperCase();

  // If there is no active session (guest visitor) and this is a read request,
  // route to the dedicated public read-only endpoints.
  if (!session?.access_token && method === "GET") {
    if (path.startsWith("/posts")) {
      targetPath = `/public${path}`;
    } else if (path.startsWith("/theses")) {
      targetPath = `/public${path}`;
    } else if (path.startsWith("/users")) {
      targetPath = path.replace(/^\/users/, "/public/peers");
    }
  }

  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) || {}),
  };
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  return fetch(`${API_URL}${targetPath}`, { ...init, headers });
}

/** apiFetch + JSON parsing + throw on non-2xx (uses the server's error message). */
export async function apiJson<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({} as any));
    throw new ApiError(
      err?.error || err?.message || `Request failed (${res.status})`,
      res.status
    );
  }
  return res.json() as Promise<T>;
}

/**
 * An API failure that carries the HTTP status, so callers can tell a permanent
 * rejection (4xx — e.g. a blocked send) from a transient one (network / 5xx)
 * and avoid retrying something that will never succeed.
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
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
  }
) {
  return apiJson(`/posts/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deletePost(id: string | number) {
  return apiJson(`/posts/${id}`, { method: "DELETE" });
}
