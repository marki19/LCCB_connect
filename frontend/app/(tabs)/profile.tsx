import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Settings, Calendar, LogOut } from "lucide-react-native";
import PostCard from "../../src/components/PostCard";
import { useAuth } from "../../src/contexts/AuthContext";
import { apiFetch } from "../../src/lib/api";

import { useRouter } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";

function getInitials(name: string | null) {
  if (!name) return "??";
  return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
}

function formatPostRows(rows: any[], user: any) {
  return rows.map((row) => ({
    id: row.id,
    author: {
      id: user.id,
      name: user.full_name,
      initials: getInitials(user.full_name),
      avatarColor: "#BFDBFE",
      course: user.department_name,
      yearLevel: user.year_level,
    },
    title: row.title || "Post Update",
    description: row.content || row.description || "",
    type: row.type || "text",
    tags: row.technologies || row.tags || [],
    previewUrl: row.github_url || row.preview_url,
    imageUrl: row.image_url,
    likes: row.likes || 0,
    comments: row.comments || 0,
    createdAt: new Date(row.created_at).toLocaleDateString(),
    isLiked: false,
  }));
}

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile, initialized } = useAuth();
  const { colors, isDark } = useTheme();
  const isGuest = profile?.role === "guest";
  const router = useRouter();

  const currentUser = profile;

  const handleSignOut = async () => {
    await signOut();
  };

  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const isGuestUser = !currentUser?.id || currentUser.id === "guest" || isGuest;
  const visiblePosts = isGuestUser ? [] : myPosts;

  useEffect(() => {
    const user = currentUser;
    if (!user?.id || user.id === "guest" || isGuest) {
      return;
    }

    let cancelled = false;

    const fetchFirstPage = async () => {
      try {
        const res = await apiFetch(
          `/posts?limit=100&author_id=${encodeURIComponent(user.id)}`
        );
        if (cancelled) return;

        if (!res.ok) {
          setMyPosts([]);
          setNextCursor(null);
          setHasMore(false);
          return;
        }

        const rows = await res.json();
        if (cancelled) return;

        const list = Array.isArray(rows) ? rows : [];
        setMyPosts(formatPostRows(list, user));

        const last = list[list.length - 1];
        const canLoadMore = list.length === 100 && Boolean(last?.created_at && last?.id);
        setHasMore(canLoadMore);
        setNextCursor(canLoadMore ? `${last.created_at}|${last.id}` : null);
      } catch (err) {
        console.error("Failed to load user posts from SQL backend:", err);
        if (!cancelled) {
          setMyPosts([]);
          setNextCursor(null);
          setHasMore(false);
        }
      }
    };

    void fetchFirstPage();

    return () => {
      cancelled = true;
    };
  }, [currentUser, isGuest]);

  const loadMorePosts = async () => {
    if (!currentUser || !nextCursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const res = await apiFetch(
        `/posts?limit=100&author_id=${encodeURIComponent(currentUser.id)}&cursor=${encodeURIComponent(nextCursor)}`
      );
      if (!res.ok) return;

      const rows = await res.json();
      const list = Array.isArray(rows) ? rows : [];
      if (list.length === 0) {
        setHasMore(false);
        setNextCursor(null);
        return;
      }

      setMyPosts((prev) => [...prev, ...formatPostRows(list, currentUser)]);

      const last = list[list.length - 1];
      const canLoadMore = list.length === 100 && Boolean(last?.created_at && last?.id);
      setHasMore(canLoadMore);
      setNextCursor(canLoadMore ? `${last.created_at}|${last.id}` : null);
    } catch (err) {
      console.error("Failed to load more user posts:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          {!initialized ? (
            <ActivityIndicator size="large" color={colors.action} />
          ) : (
            <>
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textPrimary, textAlign: "center" }}>
                Could not load your profile.
              </Text>
              <TouchableOpacity
                onPress={() => void refreshProfile()}
                style={{
                  marginTop: 16,
                  borderRadius: 9999,
                  backgroundColor: colors.action,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Retry</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover photo */}
        <View style={{ height: 120, backgroundColor: colors.actionSurfaceAlt }} />

        {/* Profile info */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.actionSurfaceAlt, alignItems: "center", justifyContent: "center", marginTop: -40, borderWidth: 4, borderColor: colors.surface }}>
              <Text style={{ fontSize: 28, fontWeight: "800", color: colors.textPrimary }}>{getInitials(currentUser.full_name)}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              {!isGuest && (
                <TouchableOpacity onPress={() => router.push("/edit-profile")} style={{ padding: 8, backgroundColor: colors.surfaceSunken, borderRadius: 20 }}>
                  <Settings size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleSignOut} style={{ padding: 8, backgroundColor: isDark ? "hsl(360, 40%, 20%)" : "#FEE2E2", borderRadius: 20 }}>
                <LogOut size={20} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.textPrimary, marginTop: 8 }}>{isGuest ? "Guest Visitor" : currentUser.full_name}</Text>
          <Text style={{ fontSize: 15, color: colors.textTertiary, marginTop: 2, fontWeight: "500" }}>{isGuest ? "External Visitor · Read-only" : `${currentUser.department_name || "No department"} · ${currentUser.year_level || "—"}`}</Text>

          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 12, lineHeight: 22 }}>
            {isGuest ? "Viewing LCCB academic projects and theses as a guest." : (currentUser.bio || "No bio yet.")}
          </Text>

          {currentUser.created_at ? (
            <View style={{ flexDirection: "row", marginTop: 12, gap: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Calendar size={14} color={colors.textTertiary} />
                <Text style={{ fontSize: 13, color: colors.textTertiary, marginLeft: 4 }}>
                  Joined {new Date(currentUser.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>
            </View>
          ) : null}

          {currentUser.skills && currentUser.skills.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              {currentUser.skills.map((skill, index) => (
                <View key={index} style={{ backgroundColor: colors.badgeWebsiteBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
                  <Text style={{ color: colors.badgeWebsiteText, fontSize: 13, fontWeight: "600" }}>{skill}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Stats */}
          <View style={{ flexDirection: "row", marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>{visiblePosts.length}</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Projects</Text>
            </View>
            <View style={{ flex: 1, alignItems: "center", borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>{visiblePosts.reduce((s, p) => s + p.likes, 0)}</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Likes</Text>
            </View>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>{visiblePosts.reduce((s, p) => s + p.comments, 0)}</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Comments</Text>
            </View>
          </View>
        </View>

        {/* Portfolio */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textPrimary, marginBottom: 16 }}>Portfolio</Text>
          {visiblePosts.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Text style={{ fontSize: 15, color: colors.textTertiary, fontWeight: "500" }}>No posts yet</Text>
            </View>
          ) : (
            <>
              {visiblePosts.map((post) => <PostCard key={post.id} post={post} />)}
              {hasMore && (
                <TouchableOpacity
                  onPress={() => void loadMorePosts()}
                  disabled={loadingMore}
                  activeOpacity={0.8}
                  style={{
                    marginTop: 8,
                    paddingVertical: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={colors.action} />
                  ) : (
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.action }}>Load more posts</Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}