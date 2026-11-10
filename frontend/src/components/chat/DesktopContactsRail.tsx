/**
 * DesktopContactsRail — Facebook-style desktop "Contacts" right rail.
 * Visible on wide desktop viewports (width >= 1200px).
 * Displays classmates/friends with live presence and one-click floating chat launcher.
 */

import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Search, X } from "lucide-react-native";
import Avatar from "../Avatar";
import { useTheme } from "../../contexts/ThemeContext";
import { usePresence } from "../../contexts/PresenceContext";
import { useFloatingChat } from "../../contexts/FloatingChatContext";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";

interface DesktopContactsRailProps {
  peers: any[];
}

export default function DesktopContactsRail({ peers }: DesktopContactsRailProps) {
  const { colors } = useTheme();
  const { modeOf } = usePresence();
  const { openChat } = useFloatingChat();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Sort: online peers first, then alphabetical
  const sortedPeers = useMemo(() => {
    const list = [...peers];
    return list.sort((a, b) => {
      const aOnline = modeOf(a.id) === "online" ? 1 : 0;
      const bOnline = modeOf(b.id) === "online" ? 1 : 0;
      if (aOnline !== bOnline) return bOnline - aOnline;
      const aName = a.full_name || a.username || "";
      const bName = b.full_name || b.username || "";
      return aName.localeCompare(bName);
    });
  }, [peers, modeOf]);

  const filteredPeers = useMemo(() => {
    if (!query.trim()) return sortedPeers;
    const q = query.toLowerCase();
    return sortedPeers.filter((p) => {
      const name = (p.full_name || p.username || "").toLowerCase();
      return name.includes(q);
    });
  }, [sortedPeers, query]);

  return (
    <View style={[styles.rail, { borderLeftColor: colors.line }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.inkFaint }]}>Contacts</Text>
        <TouchableOpacity
          onPress={() => {
            setSearchOpen((prev) => !prev);
            if (searchOpen) setQuery("");
          }}
          style={[styles.headerBtn, { backgroundColor: searchOpen ? colors.hoverOverlay : "transparent" }]}
          accessibilityLabel="Search contacts"
        >
          {searchOpen ? (
            <X size={16} color={colors.inkSoft} />
          ) : (
            <Search size={16} color={colors.inkSoft} />
          )}
        </TouchableOpacity>
      </View>

      {/* Search Input (Expandable) */}
      {searchOpen && (
        <View
          style={[
            styles.searchWrap,
            { backgroundColor: colors.surfaceSunken, borderColor: colors.line },
          ]}
        >
          <Search size={13} color={colors.inkFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search contacts…"
            placeholderTextColor={colors.inkFaint}
            style={[styles.searchInput, { color: colors.ink }]}
            autoFocus
          />
        </View>
      )}

      {/* Contacts List */}
      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {filteredPeers.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: colors.inkFaint }]}>
              {query.trim() ? "No contacts found" : "No classmates online"}
            </Text>
          </View>
        ) : (
          filteredPeers.map((peer) => {
            const isOnline = modeOf(peer.id) === "online";
            const displayName = peer.full_name || peer.username || "Student";
            return (
              <Pressable
                key={peer.id}
                onPress={() =>
                  openChat({
                    peerId: peer.id,
                    peerName: displayName,
                    avatarUrl: peer.avatar_url,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${displayName}`}
                style={({ pressed }) => [
                  styles.contactRow,
                  {
                    backgroundColor: pressed ? colors.hoverOverlay : "transparent",
                  },
                ]}
              >
                <View style={styles.avatarWrap}>
                  <Avatar name={displayName} size={34} />
                  {isOnline && (
                    <View
                      style={[
                        styles.presenceDot,
                        { borderColor: colors.surfacePage },
                      ]}
                    />
                  )}
                </View>
                <Text
                  style={[styles.contactName, { color: colors.ink }]}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 260,
    display: "flex",
    flexDirection: "column",
    paddingTop: SPACE.x4,
    paddingHorizontal: SPACE.x2,
    borderLeftWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.x2,
    paddingBottom: SPACE.x2,
  },
  title: {
    ...TYPE.caption,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  headerBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    marginHorizontal: SPACE.x2,
    marginBottom: SPACE.x2,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    outlineStyle: "none",
  } as any,
  list: {
    flex: 1,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: RADIUS.md,
    marginVertical: 1,
  },
  avatarWrap: {
    position: "relative",
    flexShrink: 0,
  },
  presenceDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
    borderWidth: 2,
  },
  contactName: {
    ...TYPE.body,
    fontSize: 13.5,
    fontWeight: "500",
    flex: 1,
  },
  emptyWrap: {
    paddingVertical: SPACE.x6,
    alignItems: "center",
    paddingHorizontal: SPACE.x2,
  },
  emptyText: {
    ...TYPE.caption,
    fontSize: 12,
    textAlign: "center",
  },
});

