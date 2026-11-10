import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  useWindowDimensions,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Bookmark, RefreshCw } from "lucide-react-native";
import { useTheme } from "../src/contexts/ThemeContext";
import { useAuth } from "../src/contexts/AuthContext";
import { getSavedPosts, adaptPost } from "../src/lib/api";
import PostCard from "../src/components/PostCard";
import DesktopTopBar, { TOP_BAR_HEIGHT } from "../src/components/topbar/DesktopTopBar";
import DesktopLeftRail from "../src/components/leftrail/DesktopLeftRail";
import { RADIUS, SPACE, elevation } from "../src/lib/tokens";
import type { Post } from "../src/types";

export default function SavedPostsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSaved = useCallback(async () => {
    try {
      setError(null);
      const res = await getSavedPosts();
      const list = Array.isArray(res) ? res : (res?.posts || []);
      setPosts(list.map((p: any) => adaptPost({ ...p, is_saved: true })));
    } catch (err: any) {
      setError(err?.message || "Failed to load saved posts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const onRefresh = () => {
    setRefreshing(true);
    loadSaved();
  };

  const handlePostDeleted = (id: string | number) => {
    setPosts((prev) => prev.filter((p) => String(p.id) !== String(id)));
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.action} />
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary, marginTop: SPACE.x3 }]}>
            Loading saved posts...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSunken }]}>
            <Bookmark size={36} color={colors.destructive} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Unable to load saved posts
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={loadSaved}
            style={[styles.retryBtn, { backgroundColor: colors.action }]}
            accessibilityRole="button"
          >
            <RefreshCw size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSunken }]}>
          <Bookmark size={40} color={colors.textTertiary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
          No saved posts yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
          Items and updates you save will appear here for easy access.
        </Text>
      </View>
    );
  };

  const content = (
    <FlatList
      data={posts}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <View style={styles.cardWrapper}>
          <PostCard post={item} onDeleted={handlePostDeleted} />
        </View>
      )}
      contentContainerStyle={[
        styles.listContent,
        posts.length === 0 && { flex: 1, justifyContent: "center" },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.action}
          colors={[colors.action]}
        />
      }
      ListEmptyComponent={renderEmpty}
    />
  );

  if (isDesktop) {
    return (
      <View style={[styles.desktopRoot, { backgroundColor: colors.surfacePage }]}>
        <DesktopTopBar />
        <View style={[styles.desktopBody, { marginTop: TOP_BAR_HEIGHT }]}>
          {/* Left Rail */}
          <View style={styles.leftRailWrapper}>
            <DesktopLeftRail />
          </View>

          {/* Center Main Content */}
          <View style={styles.feedColumn}>
            <View style={[styles.feedHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={styles.feedHeaderRow}>
                <View style={[styles.headerIconCircle, { backgroundColor: colors.surfaceSunken }]}>
                  <Bookmark size={20} color={colors.action} />
                </View>
                <View>
                  <Text style={[styles.feedTitle, { color: colors.textPrimary }]}>Saved Posts</Text>
                  <Text style={[styles.feedSubtitle, { color: colors.textTertiary }]}>
                    {posts.length} {posts.length === 1 ? "item" : "items"} saved
                  </Text>
                </View>
              </View>
            </View>
            <View style={{ flex: 1 }}>{content}</View>
          </View>

          {/* Right Spacer for balance */}
          <View style={styles.rightSpacer} />
        </View>
      </View>
    );
  }

  // Mobile View
  return (
    <SafeAreaView style={[styles.mobileRoot, { backgroundColor: colors.surfacePage }]} edges={["top", "left", "right"]}>
      {/* Mobile Top Navigation */}
      <View style={[styles.mobileHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.mobileBackBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.mobileTitle, { color: colors.textPrimary }]}>Saved Posts</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={{ flex: 1 }}>{content}</View>
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
    display: "flex",
  },
  feedColumn: {
    flex: 1,
    maxWidth: 680,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "transparent",
  },
  rightSpacer: {
    width: 280,
    display: "flex",
  },
  feedHeader: {
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x3,
    borderBottomWidth: 1,
  },
  feedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACE.x3,
  },
  feedTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  feedSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  mobileRoot: {
    flex: 1,
  },
  mobileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.x3,
    height: 54,
    borderBottomWidth: 1,
  },
  mobileBackBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  mobileTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  listContent: {
    paddingVertical: SPACE.x3,
  },
  cardWrapper: {
    marginBottom: SPACE.x2,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.x6,
    paddingVertical: SPACE.x8,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.x4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: SPACE.x2,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x2,
    borderRadius: RADIUS.md,
    marginTop: SPACE.x4,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
