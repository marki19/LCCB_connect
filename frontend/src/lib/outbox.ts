import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError } from "./api";
import { onStatus } from "./realtime";
import { sendMessage } from "./messages";
import type { Message } from "../types";

/**
 * Offline outbox (Messaging_plan.md §9, §14).
 *
 * A send that fails (device offline) is persisted with its `client_msg_id` and
 * replayed on the next `connected` status. Because the server dedupes on
 * `(sender_id, client_msg_id)`, a replay can never double-insert — even if the
 * first attempt actually committed before the connection dropped.
 */

const KEY = "lccb.outbox.v1";

export type OutboxItem = {
  id: string; // client_msg_id
  conversationId: string;
  body: string;
  createdAt: string;
};

let cache: OutboxItem[] | null = null;
const sentListeners = new Set<(item: OutboxItem, message: Message) => void>();
const failedListeners = new Set<(item: OutboxItem, error: unknown) => void>();

async function load(): Promise<OutboxItem[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function persist(items: OutboxItem[]) {
  cache = items;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Persisting is best-effort; the in-memory cache still replays this session.
  }
}

export async function listOutbox(): Promise<OutboxItem[]> {
  return [...(await load())];
}

export async function enqueue(item: OutboxItem): Promise<void> {
  const items = await load();
  if (items.some((existing) => existing.id === item.id)) return;
  await persist([...items, item]);
}

export async function removeFromOutbox(id: string): Promise<void> {
  const items = await load();
  await persist(items.filter((item) => item.id !== id));
}

export function onOutboxSent(cb: (item: OutboxItem, message: Message) => void): () => void {
  sentListeners.add(cb);
  return () => {
    sentListeners.delete(cb);
  };
}

/** Fired when a queued send is permanently rejected and dropped (e.g. blocked). */
export function onOutboxFailed(cb: (item: OutboxItem, error: unknown) => void): () => void {
  failedListeners.add(cb);
  return () => {
    failedListeners.delete(cb);
  };
}

let flushing = false;

/**
 * Replay queued sends. A transient failure (network / 5xx) stops the run so
 * order is preserved and a failing endpoint isn't hammered; a permanent
 * rejection (4xx) is dropped, since retrying can never succeed.
 */
export async function flushOutbox(conversationId?: string): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const items = await load();
    for (const item of items) {
      if (conversationId && item.conversationId !== conversationId) continue;
      try {
        const message = await sendMessage(item.conversationId, item.body, item.id);
        await removeFromOutbox(item.id);
        for (const listener of sentListeners) listener(item, message);
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 0;
        if (status >= 400 && status < 500) {
          await removeFromOutbox(item.id);
          for (const listener of failedListeners) listener(item, err);
          continue;
        }
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

let started = false;

/** Auto-replay whenever Realtime (re)connects. Safe to call more than once. */
export function startOutbox(): void {
  if (started) return;
  started = true;
  onStatus((status) => {
    if (status === "connected") void flushOutbox();
  });
  void flushOutbox();
}
