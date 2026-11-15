/**
 * ChatsPopover — Messenger-style chats panel.
 * Shows persistent conversation list with presence dots, last messages, unread badges, search, and footer link.
 */

import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Search, Pencil } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { usePresence } from "../../contexts/PresenceContext";
import { useFloatingChat } from "../../contexts/FloatingChatContext";
import { listConversations, listRequests } from "../../lib/messages";
import type { Conversation } from "../../types";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";
import Avatar from "../Avatar";
import { TOP_BAR_HEIGHT } from "./constants";

interface ChatsPopoverProps {
  onClose: () => void;
  unreadCount: number;
}

const formatWhen = (iso?: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function ChatsPopover({ onClose }: ChatsPopoverProps) {
  const { colors } = useTheme();
  const { profile, session } = useAuth();
  const { modeOf } = usePresence();
  const { openChat } = useFloatingChat();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const isGuest = profile?.role === "guest";
  const [loading, setLoading] = useState(() => !isGuest && Boolean(session?.user?.id));

  useEffect(() => {
    if (isGuest || !session?.user?.id) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([listConversations(30), listRequests(10)])
      .then(([convs, reqs]) => {
        if (!cancelled) {
          const all = [...convs, ...(reqs.received || [])];
          const seen = new Set<string>();
          const deduped: Conversation[] = [];
          for (const c of all) {
            if (!seen.has(c.id)) {
              seen.add(c.id);
              deduped.push(c);
            }
          }
          setConversations(deduped);
        }
      })
      .catch((e) => {
        if (e?.status !== 401) {
          console.error("Failed to load conversations in popover:", e);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isGuest, profile?.id, session?.user?.id]);

  const filtered = search.trim()
    ? conversations.filter((c) => {
        const name = (c.peer?.full_name ?? c.peer?.username ?? "").toLowerCase();
        const msg = (c.last_message?.body ?? "").toLowerCase();
        const term = search.toLowerCase();
        return name.includes(term) || msg.includes(term);
      })
    : conversations;

  const handleOpenConversation = (c: Conversation) => {
    onClose();
    if (Platform.OS === "web") {
      openChat({
        conversationId: c.id,
        peerId: c.peer?.id || "",
        peerName: c.peer?.full_name ?? c.peer?.username ?? "Conversation",
        avatarUrl: c.peer?.avatar_url ?? undefined,
      });
    } else {
      router.push(`/messages/${c.id}`);
    }
  };

  const navigate = (href: string) => {
    onClose();
    router.push(href as any);
  };

  const popoverStyle =
    Platform.OS === "web"
      ? ({
          position: "fixed" as any,
          top: TOP_BAR_HEIGHT + 8,
          right: 56,
          zIndex: 1001,
        } as any)
      : { position: "absolute" as any, top: TOP_BAR_HEIGHT + 8, right: 56, zIndex: 1001 };

  return (
    <View
      style={[
        styles.container,
        popoverStyle,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.ink }]}>Chats</Text>
        <Pressable
          onPress={() => navigate("/messages")}
          accessibilityLabel="New message"
          style={[styles.newBtn, { backgroundColor: colors.surfaceSunken }]}
        >
          <Pencil size={16} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </View>

      {/* Search */}
      <View
        style={[
          styles.searchWrap,
          { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
        ]}
      >
        <Search size={14} color={colors.inkFaint} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search Messenger"
          placeholderTextColor={colors.inkFaint}
          style={[styles.searchInput, { color: colors.ink }]}
          accessibilityLabel="Search conversations"
        />
      </View>

      {/* List */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.center}>
            <Text style={[TYPE.body, { color: colors.inkFaint }]}>
              Loading…
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <Text style={[TYPE.body, { color: colors.inkFaint }]}>
              {isGuest ? "Sign in to see messages" : "No conversations yet"}
            </Text>
          </View>
        ) : (
          filtered.map((c) => {
            const peerId = c.peer?.id;
            const online = peerId ? modeOf(peerId) === "online" : false;
            const peerName = c.peer?.full_name ?? c.peer?.username ?? "Conversation";
            const lastText = c.last_message?.body ?? (c.status === "requested" ? "Message request" : "Started a conversation");
            const lastTime = formatWhen(c.last_message?.created_at || c.last_message_at || c.created_at);
            const hasUnread = (c.unread ?? 0) > 0;

            return (
              <Pressable
                key={c.id}
                onPress={() => handleOpenConversation(c)}
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${peerName}`}
                style={({ pressed }) => [
                  styles.item,
                  {
                    backgroundColor: pressed
                      ? colors.hoverOverlay
                      : hasUnread
                      ? colors.brandWash
                      : "transparent",
                  },
                ]}
              >
                {/* Avatar + presence dot */}
                <View style={styles.avatarWrap}>
                  <Avatar
                    name={peerName}
                    size={40}
                  />
                  {online && (
                    <View
                      style={[
                        styles.presenceDot,
                        {
                          backgroundColor: "#10B981",
                          borderColor: colors.surface,
                        },
                      ]}
                    />
                  )}
                </View>

                {/* Name + snippet */}
                <View style={styles.itemText}>
                  <View style={styles.itemHeaderRow}>
                    <Text
                      style={[
                        styles.itemName,
                        { color: colors.ink },
                        hasUnread && { fontWeight: "700" },
                      ]}
                      numberOfLines={1}
                    >
                      {peerName}
                    </Text>
                    {!!lastTime && (
                      <Text style={[styles.itemTime, { color: colors.inkFaint }]}>
                        {lastTime}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.itemSnippet,
                      { color: hasUnread ? colors.brand : colors.inkFaint },
                      hasUnread && { fontWeight: "600" },
                    ]}
                    numberOfLines={1}
                  >
                    {lastText}
                  </Text>
                </View>

                {/* Unread indicator */}
                {hasUnread && (
                  <View style={[styles.unreadBadge, { backgroundColor: colors.brand }]} />
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Footer */}
      <Pressable
        onPress={() => navigate("/messages")}
        accessibilityRole="link"
        accessibilityLabel="See all in Messages"
        style={({ pressed }) => [
          styles.footer,
          {
            borderTopColor: colors.border,
            backgroundColor: pressed ? colors.hoverOverlay : "transparent",
          },
        ]}
      >
        <Text style={[styles.footerText, { color: colors.brand }]}>
          See all in Messages
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 360,
    maxHeight: 540,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 12,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.x4,
    paddingTop: SPACE.x4,
    paddingBottom: SPACE.x2,
  },
  title: {
    ...TYPE.title,
    fontSize: 20,
  },
  newBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x2,
    marginHorizontal: SPACE.x4,
    marginBottom: SPACE.x2,
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    height: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    outlineStyle: "none",
  } as any,
  list: {
    flex: 1,
  },
  center: {
    paddingVertical: SPACE.x8,
    alignItems: "center",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x2,
  },
  avatarWrap: {
    position: "relative",
    flexShrink: 0,
  },
  presenceDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  itemText: {
    flex: 1,
    minWidth: 0,
  },
  itemHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.x2,
  },
  itemName: {
    ...TYPE.body,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
    flex: 1,
  },
  itemTime: {
    fontSize: 11,
    flexShrink: 0,
  },
  itemSnippet: {
    ...TYPE.caption,
    fontSize: 12,
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
    flexShrink: 0,
  },
  footer: {
    paddingVertical: SPACE.x3,
    alignItems: "center",
    borderTopWidth: 1,
  },
  footerText: {
    ...TYPE.caption,
    fontSize: 13,
    fontWeight: "700",
  },
});
