import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  getConnectionStatus,
  onMessage,
  onStatus,
  sendTyping,
  subscribeToConversation,
  type ConnectionStatus,
} from "../lib/realtime";
import {
  listMessages,
  markDelivered,
  markRead,
  newClientMessageId,
  sendMessage,
} from "../lib/messages";
import { enqueue, onOutboxSent } from "../lib/outbox";
import type { Message } from "../types";

/**
 * Live thread for one conversation (Messaging_plan.md §8, §12).
 *
 * Combines: history load, Postgres-Changes inserts/updates, typing Broadcast,
 * delivery/read receipts, `seq`-based catch-up after a reconnect, and an
 * optimistic "pending" bubble backed by the offline outbox. Messages are always
 * ordered by `seq`, never `created_at`, so a late commit can't reorder the thread.
 */

const DEFAULT_PAGE_SIZE = 50;
const TYPING_TIMEOUT_MS = 5000;

/** A message composed locally but not yet confirmed by the server. */
export type PendingMessage = {
  clientMsgId: string;
  body: string;
  createdAt: string;
};

/** Merge by id (dedupes the POST echo vs the Realtime INSERT), ordered by seq. */
const mergeMessages = (prev: Message[], incoming: Message[]): Message[] => {
  if (incoming.length === 0) return prev;
  const byId = new Map(prev.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return Array.from(byId.values()).sort((a, b) => a.seq - b.seq);
};

export type UseConversationRealtime = {
  messages: Message[];
  pending: PendingMessage[];
  loading: boolean;
  peerTyping: boolean;
  status: ConnectionStatus;
  send: (body: string) => Promise<Message | null>;
  notifyTyping: (typing: boolean) => void;
  markReadNow: () => void;
  loadOlder: () => Promise<void>;
};

export function useConversationRealtime(
  conversationId: string | null,
  options: { pageSize?: number } = {}
): UseConversationRealtime {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;

  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>(getConnectionStatus());

  const lastSeqRef = useRef(0);
  const loadedRef = useRef(false);
  const hasMoreRef = useRef(true);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state and load history whenever the thread changes.
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setPending([]);
      setPeerTyping(false);
      setMessages([]);
      lastSeqRef.current = 0;
      loadedRef.current = false;
      hasMoreRef.current = true;

      try {
        const rows = await listMessages(conversationId, { limit: pageSize });
        if (cancelled) return;
        setMessages(rows);
        const last = rows.length ? rows[rows.length - 1].seq : 0;
        lastSeqRef.current = last;
        hasMoreRef.current = rows.length === pageSize;
        loadedRef.current = true;
        if (last > 0) void markRead(conversationId, last).catch(() => undefined);
      } catch {
        // History load is best-effort; realtime + catch-up fill the gap.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [conversationId, pageSize]);

  // Live inserts/updates for this thread (delivery + seen receipts best-effort).
  useEffect(() => {
    if (!conversationId) return;
    const off = onMessage((event) => {
      const incoming = event.message;
      if (!incoming || incoming.conversation_id !== conversationId) return;

      setMessages((prev) => mergeMessages(prev, [incoming]));
      lastSeqRef.current = Math.max(lastSeqRef.current, incoming.seq);

      // My own message echoed back → drop a matching optimistic bubble.
      if (incoming.sender_id === userId) {
        setPending((prev) => prev.filter((p) => p.body !== incoming.body));
      } else if (!incoming.delivered_at) {
        void markDelivered(incoming.id).catch(() => undefined);
        // The thread is open, so a received message is immediately seen.
        void markRead(conversationId, incoming.seq).catch(() => undefined);
      }
    });
    return off;
  }, [conversationId, userId]);

  // Outbox replay confirmations → replace the optimistic bubble with the row.
  useEffect(() => {
    const off = onOutboxSent((item, message) => {
      if (message.conversation_id !== conversationId) return;
      setPending((prev) => prev.filter((p) => p.clientMsgId !== item.id));
      setMessages((prev) => mergeMessages(prev, [message]));
      lastSeqRef.current = Math.max(lastSeqRef.current, message.seq);
    });
    return off;
  }, [conversationId]);

  // Reconnect recovery: refill anything missed while disconnected.
  useEffect(() => {
    const off = onStatus((next) => {
      setStatus(next);
      if (next !== "connected" || !conversationId || !loadedRef.current) return;
      listMessages(conversationId, { sinceSeq: lastSeqRef.current })
        .then((rows) => {
          if (!rows.length) return;
          setMessages((prev) => mergeMessages(prev, rows));
          lastSeqRef.current = Math.max(lastSeqRef.current, rows[rows.length - 1].seq);
        })
        .catch(() => undefined);
    });
    return off;
  }, [conversationId]);

  // Typing indicator (Broadcast; auto-clears if the peer stops without saying so).
  useEffect(() => {
    if (!conversationId) return;
    const off = subscribeToConversation(conversationId, (payload) => {
      if (payload.user_id === userId) return;
      setPeerTyping(payload.typing);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (payload.typing) {
        typingTimeoutRef.current = setTimeout(() => setPeerTyping(false), TYPING_TIMEOUT_MS);
      }
    });
    return () => {
      off();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [conversationId, userId]);

  const send = useCallback(
    async (body: string) => {
      if (!conversationId) return null;
      const trimmed = body.trim();
      if (!trimmed) return null;

      const clientMsgId = newClientMessageId();
      const createdAt = new Date().toISOString();
      setPending((prev) => [...prev, { clientMsgId, body: trimmed, createdAt }]);

      try {
        const message = await sendMessage(conversationId, trimmed, clientMsgId);
        setPending((prev) => prev.filter((p) => p.clientMsgId !== clientMsgId));
        setMessages((prev) => mergeMessages(prev, [message]));
        lastSeqRef.current = Math.max(lastSeqRef.current, message.seq);
        return message;
      } catch (err) {
        // Likely offline — queue it; the outbox replays on reconnect and the
        // server's client_msg_id dedupe makes the retry safe.
        await enqueue({ id: clientMsgId, conversationId, body: trimmed, createdAt });
        throw err;
      }
    },
    [conversationId]
  );

  const notifyTyping = useCallback(
    (typing: boolean) => {
      if (!conversationId) return;
      void sendTyping(conversationId, typing);
    },
    [conversationId]
  );

  const markReadNow = useCallback(() => {
    if (!conversationId || lastSeqRef.current <= 0) return;
    void markRead(conversationId, lastSeqRef.current).catch(() => undefined);
  }, [conversationId]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || !hasMoreRef.current || messages.length === 0) return;
    const oldest = messages[0].seq;
    const rows = await listMessages(conversationId, { beforeSeq: oldest, limit: pageSize }).catch(
      () => [] as Message[]
    );
    hasMoreRef.current = rows.length === pageSize;
    if (rows.length) setMessages((prev) => mergeMessages(prev, rows));
  }, [conversationId, messages, pageSize]);

  return {
    messages,
    pending,
    loading,
    peerTyping,
    status,
    send,
    notifyTyping,
    markReadNow,
    loadOlder,
  };
}
