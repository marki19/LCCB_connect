import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  Alert,
} from "react-native";
import {
  ArrowLeft,
  SquarePen,
  Search,
  Plus,
  Inbox,
  Users,
} from "lucide-react-native";
import Avatar from "../Avatar";
import PeerPicker from "../PeerPicker";
import { usePresence } from "../../contexts/PresenceContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { onConversation, onMessage } from "../../lib/realtime";
import {
  acceptConversation,
  listConversations,
  listRequests,
  listFriends,
  openConversation,
} from "../../lib/messages";
import type { Conversation, Friend } from "../../types";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";
import { IconButton } from "../ui/Button";
import Card from "../ui/Card";
import EmptyState from "../admin/EmptyState";

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
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return date.toLocaleDateString(undefined, { weekday: "short" });
  }
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
  const { profile } = useAuth();

  const [tabChoice, setTabChoice] = useState<"chats" | "requests" | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [received, setReceived] = useState<Conversation[]>([]);
  const [sent, setSent] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const [chats, requests, friendList] = await Promise.all([
        listConversations().catch(() => []),
        listRequests().catch(() => ({ received: [], sent: [] })),
        listFriends(30).catch(() => []),
      ]);
      setConversations(chats);
      setReceived(requests.received);
      setSent(requests.sent);
      setFriends(friendList);
    } catch {
      // Best-effort
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [chats, requests, friendList] = await Promise.all([
          listConversations().catch(() => []),
          listRequests().catch(() => ({ received: [], sent: [] })),
          listFriends(30).catch(() => []),
        ]);
        if (cancelled) return;
        setConversations(chats);
        setReceived(requests.received);
        setSent(requests.sent);
        setFriends(friendList);
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

  const handleStartFriendChat = async (peerId: string) => {
    try {
      const conv = await openConversation(peerId);
      if (conv?.id) {
        onSelect(conv.id);
      }
    } catch {
      setPickerOpen(true);
    }
  };

  const handleAccept = async (conversation: Conversation) => {
    try {
      await acceptConversation(conversation.id);
      await load();
    } catch {
      // Best effort
    }
  };

  const pendingCount = received.length;

  // Filter conversations by search query
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const name = c.peer?.full_name || c.peer?.username || "";
    const lastMsg = c.last_message?.body || "";
    const q = searchQuery.toLowerCase();
    return name.toLowerCase().includes(q) || lastMsg.toLowerCase().includes(q);
  });

  const renderActiveFriends = () => (
    <View style={styles.storiesSection}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesContainer}
      >
        {/* Current user: Add story / note */}
        <Pressable
          style={styles.storyItem}
          onPress={() => Alert.alert("Stories & Notes", "24-hour stories and notes are coming soon!")}
        >
          {/* Note speech bubble */}
          <View style={[styles.noteBubble, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
            <Text numberOfLines={1} style={[styles.noteText, { color: colors.inkSoft }]}>
              Share a note...
            </Text>
          </View>
          <View style={styles.storyAvatarWrap}>
            <Avatar name={profile?.full_name || profile?.username} size={54} />
            <View style={[styles.storyPlusBadge, { backgroundColor: colors.brandSolid }]}>
              <Plus size={13} color={colors.textOnBrandSolid} strokeWidth={3} />
            </View>
          </View>
          <Text numberOfLines={1} style={[styles.storyName, { color: colors.inkFaint }]}>
            Your story
          </Text>
        </Pressable>

        {/* Friend stories & active status */}
        {friends.map((friend) => {
          const peer = friend.peer || (friend as any).user || friend;
          const isOnline = modeOf(peer.id) === "online";
          const firstName = (peer.full_name || peer.username || "Friend").split(" ")[0];

          return (
            <Pressable
              key={peer.id}
              style={styles.storyItem}
              onPress={() => handleStartFriendChat(peer.id)}
            >
              {/* Note placeholder bubble */}
              <View style={[styles.noteBubble, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
                <Text numberOfLines={1} style={[styles.noteText, { color: colors.inkSoft }]}>
                  {isOnline ? "Active now" : "👋"}
                </Text>
              </View>
              <View style={styles.storyAvatarWrap}>
                <Avatar name={peer.full_name || peer.username} size={54} />
                <View
                  style={[
                    styles.onlineDot,
                    {
                      backgroundColor: isOnline ? "#22C55E" : colors.inkFaint,
                      borderColor: colors.surfacePage,
                    },
                  ]}
                />
              </View>
              <Text numberOfLines={1} style={[styles.storyName, { color: colors.ink }]}>
                {firstName}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderChat = (item: Conversation) => {
    const peer = item.peer;
    const active = activeId === item.id;
    const isOnline = peer ? modeOf(peer.id) === "online" : false;
    const hasUnread = item.unread > 0;

    return (
      <Pressable
        key={item.id}
        onPress={() => openThread(item.id)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={({ pressed }) => [
          styles.chatRow,
          {
            backgroundColor: active ? colors.brandWash : pressed ? colors.hoverOverlay : "transparent",
          },
        ]}
      >
        <View style={styles.avatarContainer}>
          <Avatar name={peer?.full_name || peer?.username} size={54} />
          {isOnline ? (
            <View
              style={[
                styles.onlineDot,
                { backgroundColor: "#22C55E", borderColor: colors.surfacePage },
              ]}
            />
          ) : null}
        </View>

        <View style={styles.chatDetails}>
          <View style={styles.chatHeaderRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.chatName,
                {
                  color: colors.ink,
                  fontWeight: hasUnread ? "800" : "600",
                },
              ]}
            >
              {peer?.full_name || peer?.username || "Peer"}
            </Text>
            <Text
              style={[
                styles.chatTime,
                { color: hasUnread ? colors.brand : colors.inkFaint, fontWeight: hasUnread ? "700" : "400" },
              ]}
            >
              {formatWhen(item.last_message?.created_at || item.last_message_at)}
            </Text>
          </View>

          <View style={styles.chatSnippetRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.chatSnippet,
                {
                  color: hasUnread ? colors.ink : colors.inkSoft,
                  fontWeight: hasUnread ? "700" : "400",
                },
              ]}
            >
              {item.last_message
                ? `${item.last_message.sender_id === peer?.id ? "" : "You: "}${item.last_message.body}`
                : "Started a conversation"}
            </Text>
            {hasUnread ? (
              <View style={[styles.unreadBadge, { backgroundColor: colors.brandSolid }]}>
                <Text style={styles.unreadBadgeText}>
                  {item.unread > 99 ? "99+" : item.unread}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderRequest = (item: Conversation, kind: "received" | "sent") => {
    const peer = item.peer;
    const active = activeId === item.id;

    return (
      <View
        key={item.id}
        style={[
          styles.requestCard,
          {
            backgroundColor: active ? colors.brandWash : colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Avatar name={peer?.full_name || peer?.username} size={50} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text numberOfLines={1} style={{ ...TYPE.bodyStrong, color: colors.ink, fontWeight: "700" }}>
            {peer?.full_name || peer?.username || "Peer"}
          </Text>
          <Text numberOfLines={1} style={{ ...TYPE.caption, color: colors.inkSoft }}>
            {item.last_message?.body || "Wants to send you a message"}
          </Text>
          {kind === "received" ? (
            <View style={{ flexDirection: "row", gap: SPACE.x2, marginTop: SPACE.x1 }}>
              <Pressable
                onPress={() => void handleAccept(item)}
                style={[styles.actionBtn, { backgroundColor: colors.brandSolid }]}
              >
                <Text style={{ ...TYPE.micro, color: colors.textOnBrandSolid, fontWeight: "700" }}>Accept</Text>
              </Pressable>
              <Pressable
                onPress={() => openThread(item.id)}
                style={[styles.actionBtn, { backgroundColor: colors.surfaceSunken, borderColor: colors.border, borderWidth: 1 }]}
              >
                <Text style={{ ...TYPE.micro, color: colors.inkSoft, fontWeight: "600" }}>View</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>Pending request...</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      {/* Messenger Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.line,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2 }}>
          {showBack ? (
            <IconButton icon={ArrowLeft} label="Back" onPress={onBack ?? (() => {})} />
          ) : null}
          <Text style={[styles.headerTitle, { color: colors.ink }]}>Chats</Text>
        </View>

        <IconButton
          icon={SquarePen}
          label="New message"
          variant="subtle"
          onPress={() => setPickerOpen(true)}
        />
      </View>

      <View style={{ flex: 1, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        {/* Search Bar */}
        <View style={styles.searchWrap}>
          <View style={[styles.searchBar, { backgroundColor: colors.panelInset, borderColor: colors.line }]}>
            <Search size={16} color={colors.inkFaint} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search conversations..."
              placeholderTextColor={colors.inkFaint}
              style={[styles.searchInput, { color: colors.ink }]}
            />
          </View>
        </View>

        {/* Tab Pills: Chats / Requests */}
        <View style={styles.tabsRow}>
          <Pressable
            onPress={() => setTabChoice("chats")}
            style={[
              styles.tabPill,
              {
                backgroundColor: tab === "chats" ? colors.brandSolid : colors.panel,
                borderColor: tab === "chats" ? colors.brandSolid : colors.line,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === "chats" ? colors.textOnBrandSolid : colors.inkSoft },
              ]}
            >
              Chats
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTabChoice("requests")}
            style={[
              styles.tabPill,
              {
                backgroundColor: tab === "requests" ? colors.brandSolid : colors.panel,
                borderColor: tab === "requests" ? colors.brandSolid : colors.line,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === "requests" ? colors.textOnBrandSolid : colors.inkSoft },
              ]}
            >
              Requests
            </Text>
            {pendingCount > 0 ? (
              <View style={[styles.badgeDot, { backgroundColor: colors.coral }]}>
                <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "800" }}>{pendingCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Main List */}
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="small" color={colors.brand} />
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={tab === "chats" ? filteredConversations : received}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={tab === "chats" ? renderActiveFriends : null}
            contentContainerStyle={{ paddingBottom: SPACE.x8, flexGrow: 1 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
            }
            renderItem={({ item }) =>
              tab === "chats" ? renderChat(item) : renderRequest(item, "received")
            }
            ListFooterComponent={
              tab === "requests" && sent.length > 0 ? (
                <View style={{ paddingHorizontal: SPACE.x4, marginTop: SPACE.x4, gap: SPACE.x2 }}>
                  <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>Sent Requests</Text>
                  {sent.map((item) => renderRequest(item, "sent"))}
                </View>
              ) : null
            }
            ListEmptyComponent={
              <Card style={{ margin: SPACE.x4 }}>
                <EmptyState
                  icon={tab === "chats" ? SquarePen : Inbox}
                  tone="brand"
                  compact
                  title={tab === "chats" ? "No conversations yet" : "No message requests"}
                  body={
                    tab === "chats"
                      ? "Start chatting with your classmates from the new message button."
                      : "Requests from people outside your course or department appear here."
                  }
                  actionLabel={tab === "chats" ? "New message" : undefined}
                  onAction={tab === "chats" ? () => setPickerOpen(true) : undefined}
                />
              </Card>
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

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  searchWrap: {
    paddingHorizontal: SPACE.x4,
    paddingTop: SPACE.x3,
    paddingBottom: SPACE.x2,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x2,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: SPACE.x3,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: "100%",
    padding: 0,
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: SPACE.x4,
    paddingBottom: SPACE.x2,
    gap: SPACE.x2,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x1,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: SPACE.x3,
    paddingVertical: 6,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  badgeDot: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  storiesSection: {
    paddingVertical: SPACE.x2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(150, 150, 150, 0.15)",
    marginBottom: SPACE.x2,
  },
  storiesContainer: {
    paddingHorizontal: SPACE.x4,
    gap: SPACE.x3,
    alignItems: "flex-end",
  },
  storyItem: {
    alignItems: "center",
    width: 66,
    gap: 4,
  },
  noteBubble: {
    maxWidth: 68,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 2,
  },
  noteText: {
    fontSize: 8.5,
    fontWeight: "600",
    textAlign: "center",
  },
  storyAvatarWrap: {
    position: "relative",
  },
  storyPlusBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  storyName: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x3,
  },
  avatarContainer: {
    position: "relative",
  },
  chatDetails: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  chatHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.x2,
  },
  chatName: {
    fontSize: 15,
    flex: 1,
  },
  chatTime: {
    fontSize: 11.5,
  },
  chatSnippetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x2,
  },
  chatSnippet: {
    fontSize: 13,
    flex: 1,
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
    padding: SPACE.x3,
    marginHorizontal: SPACE.x4,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  actionBtn: {
    paddingHorizontal: SPACE.x3,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
});
