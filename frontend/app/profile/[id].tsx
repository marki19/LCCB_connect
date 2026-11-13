import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Linking,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  StyleSheet,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  MessageSquare,
  UserPlus,
  UserCheck,
  UserX,
  Clock,
  BookOpen,
  Calendar,
  GraduationCap,
  Building2,
  CheckCircle,
  Edit3,
  Sparkles,
  FileText,
} from "lucide-react-native";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useAuth } from "../../src/contexts/AuthContext";
import { usePresence } from "../../src/contexts/PresenceContext";
import { useFloatingChat } from "../../src/contexts/FloatingChatContext";
import { useToast } from "../../src/contexts/ToastContext";
import {
  getUserProfile,
  UserProfileData,
  apiFetch,
  getThesisFileUrl,
  adaptPost,
} from "../../src/lib/api";
import {
  openConversation,
  sendFriendRequest,
  removeFriend,
  listFriendRequests,
  acceptFriendRequest,
} from "../../src/lib/messages";
import Avatar from "../../src/components/Avatar";
import PostCard from "../../src/components/PostCard";
import DesktopTopBar, { TOP_BAR_HEIGHT } from "../../src/components/topbar/DesktopTopBar";
import DesktopLeftRail from "../../src/components/leftrail/DesktopLeftRail";
import { RADIUS, SPACE, elevation } from "../../src/lib/tokens";
import type { Post } from "../../src/types";

type ProfileTab = "posts" | "theses" | "about";

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { profile: myProfile } = useAuth();
  const { isOnline, modeOf } = usePresence();
  const { openChat } = useFloatingChat();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;

  const [userData, setUserData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");

  // Tab content states
  const [posts, setPosts] = useState<Post[]>([]);
  const [theses, setTheses] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingTheses, setLoadingTheses] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await getUserProfile(id);
      setUserData(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load user profile");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Fetch user posts
  const fetchPosts = useCallback(async () => {
    if (!id) return;
    setLoadingPosts(true);
    try {
      const res = await apiFetch(`/posts?author_id=${id}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        setPosts((data || []).map(adaptPost));
      }
    } catch (err) {
      console.error("Failed to load user posts:", err);
    } finally {
      setLoadingPosts(false);
    }
  }, [id]);

  // Fetch user theses
  const fetchTheses = useCallback(async () => {
    if (!id) return;
    setLoadingTheses(true);
    try {
      const res = await apiFetch(`/theses?uploader_id=${id}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        setTheses(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load user theses:", err);
    } finally {
      setLoadingTheses(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === "posts") {
      fetchPosts();
    } else if (activeTab === "theses") {
      fetchTheses();
    }
  }, [activeTab, fetchPosts, fetchTheses]);

  // Action handlers
  const handleStartChat = async () => {
    if (!userData) return;
    if (!myProfile?.id || myProfile.role === "guest") {
      Alert.alert("Sign In Required", "Please sign in to send messages.");
      return;
    }

    if (isDesktop) {
      openChat({
        peerId: userData.id,
        peerName: userData.full_name || userData.username,
        avatarUrl: userData.avatar_url || undefined,
      });
    } else {
      try {
        const conv = await openConversation(userData.id);
        router.push(`/messages/${conv.id}`);
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to open conversation");
      }
    }
  };

  const handleFriendAction = async () => {
    if (!userData || actionBusy) return;
    if (!myProfile?.id || myProfile.role === "guest") {
      Alert.alert("Sign In Required", "Please sign in to connect with peers.");
      return;
    }

    setActionBusy(true);
    try {
      if (userData.friendship === "none") {
        await sendFriendRequest(userData.id);
        showToast({ message: "Friend request sent.", tone: "success" });
        setUserData((prev) => (prev ? { ...prev, friendship: "pending_out" } : null));
      } else if (userData.friendship === "friend") {
        Alert.alert(
          "Remove Friend",
          `Remove ${userData.full_name} from your friends list?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Remove",
              style: "destructive",
              onPress: async () => {
                await removeFriend(userData.id);
                showToast({ message: "Friend removed.", tone: "info" });
                setUserData((prev) =>
                  prev
                    ? {
                        ...prev,
                        friendship: "none",
                        stats: { ...prev.stats, friends_count: Math.max(0, prev.stats.friends_count - 1) },
                      }
                    : null
                );
              },
            },
          ]
        );
      } else if (userData.friendship === "pending_in") {
        const reqs = await listFriendRequests(50);
        const match = reqs.incoming.find((r) => r.requester.id === userData.id);
        if (match) {
          await acceptFriendRequest(match.id);
          showToast({ message: "Friend request accepted.", tone: "success" });
          setUserData((prev) =>
            prev
              ? {
                  ...prev,
                  friendship: "friend",
                  stats: { ...prev.stats, friends_count: prev.stats.friends_count + 1 },
                }
              : null
          );
        }
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to process friend action");
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centeredContainer, { backgroundColor: colors.surfacePage }]}>
        <ActivityIndicator size="large" color={colors.action} />
        <Text style={[styles.loadingText, { color: colors.textTertiary }]}>Loading profile...</Text>
      </View>
    );
  }

  if (error || !userData) {
    return (
      <View style={[styles.centeredContainer, { backgroundColor: colors.surfacePage }]}>
        <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>User Not Found</Text>
        <Text style={[styles.errorSubtitle, { color: colors.textTertiary }]}>
          {error || "This profile is unavailable or may have been restricted."}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.action }]}
          accessibilityRole="button"
        >
          <ArrowLeft size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isSelf = userData.is_self;

  // Header and Profile Info UI
  const profileHeaderContent = (
    <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Cover Banner */}
      <View
        style={[
          styles.coverBanner,
          {
            backgroundColor: isDark ? "hsl(215, 30%, 18%)" : "#2563EB",
          },
        ]}
      />

      {/* Profile Row */}
      <View style={styles.profileDetailsRow}>
        <View style={styles.avatarWrapper}>
          <Avatar
            name={userData.full_name}
            size={90}
            showPresence
            mode={modeOf(userData.id)}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsCluster}>
          {isSelf ? (
            <TouchableOpacity
              onPress={() => router.push("/edit-profile")}
              style={[styles.primaryActionBtn, { backgroundColor: colors.action }]}
              accessibilityRole="button"
            >
              <Edit3 size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryActionBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.actionButtonGroup}>
              <TouchableOpacity
                onPress={handleStartChat}
                style={[styles.primaryActionBtn, { backgroundColor: colors.action }]}
                accessibilityRole="button"
              >
                <MessageSquare size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryActionBtnText}>Message</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleFriendAction}
                disabled={actionBusy || userData.friendship === "pending_out"}
                style={[
                  styles.secondaryActionBtn,
                  {
                    backgroundColor:
                      userData.friendship === "friend"
                        ? colors.actionSurface
                        : colors.surfaceSunken,
                    borderColor: colors.border,
                  },
                ]}
                accessibilityRole="button"
              >
                {actionBusy ? (
                  <ActivityIndicator size="small" color={colors.action} />
                ) : userData.friendship === "friend" ? (
                  <>
                    <UserCheck size={15} color={colors.action} style={{ marginRight: 6 }} />
                    <Text style={[styles.secondaryActionBtnText, { color: colors.action }]}>
                      Friends
                    </Text>
                  </>
                ) : userData.friendship === "pending_out" ? (
                  <>
                    <Clock size={15} color={colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={[styles.secondaryActionBtnText, { color: colors.textSecondary }]}>
                      Requested
                    </Text>
                  </>
                ) : userData.friendship === "pending_in" ? (
                  <>
                    <UserPlus size={15} color={colors.action} style={{ marginRight: 6 }} />
                    <Text style={[styles.secondaryActionBtnText, { color: colors.action }]}>
                      Accept
                    </Text>
                  </>
                ) : (
                  <>
                    <UserPlus size={15} color={colors.textPrimary} style={{ marginRight: 6 }} />
                    <Text style={[styles.secondaryActionBtnText, { color: colors.textPrimary }]}>
                      Add Friend
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Name & Academic Meta */}
      <View style={styles.nameMetaContainer}>
        <View style={styles.titleRow}>
          <Text style={[styles.fullName, { color: colors.textPrimary }]}>
            {userData.full_name}
          </Text>
          {userData.verified_status === "verified" && (
            <View style={styles.verifiedBadge}>
              <CheckCircle size={16} color={colors.action} />
            </View>
          )}
        </View>
        <Text style={[styles.handle, { color: colors.textTertiary }]}>
          @{userData.username}
        </Text>

        {/* Academic Details */}
        <View style={styles.academicChipsRow}>
          {userData.department_name && (
            <View style={[styles.metaChip, { backgroundColor: colors.surfaceSunken }]}>
              <Building2 size={13} color={colors.action} style={{ marginRight: 4 }} />
              <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>
                {userData.department_name}
              </Text>
            </View>
          )}
          {userData.year_level && (
            <View style={[styles.metaChip, { backgroundColor: colors.surfaceSunken }]}>
              <GraduationCap size={13} color={colors.action} style={{ marginRight: 4 }} />
              <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>
                Year {userData.year_level}
              </Text>
            </View>
          )}
        </View>

        {/* Bio */}
        {userData.bio ? (
          <Text style={[styles.bioText, { color: colors.textSecondary }]}>
            {userData.bio}
          </Text>
        ) : null}

        {/* Stats Row */}
        <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {userData.stats.posts_count}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Posts</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {userData.stats.theses_count}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Theses</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {userData.stats.friends_count}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Friends</Text>
          </View>
        </View>
      </View>

      {/* Profile Tabs Navigation */}
      <View style={[styles.tabsBar, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setActiveTab("posts")}
          style={[styles.tabItem, activeTab === "posts" && { borderBottomColor: colors.action }]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "posts" }}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "posts" ? colors.action : colors.textSecondary },
              activeTab === "posts" && styles.tabTextActive,
            ]}
          >
            Posts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("theses")}
          style={[styles.tabItem, activeTab === "theses" && { borderBottomColor: colors.action }]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "theses" }}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "theses" ? colors.action : colors.textSecondary },
              activeTab === "theses" && styles.tabTextActive,
            ]}
          >
            Theses ({userData.stats.theses_count})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("about")}
          style={[styles.tabItem, activeTab === "about" && { borderBottomColor: colors.action }]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "about" }}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "about" ? colors.action : colors.textSecondary },
              activeTab === "about" && styles.tabTextActive,
            ]}
          >
            About
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Tab Content View
  const renderTabContent = () => {
    if (activeTab === "posts") {
      if (loadingPosts) {
        return (
          <View style={styles.tabLoadingBox}>
            <ActivityIndicator color={colors.action} />
          </View>
        );
      }
      if (posts.length === 0) {
        return (
          <View style={styles.tabEmptyBox}>
            <Sparkles size={32} color={colors.textTertiary} />
            <Text style={[styles.tabEmptyTitle, { color: colors.textPrimary }]}>No posts yet</Text>
            <Text style={[styles.tabEmptySubtitle, { color: colors.textTertiary }]}>
              {userData.full_name} hasn't published any public updates yet.
            </Text>
          </View>
        );
      }
      return (
        <View style={styles.postsListWrapper}>
          {posts.map((post) => (
            <View key={post.id} style={{ marginBottom: SPACE.x3 }}>
              <PostCard post={post} />
            </View>
          ))}
        </View>
      );
    }

    if (activeTab === "theses") {
      if (loadingTheses) {
        return (
          <View style={styles.tabLoadingBox}>
            <ActivityIndicator color={colors.action} />
          </View>
        );
      }
      if (theses.length === 0) {
        return (
          <View style={styles.tabEmptyBox}>
            <BookOpen size={32} color={colors.textTertiary} />
            <Text style={[styles.tabEmptyTitle, { color: colors.textPrimary }]}>
              No manuscripts deposited
            </Text>
            <Text style={[styles.tabEmptySubtitle, { color: colors.textTertiary }]}>
              No thesis or capstone manuscripts are publicly associated with this profile.
            </Text>
          </View>
        );
      }
      return (
        <View style={styles.thesesListWrapper}>
          {theses.map((item) => (
            <View
              key={item.id}
              style={[
                styles.thesisCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.thesisTitle, { color: colors.textPrimary }]}>{item.title}</Text>
              <Text style={[styles.thesisAbstract, { color: colors.textSecondary }]} numberOfLines={3}>
                {item.abstract}
              </Text>
              <TouchableOpacity
                onPress={async () => {
                  if (!item.pdf_url) return;
                  try {
                    const url = await getThesisFileUrl(item.id);
                    await Linking.openURL(url);
                  } catch (e: any) {
                    Alert.alert("Error", e.message || "Failed to open manuscript");
                  }
                }}
                style={[styles.readBtn, { backgroundColor: colors.actionSurface }]}
                accessibilityRole="button"
              >
                <BookOpen size={15} color={colors.action} style={{ marginRight: 6 }} />
                <Text style={[styles.readBtnText, { color: colors.action }]}>Read Manuscript</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      );
    }

    // "About" Tab
    return (
      <View style={[styles.aboutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.aboutHeading, { color: colors.textPrimary }]}>Academic Profile</Text>

        <View style={styles.aboutRow}>
          <Building2 size={16} color={colors.action} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.aboutLabel, { color: colors.textTertiary }]}>Department</Text>
            <Text style={[styles.aboutVal, { color: colors.textPrimary }]}>
              {userData.department_name || "LCCB Campus"}
            </Text>
          </View>
        </View>

        {userData.course_name && (
          <View style={styles.aboutRow}>
            <GraduationCap size={16} color={colors.action} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.aboutLabel, { color: colors.textTertiary }]}>Program / Degree</Text>
              <Text style={[styles.aboutVal, { color: colors.textPrimary }]}>
                {userData.course_name}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.aboutRow}>
          <Calendar size={16} color={colors.action} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.aboutLabel, { color: colors.textTertiary }]}>Member Since</Text>
            <Text style={[styles.aboutVal, { color: colors.textPrimary }]}>
              {new Date(userData.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
              })}
            </Text>
          </View>
        </View>

        {userData.skills && userData.skills.length > 0 && (
          <View style={{ marginTop: SPACE.x4 }}>
            <Text style={[styles.aboutLabel, { color: colors.textTertiary, marginBottom: 8 }]}>
              Skills & Expertise
            </Text>
            <View style={styles.skillsRow}>
              {userData.skills.map((skill) => (
                <View
                  key={skill}
                  style={[styles.skillChip, { backgroundColor: colors.surfaceSunken }]}
                >
                  <Text style={[styles.skillChipText, { color: colors.textSecondary }]}>
                    {skill}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  const mainScroll = (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {profileHeaderContent}
      <View style={{ marginTop: SPACE.x3 }}>{renderTabContent()}</View>
    </ScrollView>
  );

  // Desktop Responsive Layout
  if (isDesktop) {
    return (
      <View style={[styles.desktopRoot, { backgroundColor: colors.surfacePage }]}>
        <DesktopTopBar />
        <View style={[styles.desktopBody, { marginTop: TOP_BAR_HEIGHT }]}>
          <View style={styles.leftRailWrapper}>
            <DesktopLeftRail />
          </View>
          <View style={styles.feedColumn}>{mainScroll}</View>
          <View style={styles.rightSpacer} />
        </View>
      </View>
    );
  }

  // Mobile Layout
  return (
    <SafeAreaView style={[styles.mobileRoot, { backgroundColor: colors.surfacePage }]} edges={["top"]}>
      {/* Mobile Top Header */}
      <View style={[styles.mobileHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.mobileBackBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.mobileHeaderTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {userData.full_name}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={{ flex: 1 }}>{mainScroll}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  desktopRoot: {
    flex: 1,
  },
  desktopBody: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  leftRailWrapper: {
    width: 280,
  },
  feedColumn: {
    flex: 1,
    maxWidth: 720,
  },
  rightSpacer: {
    width: 280,
  },
  mobileRoot: {
    flex: 1,
  },
  mobileHeader: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.x3,
    borderBottomWidth: 1,
  },
  mobileBackBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  mobileHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  scrollContent: {
    padding: SPACE.x4,
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACE.x6,
  },
  loadingText: {
    marginTop: SPACE.x3,
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 300,
    marginBottom: SPACE.x4,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x2,
    borderRadius: RADIUS.md,
  },
  backBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  headerCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  coverBanner: {
    height: 120,
    width: "100%",
  },
  profileDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: SPACE.x4,
    marginTop: -45,
  },
  avatarWrapper: {
    padding: 3,
    borderRadius: 48,
    backgroundColor: "#FFFFFF",
  },
  actionsCluster: {
    marginBottom: 4,
  },
  actionButtonGroup: {
    flexDirection: "row",
    gap: SPACE.x2,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x4,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x3,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  nameMetaContainer: {
    paddingHorizontal: SPACE.x4,
    paddingTop: SPACE.x3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  fullName: {
    fontSize: 20,
    fontWeight: "800",
  },
  verifiedBadge: {
    marginLeft: 6,
  },
  handle: {
    fontSize: 13,
    marginTop: 2,
  },
  academicChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.x2,
    marginTop: SPACE.x3,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: SPACE.x3,
  },
  statsRow: {
    flexDirection: "row",
    paddingVertical: SPACE.x3,
    marginTop: SPACE.x4,
    borderTopWidth: 1,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  tabsBar: {
    flexDirection: "row",
    borderTopWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
  },
  tabTextActive: {
    fontWeight: "700",
  },
  tabLoadingBox: {
    paddingVertical: SPACE.x8,
    alignItems: "center",
  },
  tabEmptyBox: {
    paddingVertical: SPACE.x8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabEmptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: SPACE.x3,
  },
  tabEmptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 300,
    marginTop: 4,
  },
  postsListWrapper: {},
  thesesListWrapper: {
    gap: SPACE.x3,
  },
  thesisCard: {
    padding: SPACE.x4,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },
  thesisTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  thesisAbstract: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: SPACE.x3,
  },
  readBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: SPACE.x3,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  readBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  aboutCard: {
    padding: SPACE.x4,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },
  aboutHeading: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: SPACE.x3,
  },
  aboutRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: SPACE.x3,
  },
  aboutLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  aboutVal: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.x2,
  },
  skillChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  skillChipText: {
    fontSize: 12,
  },
});
