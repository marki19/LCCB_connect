import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, MessageSquarePlus, Check, Clock } from "lucide-react-native";
import Avatar from "../../src/components/Avatar";
import PeerPicker from "../../src/components/PeerPicker";
import { usePresence } from "../../src/contexts/PresenceContext";
import { onConversation, onMessage } from "../../src/lib/realtime";
import { acceptConversation, listConversations, listRequests } from "../../src/lib/messages";
import type { Conversation } from "../../src/types";

/**
 * Inbox (Messaging_plan.md §6, §12): "Chats" = active threads, "Requests" =
 * pending (`requested`) threads. Live-updates from Realtime with a debounce so
 * a burst of inserts triggers one refetch.
 */

const formatWhen = (iso?: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function MessagesInbox() {
  const router = useRouter();
  const { modeOf } = usePresence();

  const [tab, setTab] = useState<"chats" | "requests">("chats");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [received, setReceived] = useState<Conversation[]>([]);
  const [sent, setSent] = useState<Conversation[]>([]);
  const [ignored, setIgnored] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const [chats, requests] = await Promise.all([listConversations(), listRequests()]);
      setConversations(chats);
      setReceived(requests.received);
      setSent(requests.sent);
    } catch {
      // Best-effort; the next realtime event or pull-to-refresh retries.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [chats, requests] = await Promise.all([listConversations(), listRequests()]);
        if (cancelled) return;
        setConversations(chats);
        setReceived(requests.received);
        setSent(requests.sent);
      } catch {
        // Best-effort; the next realtime event or pull-to-refresh retries.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Coalesce realtime bursts into one refetch.
  useEffect(() => {
    const schedule = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => void load(), 400);
    };
    const offConversation = onConversation(schedule);
    const offMessage = onMessage(schedule);
    return () => {
      offConversation();
      offMessage();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const openThread = (id: string) => router.push(`/messages/${id}`);

  const handleAccept = async (conversation: Conversation) => {
    try {
      await acceptConversation(conversation.id);
      await load();
    } catch {
      // Surface nothing intrusive; the row stays for a retry.
    }
  };

  const pendingCount = received.filter((c) => !ignored[c.id]).length;

  const renderChat = ({ item }: { item: Conversation }) => {
    const peer = item.peer;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => openThread(item.id)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#F1F5F9",
        }}
      >
        <Avatar
          name={peer?.full_name || peer?.username}
          size={52}
          showPresence
          mode={peer ? modeOf(peer.id) : null}
        />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: "#0F172A", flex: 1, marginRight: 8 }}>
              {peer?.full_name || peer?.username || "Peer"}
            </Text>
            <Text style={{ fontSize: 12, color: "#94A3B8" }}>
              {formatWhen(item.last_message?.created_at || item.last_message_at)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: item.unread > 0 ? "#0F172A" : "#64748B", fontWeight: item.unread > 0 ? "600" : "400" }}>
              {item.last_message
                ? `${item.last_message.sender_id === peer?.id ? "" : "You: "}${item.last_message.body}`
                : "No messages yet"}
            </Text>
            {item.unread > 0 && (
              <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#1A56DB", alignItems: "center", justifyContent: "center", paddingHorizontal: 6, marginLeft: 8 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>{item.unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderRequest = ({ item, kind }: { item: Conversation; kind: "received" | "sent" }) => {
    const peer = item.peer;
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#F1F5F9",
        }}
      >
        <Avatar name={peer?.full_name || peer?.username} size={48} showPresence mode={peer ? modeOf(peer.id) : null} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: "#0F172A" }}>
            {peer?.full_name || peer?.username || "Peer"}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>
            {kind === "received" ? "Wants to message you" : "Request sent · pending"}
            {item.last_message?.body ? ` · ${item.last_message.body}` : ""}
          </Text>
        </View>

        {kind === "received" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              onPress={() => setIgnored((prev) => ({ ...prev, [item.id]: true }))}
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: "#F1F5F9" }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748B" }}>Ignore</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleAccept(item)}
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: "#1A56DB" }}
            >
              <Check size={14} color="#FFFFFF" />
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF", marginLeft: 5 }}>Accept</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Clock size={14} color="#94A3B8" />
            <Text style={{ fontSize: 12, color: "#94A3B8", marginLeft: 5 }}>Pending</Text>
          </View>
        )}
      </View>
    );
  };

  const visibleReceived = received.filter((c) => !ignored[c.id]);
  const data: Conversation[] = tab === "chats" ? conversations : visibleReceived;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#F1F5F9",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 6, marginRight: 4 }}>
            <ArrowLeft size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#0F172A" }}>Messages</Text>
        </View>
        <TouchableOpacity
          onPress={() => setPickerOpen(true)}
          style={{ width: 40, height: 40, backgroundColor: "#EFF6FF", borderRadius: 20, alignItems: "center", justifyContent: "center" }}
        >
          <MessageSquarePlus size={20} color="#1A56DB" />
        </TouchableOpacity>
      </View>

      {/* Segmented control */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
        {(["chats", "requests"] as const).map((key) => {
          const active = tab === key;
          const label = key === "chats" ? "Chats" : "Requests";
          const badge = key === "requests" ? pendingCount : 0;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 16,
                backgroundColor: active ? "#1A56DB" : "#F1F5F9",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: active ? "#FFFFFF" : "#475569" }}>{label}</Text>
              {badge > 0 && (
                <View style={{ marginLeft: 6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: active ? "#FFFFFF" : "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: active ? "#1A56DB" : "#FFFFFF" }}>{badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="small" color="#1A56DB" />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, marginTop: 12 }}
          data={data}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) =>
            tab === "chats" ? renderChat({ item }) : renderRequest({ item, kind: "received" })
          }
          ListFooterComponent={
            tab === "requests" && sent.length > 0 ? (
              <View style={{ borderTopWidth: 1, borderTopColor: "#F1F5F9", marginTop: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#94A3B8", letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, textTransform: "uppercase" }}>
                  Sent
                </Text>
                {sent.map((item) => (
                  <View key={`sent-${item.id}`}>{renderRequest({ item, kind: "sent" })}</View>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 72, paddingHorizontal: 32 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <MessageSquarePlus size={24} color="#1A56DB" />
              </View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#1E293B", marginBottom: 6 }}>
                {tab === "chats" ? "No conversations yet" : "No message requests"}
              </Text>
              <Text style={{ fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 18 }}>
                {tab === "chats"
                  ? "Start a conversation from the compose button."
                  : "Requests from people outside your messaging policy appear here."}
              </Text>
            </View>
          }
        />
      )}

      <PeerPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onOpened={(id) => openThread(id)}
      />
    </SafeAreaView>
  );
}
