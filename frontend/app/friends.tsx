import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  useWindowDimensions,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  UserPlus,
  Users,
  MessageSquare,
  Check,
  X,
  UserMinus,
  ChevronRight,
  Search,
} from "lucide-react-native";
import Avatar from "../src/components/Avatar";
import PeerPicker from "../src/components/PeerPicker";
import DesktopTopBar, { TOP_BAR_HEIGHT } from "../src/components/topbar/DesktopTopBar";
import { usePresence } from "../src/contexts/PresenceContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useToast } from "../src/contexts/ToastContext";
import { useFloatingChat } from "../src/contexts/FloatingChatContext";
import {
  acceptFriendRequest,
  declineFriendRequest,
  listFriendRequests,
  listFriends,
  openConversation,
  removeFriend,
} from "../src/lib/messages";
import type { ConversationPeer, Friend, FriendRequests } from "../src/types";
import { safeBack } from "../src/lib/navigation";
import { RADIUS, SPACE, TYPE } from "../src/lib/tokens";
import Button, { IconButton } from "../src/components/ui/Button";
import Card from "../src/components/ui/Card";
import Modal from "../src/components/ui/Modal";
import EmptyState from "../src/components/admin/EmptyState";

export default function FriendsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;

  const { modeOf } = usePresence();
  const { colors, isDark } = useTheme();
  const { openChat } = useFloatingChat();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"requests" | "all">("requests");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequests>({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [friendList, requestList] = await Promise.all([listFriends(100), listFriendRequests(50)]);
      setFriends(friendList);
      setRequests(requestList);
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
        const [friendList, requestList] = await Promise.all([listFriends(100), listFriendRequests(50)]);
        if (cancelled) return;
        setFriends(friendList);
        setRequests(requestList);
      } catch {
        // Best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const startChat = async (peer: ConversationPeer) => {
    try {
      if (isDesktop) {
        openChat({
          peerId: peer.id,
          peerName: (peer.full_name || peer.username) || undefined,
          avatarUrl: peer.avatar_url || undefined,
        });
      } else {
        const conversation = await openConversation(peer.id);
        router.push(`/messages/${conversation.id}`);
      }
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Please try again.");
    }
  };

  const handleRemove = (friend: Friend) => {
    const name = friend.peer.full_name || friend.peer.username;
    Alert.alert("Remove Friend", `Remove ${name} from your friends?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await removeFriend(friend.peer.id);
            setFriends((prev) => prev.filter((f) => f.peer.id !== friend.peer.id));
            showToast({ message: "Friend removed.", tone: "info" });
          } catch {
            // Non-fatal
          }
        },
      },
    ]);
  };

  const respond = async (id: string, action: "accept" | "decline") => {
    try {
      setProcessingId(id);
      if (action === "accept") {
        await acceptFriendRequest(id);
        showToast({ message: "Friend request accepted.", tone: "success" });
      } else {
        await declineFriendRequest(id);
        showToast({ message: "Friend request declined.", tone: "info" });
      }
      await load();
    } catch {
      // Non-fatal
    } finally {
      setProcessingId(null);
    }
  };

  const incomingCount = requests.incoming.length;

  // ── DESKTOP: Facebook-Style 2-Column Experience ───────────────────────────
  if (isDesktop) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
        {/* Desktop Top Navigation Bar */}
        <DesktopTopBar />

        {/* 2-Column Body */}
        <View style={{ flex: 1, flexDirection: "row", marginTop: TOP_BAR_HEIGHT }}>
          {/* LEFT SIDEBAR PANEL (360px) */}
          <View
            style={[
              styles.desktopSidebar,
              {
                backgroundColor: colors.surface,
                borderRightColor: colors.border,
              },
            ]}
          >
            {/* Header */}
            <View style={styles.sidebarHeader}>
              <Text style={[styles.sidebarTitle, { color: colors.textPrimary }]}>
                Friends
              </Text>
              <TouchableOpacity
                onPress={() => setPickerOpen(true)}
                style={[styles.findFriendsBtn, { backgroundColor: colors.actionSurface }]}
                accessibilityRole="button"
                accessibilityLabel="Find Friends"
              >
                <UserPlus size={18} color={colors.action} />
              </TouchableOpacity>
            </View>

            {/* Navigation Menu */}
            <View style={styles.menuContainer}>
              <TouchableOpacity
                onPress={() => setActiveTab("requests")}
                style={[
                  styles.menuItem,
                  activeTab === "requests" && { backgroundColor: colors.surfaceSunken },
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === "requests" }}
              >
                <View
                  style={[
                    styles.menuIconCircle,
                    {
                      backgroundColor:
                        activeTab === "requests" ? colors.action : colors.surfaceSunken,
                    },
                  ]}
                >
                  <UserPlus
                    size={18}
                    color={activeTab === "requests" ? "#FFFFFF" : colors.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.menuItemLabel,
                    {
                      color: colors.textPrimary,
                      fontWeight: activeTab === "requests" ? "700" : "600",
                    },
                  ]}
                >
                  Friend Requests
                </Text>
                {incomingCount > 0 && (
                  <View style={[styles.menuBadge, { backgroundColor: colors.action }]}>
                    <Text style={styles.menuBadgeText}>{incomingCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab("all")}
                style={[
                  styles.menuItem,
                  activeTab === "all" && { backgroundColor: colors.surfaceSunken },
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === "all" }}
              >
                <View
                  style={[
                    styles.menuIconCircle,
                    {
                      backgroundColor:
                        activeTab === "all" ? colors.action : colors.surfaceSunken,
                    },
                  ]}
                >
                  <Users
                    size={18}
                    color={activeTab === "all" ? "#FFFFFF" : colors.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.menuItemLabel,
                    {
                      color: colors.textPrimary,
                      fontWeight: activeTab === "all" ? "700" : "600",
                    },
                  ]}
                >
                  All Friends
                </Text>
                <Text style={{ fontSize: 13, color: colors.textTertiary, marginRight: 4 }}>
                  {friends.length}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* RIGHT CONTENT AREA (Responsive Card Grid) */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.desktopContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Section Header */}
            <View style={styles.contentHeader}>
              <Text style={[styles.contentTitle, { color: colors.textPrimary }]}>
                {activeTab === "requests"
                  ? incomingCount > 0
                    ? `Friend Requests (${incomingCount})`
                    : "Friend Requests"
                  : `All Friends (${friends.length})`}
              </Text>
            </View>

            {loading ? (
              <View style={styles.centeredContainer}>
                <ActivityIndicator size="large" color={colors.action} />
              </View>
            ) : activeTab === "requests" ? (
              /* Friend Requests Grid */
              requests.incoming.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View
                    style={[
                      styles.emptyIconCircle,
                      { backgroundColor: colors.surfaceSunken },
                    ]}
                  >
                    <UserPlus size={32} color={colors.textTertiary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                    No Pending Requests
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                    When people send you friend requests, they will appear here.
                  </Text>
                </View>
              ) : (
                <View style={styles.cardGrid}>
                  {requests.incoming.map((item) => {
                    const name = item.requester.full_name || item.requester.username || "Student";
                    const isBusy = processingId === item.id;

                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.friendCard,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <View style={styles.cardAvatarContainer}>
                          <Avatar name={name} size={72} />
                        </View>
                        <View style={styles.cardBody}>
                          <Text
                            style={[styles.cardName, { color: colors.textPrimary }]}
                            numberOfLines={1}
                          >
                            {name}
                          </Text>
                          <Text
                            style={[styles.cardSubtitle, { color: colors.textTertiary }]}
                            numberOfLines={1}
                          >
                            {item.requester.department_name || "LCCB Student"}
                          </Text>

                          <View style={styles.cardButtonsRow}>
                            <TouchableOpacity
                              onPress={() => void respond(item.id, "accept")}
                              disabled={isBusy}
                              style={[
                                styles.primaryActionBtn,
                                { backgroundColor: colors.action },
                              ]}
                            >
                              <Text style={styles.primaryActionBtnText}>Confirm</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => void respond(item.id, "decline")}
                              disabled={isBusy}
                              style={[
                                styles.secondaryActionBtn,
                                { backgroundColor: colors.surfaceSunken },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.secondaryActionBtnText,
                                  { color: colors.textPrimary },
                                ]}
                              >
                                Delete
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )
            ) : (
              /* All Friends Grid */
              friends.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View
                    style={[
                      styles.emptyIconCircle,
                      { backgroundColor: colors.surfaceSunken },
                    ]}
                  >
                    <Users size={32} color={colors.textTertiary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                    No Friends Yet
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                    Connect with peers and classmates across your department.
                  </Text>
                </View>
              ) : (
                <View style={styles.cardGrid}>
                  {friends.map((item) => {
                    const name = item.peer.full_name || item.peer.username || "Friend";

                    return (
                      <View
                        key={item.peer.id}
                        style={[
                          styles.friendCard,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <View style={styles.cardAvatarContainer}>
                          <Avatar
                            name={name}
                            size={72}
                            showPresence
                            mode={modeOf(item.peer.id)}
                          />
                        </View>
                        <View style={styles.cardBody}>
                          <Text
                            style={[styles.cardName, { color: colors.textPrimary }]}
                            numberOfLines={1}
                          >
                            {name}
                          </Text>
                          <Text
                            style={[styles.cardSubtitle, { color: colors.textTertiary }]}
                            numberOfLines={1}
                          >
                            {item.peer.department_name || "LCCB Campus"}
                          </Text>

                          <View style={styles.cardButtonsRow}>
                            <TouchableOpacity
                              onPress={() => void startChat(item.peer)}
                              style={[
                                styles.primaryActionBtn,
                                { backgroundColor: colors.action },
                              ]}
                            >
                              <MessageSquare size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                              <Text style={styles.primaryActionBtnText}>Message</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handleRemove(item)}
                              style={[
                                styles.secondaryActionBtn,
                                { backgroundColor: colors.surfaceSunken },
                              ]}
                            >
                              <UserMinus size={16} color={colors.destructive} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )
            )}
          </ScrollView>
        </View>

        <PeerPicker
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onOpened={(id) => router.push(`/messages/${id}`)}
          mode="friend"
        />
      </View>
    );
  }

  // ── MOBILE: Responsive Segmented Layout ────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      {/* Header */}
      <View
        style={[
          styles.mobileHeader,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => safeBack("/(tabs)")} style={{ padding: 6, marginRight: 4 }}>
            <ArrowLeft size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.mobileTitle, { color: colors.textPrimary }]}>Friends</Text>
        </View>
        <IconButton
                  icon={UserPlus}
                  label="Add a friend"
                  variant="subtle"
                  onPress={() => setPickerOpen(true)}
                  style={[styles.findFriendsBtn, { backgroundColor: colors.actionSurface }]}
                />
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
        <TouchableOpacity
          onPress={() => setActiveTab("requests")}
          style={[
            styles.mobileTabPill,
            {
              backgroundColor: activeTab === "requests" ? colors.action : colors.surfaceSunken,
            },
          ]}
        >
          <Text
            style={[
              styles.mobileTabPillText,
              { color: activeTab === "requests" ? "#FFFFFF" : colors.textSecondary },
            ]}
          >
            Requests
          </Text>
          {incomingCount > 0 && (
            <View
              style={[
                styles.mobileBadge,
                { backgroundColor: activeTab === "requests" ? "#FFFFFF" : colors.action },
              ]}
            >
              <Text
                style={[
                  styles.mobileBadgeText,
                  { color: activeTab === "requests" ? colors.action : "#FFFFFF" },
                ]}
              >
                {incomingCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("all")}
          style={[
            styles.mobileTabPill,
            {
              backgroundColor: activeTab === "all" ? colors.action : colors.surfaceSunken,
            },
          ]}
        >
          <Text
            style={[
              styles.mobileTabPillText,
              { color: activeTab === "all" ? "#FFFFFF" : colors.textSecondary },
            ]}
          >
            Your Friends ({friends.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="small" color={colors.action} />
        </View>
      ) : activeTab === "requests" ? (
        <FlatList
          style={{ flex: 1, marginTop: 12 }}
          data={requests.incoming}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.action} />}
          renderItem={({ item }) => (
            <View
              style={[
                styles.mobileListItem,
                {
                  backgroundColor: colors.surface,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Avatar
                name={item.requester.full_name || item.requester.username}
                size={48}
                showPresence
                mode={modeOf(item.requester.id)}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text numberOfLines={1} style={[styles.mobileItemName, { color: colors.textPrimary }]}>
                  {item.requester.full_name || item.requester.username || "Student"}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                  {item.requester.department_name || "Wants to be friends"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => void respond(item.id, "decline")}
                style={[styles.circleActionBtn, { backgroundColor: colors.surfaceSunken, marginRight: 8 }]}
              >
                <X size={17} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void respond(item.id, "accept")}
                style={[styles.circleActionBtn, { backgroundColor: colors.action }]}
              >
                <Check size={17} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.centeredContainer}>
              <Text style={{ fontSize: 14, color: colors.textTertiary }}>No friend requests</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          style={{ flex: 1, marginTop: 12 }}
          data={friends}
          keyExtractor={(item) => item.peer.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.action} />}
          renderItem={({ item }) => (
            <View
              style={[
                styles.mobileListItem,
                {
                  backgroundColor: colors.surface,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Avatar
                name={item.peer.full_name || item.peer.username}
                size={48}
                showPresence
                mode={modeOf(item.peer.id)}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text numberOfLines={1} style={[styles.mobileItemName, { color: colors.textPrimary }]}>
                  {item.peer.full_name || item.peer.username || "Friend"}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                  {item.peer.department_name || "LCCB"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => void startChat(item.peer)}
                style={[styles.circleActionBtn, { backgroundColor: colors.actionSurface, marginRight: 8 }]}
              >
                <MessageSquare size={17} color={colors.action} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRemove(item)}
                style={[styles.circleActionBtn, { backgroundColor: colors.surfaceSunken }]}
              >
                <UserMinus size={17} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.centeredContainer}>
              <Text style={{ fontSize: 14, color: colors.textTertiary }}>No friends yet</Text>
            </View>
          }
        />
      )}

      <PeerPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onOpened={(id) => router.push(`/messages/${id}`)}
        mode="friend"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Desktop
  desktopSidebar: {
    width: 360,
    borderRightWidth: 1,
    paddingTop: 16,
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sidebarTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  findFriendsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  menuContainer: {
    paddingHorizontal: 8,
    gap: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuItemLabel: {
    flex: 1,
    fontSize: 15,
  },
  menuBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  menuBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  desktopContent: {
    padding: 24,
    maxWidth: 1100,
  },
  contentHeader: {
    marginBottom: 20,
  },
  contentTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  friendCard: {
    width: 220,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardAvatarContainer: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 12,
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    alignItems: "center",
  },
  cardName: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 14,
  },
  cardButtonsRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  primaryActionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  secondaryActionBtn: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionBtnText: {
    fontWeight: "700",
    fontSize: 13,
  },
  centeredContainer: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 300,
  },

  // Mobile
  mobileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  mobileTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  mobileTabPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  mobileTabPillText: {
    fontSize: 13,
    fontWeight: "700",
  },
  mobileBadge: {
    marginLeft: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  mobileBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  mobileListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  mobileItemName: {
    fontSize: 15,
    fontWeight: "700",
  },
  circleActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
