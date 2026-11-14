import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { UserPlus } from "lucide-react-native";
import Avatar from "./Avatar";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { listFriendSuggestions, sendFriendRequest } from "../lib/messages";
import { RADIUS, SPACE, TYPE } from "../lib/tokens";
import type { FriendSuggestion } from "../types";

/**
 * "People you may know" strip in the news feed. Horizontal scroll only —
 * no swipe actions. Cards: avatar, name (2 lines), department (1 line), and
 * a small add-friend pill. A trailing "See all" card routes to Find Friends.
 *
 * Renders nothing for guests, while loading, or when the server returns an
 * empty list — the feed never shows an empty shell for this.
 */

const CARD_WIDTH = 132;
const CARD_GAP = SPACE.x2;

export default function SuggestionCarousel() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, isGuest } = useAuth();
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Guests and signed-out states are hidden by the render gate below; no
    // synchronous setState here (react-hooks/set-state-in-effect).
    if (!user || isGuest) return;
    let cancelled = false;
    listFriendSuggestions(8)
      .then((rows: any) => {
        if (!cancelled) setSuggestions(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, isGuest]);

  const addFriend = useCallback(async (id: string) => {
    setPendingId(id);
    try {
      await sendFriendRequest(id);
      setSentIds((prev) => new Set(prev).add(id));
    } catch {
      // The friends screen shows authoritative state; a silent failure here
      // just leaves the pill tappable.
    } finally {
      setPendingId(null);
    }
  }, []);

  const snapInterval = CARD_WIDTH + CARD_GAP;

  const renderItem = useCallback(
    ({ item }: { item: FriendSuggestion }) => {
      const sent = sentIds.has(item.id);
      const subtitle = item.department_name || item.course_name || "LCCB student";
      return (
        <Pressable
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => router.push(`/profile/${item.id}`)}
          accessibilityRole="link"
          accessibilityLabel={`View ${item.full_name || item.username || "profile"}`}
        >
          <Avatar name={item.full_name || item.username} size={56} />
          <Text
            numberOfLines={2}
            style={[styles.name, { color: colors.textPrimary }]}
          >
            {item.full_name || item.username || "LCCB member"}
          </Text>
          <Text numberOfLines={1} style={[styles.dept, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
          <Pressable
            style={[
              styles.addPill,
              {
                backgroundColor: sent ? colors.successSurface : colors.actionSurface,
              },
            ]}
            onPress={(e) => {
              e?.stopPropagation?.();
              if (!sent && !pendingId) {
                void addFriend(item.id);
              }
            }}
            disabled={sent || pendingId === item.id}
            accessibilityRole="button"
            accessibilityLabel={sent ? "Friend request sent" : "Add friend"}
          >
            {pendingId === item.id ? (
              <ActivityIndicator size="small" color={colors.action} />
            ) : (
              <>
                {sent ? null : <UserPlus size={12} color={colors.action} />}
                <Text
                  style={[
                    styles.addPillText,
                    { color: sent ? colors.successText : colors.action },
                  ]}
                >
                  {sent ? "Sent" : "Add"}
                </Text>
              </>
            )}
          </Pressable>
        </Pressable>
      );
    },
    [colors, pendingId, sentIds, addFriend, router]
  );

  const renderFooter = useCallback(
    () => (
      <Pressable
        style={[
          styles.card,
          styles.seeAllCard,
          { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
        ]}
        onPress={() => router.push("/find-friends")}
        accessibilityRole="button"
        accessibilityLabel="See all suggested people"
      >
        <UserPlus size={22} color={colors.action} />
        <Text style={[styles.seeAllText, { color: colors.action }]}>See all</Text>
      </Pressable>
    ),
    [colors, router]
  );

  if (!user || isGuest || loading || suggestions.length === 0) return null;

  return (
    <View style={[styles.wrap, { borderColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.textSecondary }]}>
        People you may know
      </Text>
      <FlatList
        horizontal
        data={suggestions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListFooterComponent={renderFooter}
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
        getItemLayout={(_, index) => ({
          length: snapInterval,
          offset: snapInterval * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: SPACE.x3,
    marginVertical: SPACE.x2,
  },
  heading: {
    ...TYPE.micro,
    fontSize: 10,
    paddingHorizontal: SPACE.x4,
    marginBottom: SPACE.x2,
  },
  listContent: {
    paddingHorizontal: SPACE.x4,
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: "center",
    paddingTop: SPACE.x4,
    paddingBottom: SPACE.x3,
    paddingHorizontal: SPACE.x2,
    gap: SPACE.x1,
  },
  name: {
    ...TYPE.bodyStrong,
    fontSize: 13,
    lineHeight: 17,
    textAlign: "center",
    minHeight: 34,
  },
  dept: {
    ...TYPE.caption,
    fontSize: 11,
    lineHeight: 14,
  },
  addPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.x3,
    paddingVertical: 5,
    marginTop: SPACE.x1,
    minWidth: 64,
    justifyContent: "center",
  },
  addPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  seeAllCard: {
    justifyContent: "center",
    gap: SPACE.x2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
