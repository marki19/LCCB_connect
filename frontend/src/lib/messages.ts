import { apiJson } from "./api";
import type {
  Conversation,
  Friend,
  FriendRequests,
  Message,
  MessagePolicy,
  MessagePolicySetting,
  MessageRequests,
  PresenceMode,
} from "../types";

/**
 * Messaging / friends / social-settings API client (Messaging_plan.md §11).
 *
 * Every call goes through `apiJson` → the Express API, which derives identity
 * from the bearer token. The client never talks to PostgREST directly.
 */

// ---- conversations ---------------------------------------------------------

export function listConversations(limit?: number): Promise<Conversation[]> {
  const query = limit ? `?limit=${limit}` : "";
  return apiJson<Conversation[]>(`/conversations${query}`);
}

export function listRequests(limit?: number): Promise<MessageRequests> {
  const query = limit ? `?limit=${limit}` : "";
  return apiJson<MessageRequests>(`/conversations/requests${query}`);
}

/** Open (or re-open) the 1:1 thread with `peerId`; may start as a request. */
export function openConversation(peerId: string): Promise<Conversation> {
  return apiJson<Conversation>(`/conversations`, {
    method: "POST",
    body: JSON.stringify({ peer_id: peerId }),
  });
}

/** Addressee-only: turn a `requested` thread into an `active` one. */
export function acceptConversation(conversationId: string): Promise<Conversation> {
  return apiJson<Conversation>(`/conversations/${conversationId}/accept`, {
    method: "POST",
  });
}

// ---- messages --------------------------------------------------------------

export type MessageWindow = {
  limit?: number;
  /** Catch-up: everything with `seq > sinceSeq` (reconnect recovery). */
  sinceSeq?: number;
  /** Backward pagination: the `limit` messages before this `seq`. */
  beforeSeq?: number;
};

export function listMessages(
  conversationId: string,
  { limit, sinceSeq, beforeSeq }: MessageWindow = {}
): Promise<Message[]> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (sinceSeq !== undefined) params.set("since_seq", String(sinceSeq));
  if (beforeSeq !== undefined) params.set("before_seq", String(beforeSeq));
  const query = params.toString();
  return apiJson<Message[]>(
    `/conversations/${conversationId}/messages${query ? `?${query}` : ""}`
  );
}

/** Idempotent on `(sender_id, client_msg_id)` — a retry never double-inserts. */
export function sendMessage(
  conversationId: string,
  body: string,
  clientMsgId: string
): Promise<Message> {
  return apiJson<Message>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body, client_msg_id: clientMsgId }),
  });
}

/** Seen receipt: mark every received message up to `uptoSeq` as read. */
export type MarkReadResult = {
  updated: { id: string; seq: number }[];
  last_read_seq: number;
};

export function markRead(conversationId: string, uptoSeq: number): Promise<MarkReadResult> {
  return apiJson<MarkReadResult>(`/conversations/${conversationId}/read`, {
    method: "POST",
    body: JSON.stringify({ upto_seq: uptoSeq }),
  });
}

/** Delivered receipt: recipient-only; a non-recipient gets a 404. */
export function markDelivered(messageId: string): Promise<Message> {
  return apiJson<Message>(`/messages/${messageId}/delivered`, { method: "POST" });
}

export function reportMessage(messageId: string, reason?: string): Promise<unknown> {
  return apiJson(`/messages/${messageId}/report`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export function muteConversation(
  conversationId: string,
  muteMinutes: number | null
): Promise<unknown> {
  return apiJson(`/conversations/${conversationId}/mute`, {
    method: "POST",
    body: JSON.stringify({ mute_minutes: muteMinutes }),
  });
}

// ---- "who can message me" policy (§4) --------------------------------------

export function getMessagePolicy(): Promise<MessagePolicySetting> {
  return apiJson<MessagePolicySetting>(`/users/me/message-policy`);
}

export function setMessagePolicy(
  messagePolicy: MessagePolicy,
  departmentIds?: string[]
): Promise<MessagePolicySetting> {
  const body: { message_policy: MessagePolicy; department_ids?: string[] } = {
    message_policy: messagePolicy,
  };
  if (messagePolicy === "selected") body.department_ids = departmentIds ?? [];
  return apiJson<MessagePolicySetting>(`/users/me/message-policy`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// ---- presence (§8) ---------------------------------------------------------

export function setPresence(mode: PresenceMode): Promise<unknown> {
  return apiJson(`/users/me/presence`, {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

export function heartbeat(options: {
  mode?: PresenceMode;
  lastSeenVisible?: boolean;
} = {}): Promise<unknown> {
  const body: { mode?: PresenceMode; last_seen_visible?: boolean } = {};
  if (options.mode) body.mode = options.mode;
  if (options.lastSeenVisible !== undefined) body.last_seen_visible = options.lastSeenVisible;
  return apiJson(`/users/me/heartbeat`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---- friends (§5) ----------------------------------------------------------

export function listFriends(limit?: number): Promise<Friend[]> {
  return apiJson<Friend[]>(`/friends${limit ? `?limit=${limit}` : ""}`);
}

export function listFriendRequests(limit?: number): Promise<FriendRequests> {
  return apiJson<FriendRequests>(`/friends/requests${limit ? `?limit=${limit}` : ""}`);
}

export function sendFriendRequest(addresseeId: string): Promise<unknown> {
  return apiJson(`/friends/requests`, {
    method: "POST",
    body: JSON.stringify({ addressee_id: addresseeId }),
  });
}

export function acceptFriendRequest(requestId: string): Promise<unknown> {
  return apiJson(`/friends/requests/${requestId}/accept`, { method: "POST" });
}

export function declineFriendRequest(requestId: string): Promise<unknown> {
  return apiJson(`/friends/requests/${requestId}/decline`, { method: "POST" });
}

export function removeFriend(userId: string): Promise<unknown> {
  return apiJson(`/friends/${userId}`, { method: "DELETE" });
}

// ---- blocks (§7) -----------------------------------------------------------

export type BlockedUser = {
  blocked_id: string;
  created_at: string;
  peer?: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export function listBlocked(): Promise<BlockedUser[]> {
  return apiJson(`/users/me/blocks`);
}

export function blockUser(userId: string): Promise<unknown> {
  return apiJson(`/users/${userId}/block`, { method: "POST" });
}

export function unblockUser(userId: string): Promise<unknown> {
  return apiJson(`/users/${userId}/block`, { method: "DELETE" });
}

// ---- device tokens (push, §10) ---------------------------------------------

export function registerDeviceToken(token: string, platform: "ios" | "android" | "web"): Promise<unknown> {
  return apiJson(`/users/me/device-tokens`, {
    method: "POST",
    body: JSON.stringify({ token, platform }),
  });
}

export function unregisterDeviceToken(token: string): Promise<unknown> {
  return apiJson(`/users/me/device-tokens`, {
    method: "DELETE",
    body: JSON.stringify({ token }),
  });
}

// ---- helpers ---------------------------------------------------------------

/**
 * Client-side idempotency key for `sendMessage`. Prefers the platform UUID
 * (Hermes on modern RN ships `crypto.randomUUID`); falls back to an RFC-4122
 * v4 built from `Math.random` — the server only needs a stable unique string,
 * not cryptographic randomness.
 */
export function newClientMessageId(): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoObj?.randomUUID === "function") return cryptoObj.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
