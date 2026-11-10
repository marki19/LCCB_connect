/**
 * ChatsPopover — Messenger-style chats panel.
 * Shows conversation list with presence dots, unread badges, search, and footer link.
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
import { apiJson } from "../../lib/api";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";
import Avatar from "../Avatar";
import { TOP_BAR_HEIGHT } from "./constants";

interface ChatsPopoverProps {
  onClose: () => void;
  unreadCount: number;
}

export default function ChatsPopover({ onClose, unreadCount }: ChatsPopoverProps) {
  const { colors } = useTheme();
  const { profile, session } = useAuth();
  const { modeOf } = usePresence();
  const { openChat } = useFloatingChat();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [peers, setPeers] = useState<any[]>([]);
  const isGuest = profile?.role === "guest";
  const [loading, setLoading] = useState(() => !isGuest && Boolean(session?.user?.id));

  useEffect(() => {
    if (isGuest || !session?.user?.id) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiJson<any[]>("/friends?limit=20")
      .then((rows) => {
        if (!cancelled) {
          const list = rows.map((r: any) => r.peer ?? r).filter(Boolean);
          setPeers(list.filter((p: any) => p.id !== profile?.id));
        }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isGuest, profile?.id, session?.user?.id]);

  const filtered = search.trim()
    ? peers.filter((p) =>
        (p.full_name ?? p.username ?? "")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : peers;

  const handleOpenChat = (peer: any) => {
    onClose();
    if (Platform.OS === "web") {
      openChat({
        peerId: peer.id,
        peerName: peer.full_name ?? peer.username,
        avatarUrl: peer.avatar_url,
      });
    } else {
      router.push(`/messages/${peer.id}`);
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
          filtered.map((peer) => {
            const online = modeOf(peer.id) === "online";
            return (
              <Pressable
                key={peer.id}
                onPress={() => handleOpenChat(peer)}
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${peer.full_name ?? peer.username}`}
                style={({ pressed }) => [
                  styles.item,
                  {
                    backgroundColor: pressed
                      ? colors.hoverOverlay
                      : "transparent",
                  },
                ]}
              >
                {/* Avatar + presence dot */}
                <View style={styles.avatarWrap}>
                  <Avatar
                    name={peer.full_name ?? peer.username}
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
                  <Text
                    style={[styles.itemName, { color: colors.ink }]}
                    numberOfLines={1}
                  >
                    {peer.full_name ?? peer.username}
                  </Text>
                  <Text
                    style={[styles.itemSnippet, { color: colors.inkFaint }]}
                    numberOfLines={1}
                  >
                    Tap to start a conversation
                  </Text>
                </View>
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
  itemName: {
    ...TYPE.body,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  itemSnippet: {
    ...TYPE.caption,
    fontSize: 12,
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
