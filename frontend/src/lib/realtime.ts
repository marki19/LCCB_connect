import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Conversation, Message, PresenceMode } from "../types";

/**
 * Realtime plumbing (Messaging_plan.md §8).
 *
 * One module-level client owns every channel for the signed-in user:
 *   * `db:<uid>`       — Postgres Changes on `messages`, `conversations` and
 *                        `notifications` (RLS scopes each row to the caller).
 *   * `presence:campus`— the campus-wide presence channel (private).
 *   * `conv:<id>`       — per-conversation typing Broadcast (private).
 *
 * Consumers subscribe with the `on*` helpers, which return an unsubscribe
 * function; the channels themselves live for the whole session so an inbox and
 * a thread screen share one socket. Reconnect + `seq` catch-up is handled by
 * `onStatus` (Supabase re-emits `SUBSCRIBED`) plus the API's `since_seq`.
 */

export const PRESENCE_TOPIC = "presence:campus";
export const conversationTopic = (conversationId: string) => `conv:${conversationId}`;

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";
export type PostgresAction = "INSERT" | "UPDATE" | "DELETE";

export type MessageEvent = {
  action: PostgresAction;
  message: Message;
  previous?: Partial<Message>;
};

export type ConversationEvent = {
  action: PostgresAction;
  conversation: Conversation;
};

export type RealtimeNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  target_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
};

export type NotificationEvent = {
  action: PostgresAction;
  notification: RealtimeNotification;
};

export type PresenceInfo = {
  user_id: string;
  mode: PresenceMode;
  online_at: string;
};

/** Keyed by presence key (our `user_id`); each key may hold several sessions. */
export type PresenceState = Record<string, PresenceInfo[]>;

export type TypingPayload = { user_id: string; typing: boolean };

export type Unsubscribe = () => void;

// ---- event emitter ---------------------------------------------------------
// A tiny typed emitter keeps the channels decoupled from the React tree: the
// provider subscribes to presence/status, a thread screen subscribes to
// messages, the inbox may subscribe to conversations — all at once.

type Listener<T> = (payload: T) => void;

const listeners = {
  message: new Set<Listener<MessageEvent>>(),
  conversation: new Set<Listener<ConversationEvent>>(),
  notification: new Set<Listener<NotificationEvent>>(),
  presence: new Set<Listener<PresenceState>>(),
  status: new Set<Listener<ConnectionStatus>>(),
};

function subscribe<T>(set: Set<Listener<T>>, listener: Listener<T>): Unsubscribe {
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

const emit = <T,>(set: Set<Listener<T>>, payload: T) => {
  for (const listener of set) listener(payload);
};

export const onMessage = (cb: Listener<MessageEvent>) => subscribe(listeners.message, cb);
export const onConversation = (cb: Listener<ConversationEvent>) =>
  subscribe(listeners.conversation, cb);
export const onNotification = (cb: Listener<NotificationEvent>) =>
  subscribe(listeners.notification, cb);
export const onPresence = (cb: Listener<PresenceState>) => subscribe(listeners.presence, cb);
export const onStatus = (cb: Listener<ConnectionStatus>) => subscribe(listeners.status, cb);

// ---- module state ----------------------------------------------------------

let currentUserId: string | null = null;
let currentMode: PresenceMode = "online";
let status: ConnectionStatus = "disconnected";
let dbChannel: RealtimeChannel | null = null;
let presenceChannel: RealtimeChannel | null = null;

type ConversationChannel = {
  channel: RealtimeChannel;
  subscribed: boolean;
  handlers: Set<Listener<TypingPayload>>;
};

const conversationChannels = new Map<string, ConversationChannel>();

const mapStatus = (raw: string): ConnectionStatus => {
  switch (raw) {
    case "SUBSCRIBED":
      return "connected";
    case "CHANNEL_ERROR":
      return "error";
    case "TIMED_OUT":
    case "CLOSED":
      return "disconnected";
    default:
      return "connecting";
  }
};

const emitStatus = (next: ConnectionStatus) => {
  status = next;
  emit(listeners.status, next);
};

export const getConnectionStatus = (): ConnectionStatus => status;

export const getPresenceState = (): PresenceState =>
  (presenceChannel?.presenceState() as unknown as PresenceState) ?? {};

// ---- presence --------------------------------------------------------------

async function trackPresence() {
  if (!presenceChannel || !currentUserId) return;
  // `invisible` reports offline: stop tracking instead of publishing a mode.
  if (currentMode === "invisible") {
    await presenceChannel.untrack().catch(() => undefined);
    return;
  }
  await presenceChannel
    .track({
      user_id: currentUserId,
      mode: currentMode,
      online_at: new Date().toISOString(),
    })
    .catch(() => undefined);
}

/** Change the live presence mode (ephemeral; the API persists it separately). */
export async function setPresenceMode(mode: PresenceMode) {
  currentMode = mode;
  await trackPresence();
}

// ---- lifecycle -------------------------------------------------------------

/**
 * Start (or re-target) the client for `userId`. Idempotent for the same user —
 * a re-mount only updates the mode. Private channels + RLS need the current JWT
 * on the Realtime client, so `setAuth` runs first.
 */
export async function startRealtime(
  userId: string,
  options: { mode?: PresenceMode } = {}
) {
  if (currentUserId === userId && dbChannel && presenceChannel) {
    if (options.mode) await setPresenceMode(options.mode);
    return;
  }

  await stopRealtime();
  currentUserId = userId;
  currentMode = options.mode ?? "online";

  await supabase.realtime.setAuth().catch(() => undefined);

  dbChannel = supabase
    .channel(`db:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages" },
      (payload) =>
        emit(listeners.message, {
          action: payload.eventType as PostgresAction,
          message: (payload.new ?? payload.old) as unknown as Message,
          previous:
            payload.eventType === "UPDATE" ? (payload.old as Partial<Message>) : undefined,
        })
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations" },
      (payload) =>
        emit(listeners.conversation, {
          action: payload.eventType as PostgresAction,
          conversation: (payload.new ?? payload.old) as unknown as Conversation,
        })
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (payload) =>
        emit(listeners.notification, {
          action: payload.eventType as PostgresAction,
          notification: (payload.new ?? payload.old) as unknown as RealtimeNotification,
        })
    )
    .subscribe((raw) => emitStatus(mapStatus(raw)));

  presenceChannel = supabase
    .channel(PRESENCE_TOPIC, { config: { private: true, presence: { key: userId } } })
    .on("presence", { event: "sync" }, () => {
      emit(listeners.presence, getPresenceState());
    })
    .subscribe(async (raw) => {
      if (raw === "SUBSCRIBED") await trackPresence();
    });
}

/** Tear every channel down (sign-out, user switch, unmount). */
export async function stopRealtime() {
  for (const entry of conversationChannels.values()) {
    await supabase.removeChannel(entry.channel).catch(() => undefined);
  }
  conversationChannels.clear();

  if (dbChannel) await supabase.removeChannel(dbChannel).catch(() => undefined);
  if (presenceChannel) await supabase.removeChannel(presenceChannel).catch(() => undefined);

  dbChannel = null;
  presenceChannel = null;
  currentUserId = null;
  emitStatus("disconnected");
}

// ---- typing (per conversation) ---------------------------------------------

/**
 * Subscribe to typing events for one thread. The channel is shared across
 * callers and torn down when the last handler leaves.
 */
export function subscribeToConversation(
  conversationId: string,
  onTyping: Listener<TypingPayload>
): Unsubscribe {
  const topic = conversationTopic(conversationId);
  const existing = conversationChannels.get(topic);
  if (existing) {
    existing.handlers.add(onTyping);
    return () => dropTypingHandler(topic, onTyping);
  }

  const handlers = new Set<Listener<TypingPayload>>([onTyping]);
  const channel = supabase
    .channel(topic, { config: { private: true, broadcast: { self: false } } })
    .on("broadcast", { event: "typing" }, (payload) => {
      const entry = conversationChannels.get(topic);
      if (entry) emit(entry.handlers, payload.payload as TypingPayload);
    })
    .subscribe((raw) => {
      const entry = conversationChannels.get(topic);
      if (entry) entry.subscribed = raw === "SUBSCRIBED";
    });

  conversationChannels.set(topic, { channel, subscribed: false, handlers });
  return () => dropTypingHandler(topic, onTyping);
}

function dropTypingHandler(topic: string, handler: Listener<TypingPayload>) {
  const entry = conversationChannels.get(topic);
  if (!entry) return;
  entry.handlers.delete(handler);
  if (entry.handlers.size === 0) {
    conversationChannels.delete(topic);
    void supabase.removeChannel(entry.channel);
  }
}

/** Fire-and-forget typing indicator; dropped until the channel is joined. */
export async function sendTyping(conversationId: string, typing: boolean) {
  if (!currentUserId) return;
  const entry = conversationChannels.get(conversationTopic(conversationId));
  if (!entry || !entry.subscribed) return;
  await entry.channel
    .send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: currentUserId, typing },
    })
    .catch(() => undefined);
}
