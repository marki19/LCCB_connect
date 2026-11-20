import { apiJson } from "./api";

export type SnapAudience = "public" | "friends" | "department" | "private";

export interface SnapItem {
  id: string;
  author_id: string;
  /**
   * Ready to render. The API signs the stored key before serialising, so this
   * is a short-lived https URL, not a bucket key — pass it straight to
   * `resolveFileUrl`, never reconstruct `/api/files/snaps/...` yourself.
   */
  media_key: string;
  media_type: "image" | "video";
  caption?: string | null;
  visibility: SnapAudience;
  created_at: string;
  expires_at: string;
  is_viewed?: boolean;
  viewer_reaction?: string | null;
  reactions_count?: number;
  views_count?: number;
  username?: string;
  full_name?: string;
  avatar_url?: string | null;
}

export interface SnapGroup {
  author_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  snaps: SnapItem[];
  has_unviewed: boolean;
  latest_created_at: string;
}

export interface CreateSnapPayload {
  media_key: string;
  media_type: "image" | "video";
  caption?: string | null;
  visibility?: SnapAudience;
}

/**
 * Creates a new snap record.
 */
export async function createSnap(payload: CreateSnapPayload): Promise<SnapItem> {
  return apiJson<SnapItem>("/snaps", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Retrieves the grouped rail of active snaps for the feed.
 */
export async function getSnapRail(): Promise<SnapGroup[]> {
  return apiJson<SnapGroup[]>("/snaps/rail");
}

/**
 * Retrieves active snaps for a specific user.
 */
export async function getUserSnaps(userId: string): Promise<SnapItem[]> {
  return apiJson<SnapItem[]>(`/snaps/user/${userId}`);
}

/**
 * Retrieves a single snap by ID.
 */
export async function getSnap(snapId: string): Promise<SnapItem> {
  return apiJson<SnapItem>(`/snaps/${snapId}`);
}

/**
 * Records that the current user viewed a snap.
 */
export async function recordSnapView(snapId: string): Promise<{ success: boolean }> {
  return apiJson<{ success: boolean }>(`/snaps/${snapId}/view`, {
    method: "POST",
  });
}

/**
 * Records a reaction (e.g. 'heart') on a snap.
 */
export async function reactToSnap(snapId: string, reaction = "heart"): Promise<{ success: boolean }> {
  return apiJson<{ success: boolean }>(`/snaps/${snapId}/react`, {
    method: "POST",
    body: JSON.stringify({ reaction }),
  });
}

/**
 * Removes a reaction from a snap.
 */
export async function unreactSnap(snapId: string): Promise<{ success: boolean }> {
  return apiJson<{ success: boolean }>(`/snaps/${snapId}/react`, {
    method: "DELETE",
  });
}

/**
 * Deletes a snap owned by the user.
 */
export async function deleteSnap(snapId: string): Promise<{ message: string; id: string }> {
  return apiJson<{ message: string; id: string }>(`/snaps/${snapId}`, {
    method: "DELETE",
  });
}
