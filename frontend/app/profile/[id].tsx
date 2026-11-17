import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
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
  Settings,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react-native";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useAuth } from "../../src/contexts/AuthContext";
import { useFloatingChat } from "../../src/contexts/FloatingChatContext";
import { useToast } from "../../src/contexts/ToastContext";
import { resolveFileUrl } from "../../src/lib/files";
import {
  openConversation,
  sendFriendRequest,
  removeFriend,
  listFriendRequests,
  acceptFriendRequest,
} from "../../src/lib/messages";
import DesktopTopBar, { TOP_BAR_HEIGHT } from "../../src/components/topbar/DesktopTopBar";
import DesktopLeftRail from "../../src/components/leftrail/DesktopLeftRail";
import PostCard from "../../src/components/PostCard";
import PostComposer from "../../src/components/PostComposer";
import { useProfileData } from "../../src/components/profile/useProfileData";
import ProfileCover from "../../src/components/profile/ProfileCover";
import ProfileIdentity from "../../src/components/profile/ProfileIdentity";
import ProfileActions from "../../src/components/profile/ProfileActions";
import ProfileTabs, { ProfileTabKey } from "../../src/components/profile/ProfileTabs";
import ProfileIntroCard from "../../src/components/profile/ProfileIntroCard";
import ProfileEducationCard from "../../src/components/profile/ProfileEducationCard";
import ProfileFriendsCard from "../../src/components/profile/ProfileFriendsCard";
import ProfilePhotosCard from "../../src/components/profile/ProfilePhotosCard";
import ProfileAboutTab from "../../src/components/profile/ProfileAboutTab";
import ProfileFriendsTab from "../../src/components/profile/ProfileFriendsTab";
import ProfilePhotosTab from "../../src/components/profile/ProfilePhotosTab";
import ProfileThesesList from "../../src/components/profile/ProfileThesesList";
import { RADIUS, SPACE } from "../../src/lib/tokens";

export default function UserProfileScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { profile: myProfile } = useAuth();
  const { openChat } = useFloatingChat();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();

  const isDesktop = Platform.OS === "web" && width >= 768;

  const [activeTab, setActiveTab] = useState<ProfileTabKey>(
    (tab as ProfileTabKey) || "all"
  );
  const [actionBusy, setActionBusy] = useState(false);

  const {
    userData,
    setUserData,
    loading,
    error,
    posts,
    setPosts,
    theses,
    friends,
    photos,
    loadingPosts,
    loadingTheses,
    loadingFriends,
    loadingPhotos,
    fetchTheses,
  } = useProfileData(id);

  // Sync tab with theses fetch
  useEffect(() => {
    if (activeTab === "theses" && theses.length === 0 && !loadingTheses) {
      fetchTheses();
    }
  }, [activeTab, theses.length, loadingTheses, fetchTheses]);

  // Handle Tab Switch
  const handleTabChange = (newTab: ProfileTabKey) => {
    setActiveTab(newTab);
    if (Platform.OS === "web") {
      router.setParams({ tab: newTab });
    }
  };

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
        avatarUrl: resolveFileUrl(userData.avatar_url) || undefined,
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
                        stats: {
                          ...prev.stats,
                          friends_count: Math.max(0, prev.stats.friends_count - 1),
                        },
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

  const handlePostDeleted = (deletedId: string | number) => {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
  };

  const handleCoverUpdated = (newKey: string) => {
    setUserData((prev) => (prev ? { ...prev, cover_url: newKey } : null));
    showToast({ message: "Cover photo updated.", tone: "success" });
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

  // Header Actions element
  const actionButtons = (
    <ProfileActions
      userData={userData}
      isSelf={isSelf}
      onStartChat={handleStartChat}
      onFriendAction={handleFriendAction}
      actionBusy={actionBusy}
      onEditProfile={() => router.push("/edit-profile")}
      onAddStory={() => router.push("/create")}
      onMore={() => {}}
    />
  );

  // Profile Header Card (Cover, Overlapping Avatar, Identity, Tabs)
  const profileHeaderCard = (
    <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Cover Photo */}
      <ProfileCover
        coverUrl={userData.cover_url}
        isSelf={isSelf}
        onCoverUpdated={handleCoverUpdated}
        height={isDesktop ? 300 : 180}
      />

      {/* Identity row with overlapping avatar + action buttons */}
      <ProfileIdentity
        userData={userData}
        isDesktop={isDesktop}
        actions={actionButtons}
      />

      {/* Facebook-style navigation tab strip */}
      <ProfileTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        thesesCount={userData.stats?.theses_count}
        friendsCount={userData.stats?.friends_count}
      />
    </View>
  );

  // Tab Content View
  const renderTabContent = () => {
    if (activeTab === "about") {
      return <ProfileAboutTab userData={userData} />;
    }

    if (activeTab === "friends") {
      return <ProfileFriendsTab friends={friends} loading={loadingFriends} />;
    }

    if (activeTab === "photos") {
      return <ProfilePhotosTab photos={photos} loading={loadingPhotos} />;
    }

    if (activeTab === "theses") {
      return <ProfileThesesList theses={theses} loading={loadingTheses} />;
    }

    // Default: "all" tab
    if (isDesktop) {
      return (
        <View style={styles.desktopTwoColBody}>
          {/* Left Column (360px): Intro, Education, Friends, Photos */}
          <View style={styles.desktopLeftCol}>
            <ProfileIntroCard userData={userData} isSelf={isSelf} />
            <ProfileEducationCard userData={userData} />
            <ProfileFriendsCard
              friends={friends}
              friendsCount={userData.stats?.friends_count}
              onSeeAll={() => handleTabChange("friends")}
            />
            <ProfilePhotosCard
              photos={photos}
              onSeeAll={() => handleTabChange("photos")}
            />
          </View>

          {/* Right Column (Flex): Post Composer + Posts Feed */}
          <View style={styles.desktopRightCol}>
            {isSelf && (
              <PostComposer style={{ marginBottom: SPACE.x4 }} />
            )}

            {/* Posts Section Header */}
            <View style={[styles.postsHeaderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.postsSectionTitle, { color: colors.ink }]}>Posts</Text>
              <View style={styles.postsHeaderActions}>
                <Pressable
                  style={({ pressed, hovered }: any) => [
                    styles.postsHeaderBtn,
                    {
                      backgroundColor: colors.surfaceSunken,
                      borderColor: colors.border,
                      cursor: "pointer",
                      opacity: pressed ? 0.8 : hovered ? 0.92 : 1,
                    },
                  ]}
                >
                  <SlidersHorizontal size={14} color={colors.ink} />
                  <Text style={[styles.postsHeaderBtnText, { color: colors.ink }]}>Filters</Text>
                </Pressable>
                {isSelf && (
                  <Pressable
                    style={({ pressed, hovered }: any) => [
                      styles.postsHeaderBtn,
                      {
                        backgroundColor: colors.surfaceSunken,
                        borderColor: colors.border,
                        cursor: "pointer",
                        opacity: pressed ? 0.8 : hovered ? 0.92 : 1,
                      },
                    ]}
                  >
                    <Settings size={14} color={colors.ink} />
                    <Text style={[styles.postsHeaderBtnText, { color: colors.ink }]}>Manage posts</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Feed List */}
            {loadingPosts ? (
              <View style={styles.feedLoadingBox}>
                <ActivityIndicator size="large" color={colors.brand} />
              </View>
            ) : posts.length === 0 ? (
              <View style={[styles.feedEmptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.feedEmptyIconWrap, { backgroundColor: colors.surfaceSunken }]}>
                  <Sparkles size={28} color={colors.inkFaint} />
                </View>
                <Text style={[styles.feedEmptyTitle, { color: colors.ink }]}>No posts yet</Text>
                <Text style={[styles.feedEmptySubtitle, { color: colors.inkFaint }]}>
                  {isSelf
                    ? "Share an update or campus thesis to get started."
                    : `${userData.full_name} hasn't published any public updates yet.`}
                </Text>
              </View>
            ) : (
              <View style={styles.feedListWrapper}>
                {posts.map((post) => (
                  <View key={post.id} style={{ marginBottom: SPACE.x4 }}>
                    <PostCard post={post} onDeleted={handlePostDeleted} />
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      );
    }

    // Mobile single column layout
    return (
      <View style={styles.mobileColumnBody}>
        <ProfileIntroCard userData={userData} isSelf={isSelf} />
        <ProfileEducationCard userData={userData} />
        <ProfileFriendsCard
          friends={friends}
          friendsCount={userData.stats?.friends_count}
          onSeeAll={() => handleTabChange("friends")}
        />
        <ProfilePhotosCard
          photos={photos}
          onSeeAll={() => handleTabChange("photos")}
        />

        {isSelf && (
          <PostComposer style={{ marginVertical: SPACE.x3 }} />
        )}

        {/* Posts */}
        {loadingPosts ? (
          <View style={styles.feedLoadingBox}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : posts.length === 0 ? (
          <View style={[styles.feedEmptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Sparkles size={28} color={colors.inkFaint} />
            <Text style={[styles.feedEmptyTitle, { color: colors.ink }]}>No posts yet</Text>
            <Text style={[styles.feedEmptySubtitle, { color: colors.inkFaint }]}>
              {isSelf
                ? "Share an update or campus thesis to get started."
                : `${userData.full_name} hasn't published any public updates yet.`}
            </Text>
          </View>
        ) : (
          <View style={styles.feedListWrapper}>
            {posts.map((post) => (
              <View key={post.id} style={{ marginBottom: SPACE.x3 }}>
                <PostCard post={post} onDeleted={handlePostDeleted} />
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const mainScrollContent = (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, isDesktop && styles.desktopScrollContent]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.profileCanvas, isDesktop && styles.profileCanvasDesktop]}>
        {profileHeaderCard}
        <View style={{ marginTop: SPACE.x4 }}>{renderTabContent()}</View>
      </View>
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
          <View style={styles.centerContainer}>{mainScrollContent}</View>
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
      <View style={{ flex: 1 }}>{mainScrollContent}</View>
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
  },
  leftRailWrapper: {
    width: 280,
  },
  centerContainer: {
    flex: 1,
    minWidth: 0,
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
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x4,
  },
  desktopScrollContent: {
    paddingHorizontal: SPACE.x5,
    paddingVertical: SPACE.x4,
    alignItems: "center",
  },
  profileCanvas: {
    width: "100%",
  },
  profileCanvasDesktop: {
    maxWidth: 1050,
  },
  headerCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  desktopTwoColBody: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.x4,
  },
  desktopLeftCol: {
    width: 360,
    gap: SPACE.x4,
  },
  desktopRightCol: {
    flex: 1,
    minWidth: 0,
  },
  mobileColumnBody: {
    gap: SPACE.x3,
  },
  postsHeaderCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x3,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACE.x4,
  },
  postsSectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  postsHeaderActions: {
    flexDirection: "row",
    gap: SPACE.x2,
  },
  postsHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACE.x3,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  postsHeaderBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  feedLoadingBox: {
    paddingVertical: SPACE.x8,
    alignItems: "center",
  },
  feedEmptyCard: {
    padding: SPACE.x8,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  feedEmptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.x3,
  },
  feedEmptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  feedEmptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 320,
    marginTop: 4,
  },
  feedListWrapper: {},
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
});
