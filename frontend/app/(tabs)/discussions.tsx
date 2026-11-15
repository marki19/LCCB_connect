import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import {
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
  HelpCircle,
  BookOpen,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useAuth } from "../../src/contexts/AuthContext";
import { apiFetch, adaptPost } from "../../src/lib/api";
import PostCard from "../../src/components/PostCard";
import type { Post } from "../../src/types";
import { RADIUS, SPACE } from "../../src/lib/tokens";

export default function DiscussionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTopic, setActiveTopic] = useState("all");

  const topics = [
    { id: "all", label: "All Discussions", Icon: Sparkles },
    { id: "questions", label: "Questions & Q&A", Icon: HelpCircle },
    { id: "academic", label: "Academic Advice", Icon: BookOpen },
    { id: "general", label: "General Chat", Icon: MessageSquare },
  ];

  const loadDiscussions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/posts");
      const list = res.ok ? await res.json() : [];
      const adapted = Array.isArray(list) ? list.map(adaptPost) : [];
      // Filter for discussions or general text posts
      const discussionPosts = adapted.filter(
        (p: any) => p.type === "discussion" || p.type === "text" || !p.type
      );
      setPosts(discussionPosts);
    } catch (err: any) {
      console.error("Failed to load discussions:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDiscussions();
  }, [loadDiscussions]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDiscussions();
  };

  const handlePostDeleted = (id: string | number) => {
    setPosts((prev) => prev.filter((p) => String(p.id) !== String(id)));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfacePage }]}>
      {/* Header Banner */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleRow}>
            <View style={[styles.headerIconCircle, { backgroundColor: colors.surfaceSunken }]}>
              <MessageSquare size={24} color={colors.brand} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                Campus Discussions
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textTertiary }]}>
                Ask questions, share advice, and connect with fellow students
              </Text>
            </View>
          </View>

          {/* New Discussion Button */}
          {profile?.role !== "guest" && (
            <TouchableOpacity
              onPress={() => router.push("/create?type=discussion")}
              style={[styles.newBtn, { backgroundColor: colors.brandSolid }]}
              accessibilityRole="button"
              accessibilityLabel="Start a discussion"
            >
              <Plus size={16} color={colors.textOnPrimary} style={{ marginRight: 6 }} strokeWidth={2.4} />
              <Text style={[styles.newBtnText, { color: colors.textOnPrimary }]}>Start Discussion</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Topics Filter */}
        <View style={styles.topicsRow}>
          {topics.map(({ id, label, Icon }) => {
            const isActive = activeTopic === id;
            return (
              <TouchableOpacity
                key={id}
                onPress={() => setActiveTopic(id)}
                style={[
                  styles.topicPill,
                  {
                    backgroundColor: isActive ? colors.brandSolid : colors.surfaceSunken,
                    borderColor: isActive ? colors.brandSolid : colors.border,
                  },
                ]}
                accessibilityRole="button"
              >
                <Icon
                  size={14}
                  color={isActive ? colors.textOnPrimary : colors.textSecondary}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.topicPillText,
                    { color: isActive ? colors.textOnPrimary : colors.textPrimary },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Main Discussions Feed */}
      {loading && !refreshing ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.action} />
          <Text style={[styles.loadingText, { color: colors.textTertiary }]}>
            Loading discussions...
          </Text>
        </View>
      ) : (
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSunken }]}>
                <MessageSquare size={36} color={colors.textTertiary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                No discussions yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                Be the first to start a conversation or ask an academic question!
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    flexWrap: "wrap",
    gap: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS.lg,
  },
  newBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  topicsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  topicPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  topicPillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  listContent: {
    paddingVertical: 14,
  },
  cardWrapper: {
    marginBottom: 12,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  centerLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13.5,
    textAlign: "center",
    maxWidth: 320,
  },
});
