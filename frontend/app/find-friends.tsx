import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { ArrowLeft, Bell, Search, UserPlus, Users } from "lucide-react-native";
import Avatar from "../src/components/Avatar";
import DesktopTopBar, { TOP_BAR_HEIGHT } from "../src/components/topbar/DesktopTopBar";
import { useTheme } from "../src/contexts/ThemeContext";
import {
  listFriendSuggestions,
  listFriendRequests,
  sendFriendRequest,
} from "../src/lib/messages";
import { RADIUS, SPACE, TYPE } from "../src/lib/tokens";
import type { FriendSuggestion } from "../src/types";

/**
 * Find Friends: ranked "people you may know" plus a name search. The top-right
 * button routes to the friends screen where incoming requests live.
 *
 * The server ranks everything; this screen only narrows by name locally. The
 * suggestions endpoint already excludes friends, pending requests, blocks, and
 * suspended accounts, so every row is addable.
 */
export default function FindFriendsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 900;

  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [incomingCount, setIncomingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [rows, requests] = await Promise.all([
        listFriendSuggestions(24),
        listFriendRequests(50),
      ]);
      setSuggestions(rows);
      setIncomingCount(requests.incoming.length);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const addFriend = useCallback(async (id: string) => {
    setPendingId(id);
    try {
      await sendFriendRequest(id);
      setSentIds((prev) => new Set(prev).add(id));
    } catch {
      // Server rejections (already friends, blocked, …) surface on refresh.
    } finally {
      setPendingId(null);
    }
  }, []);

  const q = query.trim().toLowerCase();
  const visible = q
    ? suggestions.filter(
        (s) =>
          (s.full_name || "").toLowerCase().includes(q) ||
          (s.username || "").toLowerCase().includes(q) ||
          (s.department_name || "").toLowerCase().includes(q)
      )
    : suggestions;

  const reasonText = (item: FriendSuggestion): string =>
    item.reason === "mutual"
      ? `${item.mutual_count} mutual friend${item.mutual_count === 1 ? "" : "s"}`
      : item.reason === "department"
        ? "Same department"
        : "On campus";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      {isDesktop && <DesktopTopBar />}
      <SafeAreaView
        edges={["left", "right"]}
        style={{ flex: 1, paddingTop: isDesktop ? TOP_BAR_HEIGHT : 0 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: colors.surfaceSunken, opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <ArrowLeft size={19} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Find friends
          </Text>
          <Pressable
            onPress={() => router.push("/friends")}
            accessibilityRole="button"
            accessibilityLabel={
              incomingCount > 0
                ? `Friend requests, ${incomingCount} incoming`
                : "Friend requests"
            }
            style={({ pressed }) => [
              styles.requestsButton,
              { backgroundColor: colors.actionSurface, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Bell size={15} color={colors.action} />
            <Text style={[styles.requestsText, { color: colors.action }]}>
              Requests
            </Text>
            {incomingCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.action }]}>
                <Text style={styles.badgeText}>
                  {incomingCount > 99 ? "99+" : incomingCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <View
            style={[
              styles.searchField,
              { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
            ]}
          >
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name, username, or department"
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.textPrimary }]}
              accessibilityLabel="Search people"
              returnKeyType="search"
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.action} />
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.centered}>
            <Users size={28} color={colors.textDisabled} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {query ? "No one matches that search." : "No suggestions right now."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.action]}
                tintColor={colors.action}
              />
            }
            renderItem={({ item }) => {
              const sent = sentIds.has(item.id);
              const name = item.full_name || item.username || "LCCB member";
              const meta = reasonText(item);
              return (
                <View
                  style={[
                    styles.row,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Pressable
                    onPress={() => router.push(`/profile/${item.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${name}`}
                    style={styles.rowMain}
                  >
                    <Avatar
                      name={name}
                      avatarUrl={item.avatar_url}
                      size={44}
                    />
                    <View style={styles.rowText}>
                      <Text
                        numberOfLines={1}
                        style={[styles.rowName, { color: colors.textPrimary }]}
                      >
                        {name}
                      </Text>
                      <Text numberOfLines={1} style={[styles.rowMeta, { color: colors.textSecondary }]}>
                        {[item.department_name, meta].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => !sent && !pendingId && void addFriend(item.id)}
                    disabled={sent || pendingId === item.id}
                    accessibilityRole="button"
                    accessibilityLabel={sent ? "Request sent" : `Add ${name} as a friend`}
                    style={({ pressed }) => [
                      styles.addButton,
                      {
                        backgroundColor: sent ? colors.successSurface : colors.actionSurface,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    {pendingId === item.id ? (
                      <ActivityIndicator size="small" color={colors.action} />
                    ) : (
                      <>
                        {sent ? null : <UserPlus size={13} color={sent ? colors.successText : colors.action} />}
                        <Text
                          style={[
                            styles.addButtonText,
                            { color: sent ? colors.successText : colors.action },
                          ]}
                        >
                          {sent ? "Sent" : "Add"}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              );
            }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
    paddingHorizontal: SPACE.x4,
    paddingTop: SPACE.x2,
    paddingBottom: SPACE.x2,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...TYPE.title,
    flex: 1,
  },
  requestsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
  },
  requestsText: {
    fontSize: 13,
    fontWeight: "700",
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  searchWrap: {
    paddingHorizontal: SPACE.x4,
    paddingBottom: SPACE.x2,
  },
  searchField: {
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
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: SPACE.x4,
    paddingBottom: SPACE.x10,
    gap: SPACE.x2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACE.x3,
    gap: SPACE.x2,
  },
  rowMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
    flex: 1,
    minWidth: 0,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowName: {
    ...TYPE.bodyStrong,
  },
  rowMeta: {
    ...TYPE.caption,
    fontSize: 12,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    minWidth: 68,
    justifyContent: "center",
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.x2,
    padding: SPACE.x6,
  },
  emptyText: {
    ...TYPE.body,
    textAlign: "center",
  },
});
