import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { ArrowLeft, MessageSquarePlus, Check, Clock, Inbox } from "lucide-react-native";
import Avatar from "../Avatar";
import PeerPicker from "../PeerPicker";
import { usePresence } from "../../contexts/PresenceContext";
import { useTheme } from "../../contexts/ThemeContext";
import { onConversation, onMessage } from "../../lib/realtime";
import { acceptConversation, listConversations, listRequests } from "../../lib/messages";
import type { Conversation } from "../../types";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";
import Button, { IconButton } from "../ui/Button";
import Card from "../ui/Card";
import EmptyState from "../admin/EmptyState";

/**
 * Inbox (Messaging_plan.md §6, §12): "Chats" = active threads, "Requests" =
 * pending (`requested`) threads. Live-updates from Realtime with a debounce so
 * a burst of inserts triggers one refetch.
 *
 * Rendered two ways: as the full page on phones/tablets, and as the left pane
 * of the desktop split view (see `MessagesSplit`). It never owns navigation
 * itself — the host decides whether a tap pushes a route or swaps the pane.
 */

type InboxPaneProps = {
  onSelect: (conversationId: string) => void;
  /** Highlighted thread in the desktop split view. */
  activeId?: string | null;
  /** Show the back affordance (full-page presentation only). */
  showBack?: boolean;
  onBack?: () => void;
};


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

export default function InboxPane({
  onSelect,
  activeId = null,
  showBack = false,
  onBack,
}: InboxPaneProps) {
  const { modeOf } = usePresence();
  const { colors } = useTheme();

  const [tabChoice, setTabChoice] = useState<"chats" | "requests" | null>(null);
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

  // A deep-linked thread may live under Requests; fall back to the tab that
  // holds it until the reader picks a tab themselves.
  const activeIsRequest =
    !!activeId &&
    !conversations.some((c) => c.id === activeId) &&
    (received.some((c) => c.id === activeId) || sent.some((c) => c.id === activeId));
  const tab: "chats" | "requests" = tabChoice ?? (activeIsRequest ? "requests" : "chats");

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const openThread = (id: string) => onSelect(id);

  const handleAccept = async (conversation: Conversation) => {
    try {
      await acceptConversation(conversation.id);
      await load();
    } catch {
      // Surface nothing intrusive; the row stays for a retry.
    }
  };

  const pendingCount = received.filter((c) => !ignored[c.id]).length;

  const renderChat = (item: Conversation) => {
    const peer = item.peer;
    const active = activeId === item.id;
    return (
      <Pressable
        onPress={() => openThread(item.id)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`Open conversation with ${
          peer?.full_name || peer?.username || "peer"
        }${item.unread > 0 ? `, ${item.unread} unread` : ""}`}
        onFocus={() => {}}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.x3,
          padding: SPACE.x4,
          borderRadius: RADIUS.lg,
          borderWidth: 1,
          borderColor: active
            ? colors.brand
            : item.unread > 0
            ? colors.primarySurfaceAlt
            : colors.line,
          backgroundColor: active
            ? colors.primarySurface
            : item.unread > 0
            ? colors.primarySurface
            : colors.panel,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Avatar
          name={peer?.full_name || peer?.username}
          size={52}
          showPresence
          mode={peer ? modeOf(peer.id) : null}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: SPACE.x2,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                ...TYPE.bodyStrong,
                fontWeight: item.unread > 0 ? "700" : "600",
                color: colors.ink,
                flex: 1,
              }}
            >
              {peer?.full_name || peer?.username || "Peer"}
            </Text>
            <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>
              {formatWhen(item.last_message?.created_at || item.last_message_at)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3, gap: SPACE.x2 }}>
            <Text
              numberOfLines={1}
              style={{
                ...TYPE.caption,
                flex: 1,
                color: item.unread > 0 ? colors.ink : colors.inkFaint,
                fontWeight: item.unread > 0 ? "600" : "400",
              }}
            >
              {item.last_message
                ? `${item.last_message.sender_id === peer?.id ? "" : "You: "}${
                    item.last_message.body
                  }`
                : "No messages yet"}
            </Text>
            {item.unread > 0 && (
              <View
                style={{
                  minWidth: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: colors.brandSolid,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 6,
                }}
              >
                <Text style={{ color: colors.textOnBrandSolid, fontSize: 11, fontWeight: "800" }}>
                  {item.unread}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderRequest = (item: Conversation, kind: "received" | "sent") => {
    const peer = item.peer;
    const active = activeId === item.id;
    const rowStyle = {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACE.x3,
      padding: SPACE.x4,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: active ? colors.brand : colors.line,
      backgroundColor: active ? colors.primarySurface : colors.panel,
    };

    const content = (
      <>
        <Avatar
          name={peer?.full_name || peer?.username}
          size={48}
          showPresence
          mode={peer ? modeOf(peer.id) : null}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ ...TYPE.bodyStrong, fontWeight: "700", color: colors.ink }}
          >
            {peer?.full_name || peer?.username || "Peer"}
          </Text>
          <Text
            numberOfLines={1}
            style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 3 }}
          >
            {kind === "received" ? "Wants to message you" : "Request sent · pending"}
            {item.last_message?.body ? ` · ${item.last_message.body}` : ""}
          </Text>
        </View>

        {kind === "received" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2 }}>
            <Button
              label="Ignore"
              variant="ghost"
              size="sm"
              onPress={() => setIgnored((prev) => ({ ...prev, [item.id]: true }))}
            />
            <Button
              label="Accept"
              size="sm"
              icon={Check}
              onPress={() => void handleAccept(item)}
            />
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x1 }}>
            <Clock size={14} color={colors.inkFaint} />
            <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>Pending</Text>
          </View>
        )}
      </>
    );

    // A sent request is still a thread you can keep writing in, so let it open.
    if (kind === "sent") {
      return (
        <Pressable
          onPress={() => openThread(item.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          accessibilityLabel={`Open conversation with ${
            peer?.full_name || peer?.username || "peer"
          }, request pending`}
          onFocus={() => {}}
          style={({ pressed }) => ({ ...rowStyle, opacity: pressed ? 0.85 : 1 })}
        >
          {content}
        </Pressable>
      );
    }

    return <View style={rowStyle}>{content}</View>;
  };

  const visibleReceived = received.filter((c) => !ignored[c.id]);
  const data: Conversation[] = tab === "chats" ? conversations : visibleReceived;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.x3,
          paddingHorizontal: SPACE.x4,
          minHeight: 64,
          backgroundColor: colors.panel,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        {showBack ? (
          <IconButton icon={ArrowLeft} label="Back" onPress={onBack ?? (() => {})} />
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>Inbox</Text>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>Messages</Text>
        </View>
        <IconButton
          icon={MessageSquarePlus}
          label="Start a new conversation"
          variant="subtle"
          onPress={() => setPickerOpen(true)}
        />
      </View>

      <View
        style={{
          width: "100%",
          maxWidth: 760,
          alignSelf: "center",
          flex: 1,
        }}
      >
        {/* Segmented control */}
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: "row",
            paddingHorizontal: SPACE.x4,
            paddingTop: SPACE.x4,
            gap: SPACE.x2,
          }}
        >
          {(["chats", "requests"] as const).map((key) => {
            const active = tab === key;
            const label = key === "chats" ? "Chats" : "Requests";
            const badge = key === "requests" ? pendingCount : 0;
            return (
              <Pressable
                key={key}
                onPress={() => setTabChoice(key)}
                accessibilityRole="tab"
                accessibilityLabel={`${label}${badge > 0 ? `, ${badge} pending` : ""}`}
                accessibilityState={{ selected: active }}
                onFocus={() => {}}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  minHeight: 40,
                  paddingHorizontal: SPACE.x4,
                  borderRadius: RADIUS.pill,
                  borderWidth: 1,
                  borderColor: active ? colors.brandSolid : colors.line,
                  backgroundColor: active
                    ? colors.brandSolid
                    : pressed
                    ? colors.surfaceSunken
                    : colors.panel,
                })}
              >
                <Text
                  style={{
                    ...TYPE.caption,
                    fontWeight: "700",
                    color: active ? colors.textOnBrandSolid : colors.inkSoft,
                  }}
                >
                  {label}
                </Text>
                {badge > 0 && (
                  <View
                    style={{
                      marginLeft: SPACE.x2,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: active ? colors.textOnBrandSolid : colors.coral,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 5,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color: active ? colors.brandSolid : colors.textOnDanger,
                      }}
                    >
                      {badge}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            style={{ flex: 1, marginTop: SPACE.x4 }}
            data={data}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: SPACE.x4,
              paddingBottom: SPACE.x10,
              gap: SPACE.x2,
              flexGrow: 1,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            renderItem={({ item }) =>
              tab === "chats" ? renderChat(item) : renderRequest(item, "received")
            }
            ListFooterComponent={
              tab === "requests" && sent.length > 0 ? (
                <View style={{ marginTop: SPACE.x4, gap: SPACE.x2 }}>
                  <Text
                    style={{
                      ...TYPE.micro,
                      color: colors.inkFaint,
                      paddingHorizontal: SPACE.x1,
                    }}
                  >
                    Sent
                  </Text>
                  {sent.map((item) => (
                    <View key={`sent-${item.id}`}>{renderRequest(item, "sent")}</View>
                  ))}
                </View>
              ) : undefined
            }
            ListEmptyComponent={
              // The SENT section below is still content, so don't claim the
              // whole Requests tab is empty when only the received side is.
              tab === "requests" && sent.length > 0 ? undefined : (
                <Card style={{ marginTop: SPACE.x4 }}>
                  <EmptyState
                    icon={tab === "chats" ? MessageSquarePlus : Inbox}
                    tone="brand"
                    compact
                    title={tab === "chats" ? "No conversations yet" : "No message requests"}
                    body={
                      tab === "chats"
                        ? "Start a conversation from the compose button."
                        : "Requests from people outside your messaging policy appear here."
                    }
                    actionLabel={tab === "chats" ? "New message" : undefined}
                    onAction={tab === "chats" ? () => setPickerOpen(true) : undefined}
                  />
                </Card>
              )
            }
          />
        )}
      </View>

      <PeerPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onOpened={(id) => openThread(id)}
        mode="message"
      />
    </View>
  );
}
