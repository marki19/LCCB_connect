import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Send, Check, CheckCheck, Clock, ShieldAlert } from "lucide-react-native";
import Avatar, { PRESENCE_LABELS } from "../../src/components/Avatar";
import { useAuth } from "../../src/contexts/AuthContext";
import { usePresence } from "../../src/contexts/PresenceContext";
import { useConversationRealtime, type PendingMessage } from "../../src/hooks/useConversationRealtime";
import { acceptConversation, listConversations, listRequests } from "../../src/lib/messages";
import { messageStatus, type Conversation, type Message } from "../../src/types";

/**
 * 1:1 thread (Messaging_plan.md §6, §9, §12): bubbles + sent/delivered/seen
 * ticks + typing + the "requested" banner/Accept + offline pending bubbles.
 */

const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function Ticks({ message }: { message: Message }) {
  const status = messageStatus(message);
  if (status === "seen") return <CheckCheck size={13} color="#BFDBFE" />;
  if (status === "delivered") return <CheckCheck size={13} color="#94A3B8" />;
  return <Check size={13} color="#94A3B8" />;
}

export default function ThreadScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id ?? null;
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { modeOf } = usePresence();

  const { messages, pending, loading, peerTyping, send, notifyTyping, loadOlder } =
    useConversationRealtime(conversationId);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve the thread + peer (works for deep links, not just inbox taps).
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    (async () => {
      try {
        const [chats, requests] = await Promise.all([listConversations(), listRequests()]);
        const found = [...chats, ...requests.received, ...requests.sent].find(
          (c) => c.id === conversationId
        );
        if (!cancelled && found) setConversation(found);
      } catch {
        // Header falls back to a generic label.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const peer = conversation?.peer ?? null;
  const peerName = peer?.full_name || peer?.username || "Conversation";
  const peerMode = peer ? modeOf(peer.id) : null;

  const isRequester = conversation?.requester_id === userId;
  const isRequested = conversation?.status === "requested";
  const canReply = !isRequested || isRequester; // pre-accept, only the requester may send

  const subtitle = peerTyping
    ? "typing…"
    : peerMode
      ? PRESENCE_LABELS[peerMode]
      : "Offline";

  const displayMessages = useMemo(() => messages, [messages]);

  const handleDraftChange = (text: string) => {
    setDraft(text);
    if (!conversationId) return;
    if (text.trim()) notifyTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => notifyTyping(false), 2000);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending || !canReply) return;
    setDraft("");
    notifyTyping(false);
    setSending(true);
    try {
      await send(text);
    } catch {
      // Queued in the outbox; the pending bubble stays until it flushes.
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async () => {
    if (!conversation) return;
    setAccepting(true);
    try {
      await acceptConversation(conversation.id);
      setConversation({ ...conversation, status: "active" });
    } catch {
      // Leave the banner so the user can retry.
    } finally {
      setAccepting(false);
    }
  };

  const renderBubble = (message: Message) => {
    const mine = message.sender_id === userId;
    return (
      <View
        style={{
          flexDirection: "row",
          justifyContent: mine ? "flex-end" : "flex-start",
          marginBottom: 8,
          paddingHorizontal: 12,
        }}
      >
        <View
          style={{
            maxWidth: "78%",
            backgroundColor: mine ? "#1A56DB" : "#FFFFFF",
            borderRadius: 16,
            borderBottomRightRadius: mine ? 4 : 16,
            borderBottomLeftRadius: mine ? 16 : 4,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderWidth: mine ? 0 : 1,
            borderColor: "#E2E8F0",
          }}
        >
          <Text style={{ fontSize: 15, lineHeight: 20, color: mine ? "#FFFFFF" : "#0F172A" }}>
            {message.body}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 3, gap: 4 }}>
            <Text style={{ fontSize: 10, color: mine ? "#DBEAFE" : "#94A3B8" }}>
              {formatClock(message.created_at)}
            </Text>
            {mine && <Ticks message={message} />}
          </View>
        </View>
      </View>
    );
  };

  const renderPending = (item: PendingMessage) => (
    <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 8, paddingHorizontal: 12 }}>
      <View
        style={{
          maxWidth: "78%",
          backgroundColor: "#93B4F5",
          borderRadius: 16,
          borderBottomRightRadius: 4,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <Text style={{ fontSize: 15, lineHeight: 20, color: "#FFFFFF" }}>{item.body}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 3, gap: 4 }}>
          <Clock size={11} color="#EEF2FF" />
          <Text style={{ fontSize: 10, color: "#EEF2FF" }}>Sending…</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F0F7FF" }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#F1F5F9",
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6, marginRight: 4 }}>
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Avatar name={peerName} size={40} showPresence mode={peerMode} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", color: "#0F172A" }}>
            {peerName}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: peerTyping ? "#1A56DB" : "#64748B", fontWeight: peerTyping ? "600" : "400" }}>
            {subtitle}
          </Text>
        </View>
      </View>

      {/* Requested banner */}
      {isRequested && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#FFFBEB",
            borderBottomWidth: 1,
            borderBottomColor: "#FDE68A",
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <ShieldAlert size={18} color="#D97706" />
          <Text style={{ flex: 1, fontSize: 12.5, color: "#92400E", marginLeft: 8, lineHeight: 17 }}>
            {isRequester
              ? "Request sent. You can keep messaging — they'll see it under Requests."
              : "This is a message request. Accept to reply."}
          </Text>
          {!isRequester && (
            <TouchableOpacity
              onPress={handleAccept}
              disabled={accepting}
              style={{ backgroundColor: "#D97706", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, opacity: accepting ? 0.6 : 1 }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>Accept</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="small" color="#1A56DB" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={{ flex: 1 }}
            data={displayMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: 12 }}
            renderItem={({ item }) => renderBubble(item)}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={
              messages.length >= 50 ? (
                <TouchableOpacity onPress={() => void loadOlder()} style={{ alignItems: "center", paddingVertical: 8 }}>
                  <Text style={{ fontSize: 12, color: "#1A56DB", fontWeight: "600" }}>Load earlier messages</Text>
                </TouchableOpacity>
              ) : null
            }
            ListFooterComponent={<>{pending.map((p) => <View key={p.clientMsgId}>{renderPending(p)}</View>)}</>}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingTop: 64, paddingHorizontal: 32 }}>
                <Text style={{ fontSize: 14, color: "#94A3B8", textAlign: "center" }}>
                  No messages yet. Say hello to {peerName}.
                </Text>
              </View>
            }
          />
        )}

        {/* Composer */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderTopColor: "#F1F5F9",
          }}
        >
          <TextInput
            value={draft}
            onChangeText={handleDraftChange}
            editable={canReply}
            placeholder={canReply ? "Message…" : "Accept the request to reply"}
            placeholderTextColor="#94A3B8"
            multiline
            style={{
              flex: 1,
              maxHeight: 120,
              backgroundColor: "#F1F5F9",
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 15,
              color: "#0F172A",
              opacity: canReply ? 1 : 0.6,
            }}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!draft.trim() || !canReply || sending}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: draft.trim() && canReply ? "#1A56DB" : "#CBD5E1",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 8,
            }}
          >
            <Send size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
