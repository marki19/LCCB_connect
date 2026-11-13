import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Settings, Calendar, LogOut, PenLine } from "lucide-react-native";
import PostCard from "../../src/components/PostCard";
import { useAuth } from "../../src/contexts/AuthContext";
import { apiFetch } from "../../src/lib/api";
import { useRouter } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";
import { RADIUS, SPACE, TYPE } from "../../src/lib/tokens";import Button, { IconButton } from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import Reveal from "../../src/components/ui/Reveal";
import SectionHeader from "../../src/components/ui/SectionHeader";
import StatusBadge from "../../src/components/admin/StatusBadge";
import EmptyState from "../../src/components/admin/EmptyState";

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
      course: user.department_name,
      yearLevel: user.year_level,
    },
    title: row.title || "",
    description: row.content || row.description || "",
    type: row.type || "text",
    tags: row.technologies || row.tags || [],
    previewUrl: row.github_url || row.preview_url,
    imageUrl: row.image_url,
    likes: row.likes || 0,
    comments: row.comments || 0,
    createdAt: new Date(row.created_at).toLocaleDateString(),
    isLiked: false,
    visibility: row.visibility,
  }));
}

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile, initialized } = useAuth();
  const { colors } = useTheme();
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

        // `/posts` returns `{ posts, next_cursor }`; the cursor is built by the
        // server so the client never has to mirror the keyset format.
        const payload = await res.json();
        if (cancelled) return;

        const list = Array.isArray(payload) ? payload : payload?.posts ?? [];
        setMyPosts(formatPostRows(list, user));
        setNextCursor(payload?.next_cursor ?? null);
        setHasMore(Boolean(payload?.next_cursor));
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

      const payload = await res.json();
      const list = Array.isArray(payload) ? payload : payload?.posts ?? [];
      if (list.length === 0) {
        setHasMore(false);
        setNextCursor(null);
        return;
      }

      setMyPosts((prev) => [...prev, ...formatPostRows(list, currentUser)]);
      setNextCursor(payload?.next_cursor ?? null);
      setHasMore(Boolean(payload?.next_cursor));
    } catch (err) {
      console.error("Failed to load more user posts:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: SPACE.x6 }}>
          {!initialized ? (
            <ActivityIndicator accessibilityLabel="Loading" size="large" color={colors.primary} />
          ) : (
            <Card style={{ alignItems: "center", padding: SPACE.x8, maxWidth: 380 }}>
              <Text style={{ ...TYPE.title, color: colors.ink, textAlign: "center" }}>
                Could not load your profile.
              </Text>
              <Text
                style={{
                  ...TYPE.body,
                  color: colors.inkSoft,
                  textAlign: "center",
                  marginTop: SPACE.x2,
                }}
              >
                Check your connection and try again.
              </Text>
              <Button
                label="Retry"
                onPress={() => void refreshProfile()}
                style={{ marginTop: SPACE.x5 }}
              />
            </Card>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const joined = currentUser.created_at
    ? new Date(currentUser.created_at).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : null;

  const verification = (() => {
    const status = currentUser.verification_status;
    if (status === "verified") return { label: "Verified", tone: "success" as const };
    if (status === "pending") return { label: "Under review", tone: "warning" as const };
    return null;
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero band */}
        <View style={{ height: 150, backgroundColor: colors.brandSolid, overflow: "hidden" }}>
          <View
            style={{
              position: "absolute",
              width: 280,
              height: 280,
              borderRadius: 140,
              backgroundColor: colors.heroGlow,
              opacity: 0.18,
              top: -150,
              right: -60,
            }}
          />
          <View
            style={{
              position: "absolute",
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: colors.accentBright,
              opacity: 0.14,
              bottom: -110,
              left: 40,
            }}
          />
        </View>

        <View
          style={{
            width: "100%",
            maxWidth: 760,
            alignSelf: "center",
            paddingHorizontal: SPACE.x4,
          }}
        >
          {/* Identity card */}
          <Reveal style={{ marginTop: -56 }}>
            <Card elevated style={{ padding: SPACE.x5 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: SPACE.x4 }}>
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    backgroundColor: colors.brandWash,
                    borderWidth: 4,
                    borderColor: colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: -40,
                  }}
                >
                  <Text style={{ fontSize: 32, fontWeight: "800", color: colors.brand }}>
                    {getInitials(isGuest ? "Guest Visitor" : currentUser.full_name)}
                  </Text>
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: SPACE.x3,
                    }}
                  >
                    <Text
                      style={{ ...TYPE.h2, color: colors.ink, flex: 1 }}
                      numberOfLines={2}
                    >
                      {isGuest ? "Guest Visitor" : currentUser.full_name || "Complete your profile"}
                    </Text>
                    <View style={{ flexDirection: "row", gap: SPACE.x2 }}>
                      {!isGuest && (
                        <IconButton
                          icon={Settings}
                          label="Edit profile"
                          variant="secondary"
                          onPress={() => router.push("/edit-profile")}
                        />
                      )}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Sign out"
                        onPress={handleSignOut}
                        onFocus={() => {}}
                        style={({ pressed }) => ({
                          width: 40,
                          height: 40,
                          borderRadius: RADIUS.md,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colors.destructiveSurface,
                          opacity: pressed ? 0.75 : 1,
                        })}
                      >
                        <LogOut size={18} color={colors.destructive} />
                      </Pressable>
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: SPACE.x2,
                      marginTop: SPACE.x2,
                    }}
                  >
                    {verification ? (
                      <StatusBadge label={verification.label} tone={verification.tone} />
                    ) : !isGuest ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Complete your profile"
                        onPress={() => router.push("/onboarding")}
                        style={({ pressed }) => ({
                          minHeight: 30,
                          justifyContent: "center",
                          paddingHorizontal: SPACE.x3,
                          borderRadius: RADIUS.pill,
                          borderWidth: 1,
                          borderColor: colors.borderStrong,
                          backgroundColor: colors.primarySurface,
                          opacity: pressed ? 0.8 : 1,
                        })}
                      >
                        <Text style={{ ...TYPE.caption, fontWeight: "700", color: colors.primary }}>
                          Complete profile
                        </Text>
                      </Pressable>
                    ) : null}
                    {joined ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x1 }}>
                        <Calendar size={13} color={colors.textTertiary} />
                        <Text style={{ ...TYPE.caption, color: colors.textTertiary }}>
                          Joined {joined}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
                    {isGuest
                      ? "External Visitor · Read-only"
                      : `${currentUser.department_name || "No department"} · ${currentUser.year_level || "—"}`}
                  </Text>
                </View>
              </View>

              <Text
                style={{
                  ...TYPE.body,
                  color: colors.inkSoft,
                  marginTop: SPACE.x4,
                  lineHeight: 22,
                }}
              >
                {isGuest
                  ? "Viewing LCCB academic projects and theses as a guest."
                  : currentUser.bio || "No bio yet."}
              </Text>

              {currentUser.skills && currentUser.skills.length > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: SPACE.x2,
                    marginTop: SPACE.x4,
                  }}
                >
                  {currentUser.skills.map((skill, index) => (
                    <View
                      key={index}
                      style={{
                        backgroundColor: colors.primarySurface,
                        paddingHorizontal: SPACE.x3,
                        paddingVertical: SPACE.x1,
                        borderRadius: RADIUS.pill,
                      }}
                    >
                      <Text style={{ ...TYPE.caption, fontWeight: "600", color: colors.primary }}>
                        {skill}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View
                style={{
                  flexDirection: "row",
                  marginTop: SPACE.x5,
                  paddingTop: SPACE.x4,
                  borderTopWidth: 1,
                  borderTopColor: colors.divider,
                }}
              >
                {[
                  { label: "Projects", value: visiblePosts.length },
                  { label: "Likes", value: visiblePosts.reduce((s, p) => s + p.likes, 0) },
                  { label: "Comments", value: visiblePosts.reduce((s, p) => s + p.comments, 0) },
                ].map((stat, i) => (
                  <View
                    key={stat.label}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      borderLeftWidth: i === 0 ? 0 : 1,
                      borderLeftColor: colors.divider,
                    }}
                  >
                    <Text style={{ ...TYPE.h2, color: colors.ink }}>{stat.value}</Text>
                    <Text style={{ ...TYPE.caption, color: colors.textTertiary, marginTop: 2 }}>
                      {stat.label}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </Reveal>

          {/* Portfolio */}
          <View style={{ marginTop: SPACE.x6 }}>
            <SectionHeader
              eyebrow="Work"
              title="Portfolio"
              description={
                isGuest
                  ? "Sign in to build your portfolio."
                  : "Posts, projects, and deposits you have shared."
              }
            />

            {visiblePosts.length === 0 ? (
              <Card>
                <EmptyState
                  icon={PenLine}
                  tone="brand"
                  compact
                  title={isGuest ? "Nothing to show" : "Your portfolio is empty"}
                  body={
                    isGuest
                      ? "Create an account to publish projects and deposit theses."
                      : "Share an update, a project, or a thesis to start your portfolio."
                  }
                  actionLabel={isGuest ? undefined : "Create a post"}
                  onAction={isGuest ? undefined : () => router.push("/create")}
                />
              </Card>
            ) : (
              <>
                {visiblePosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
                {hasMore && (
                  <Button
                    label={loadingMore ? "Loading…" : "Load more posts"}
                    variant="secondary"
                    onPress={() => void loadMorePosts()}
                    loading={loadingMore}
                    disabled={loadingMore}
                    fullWidth
                    style={{ marginHorizontal: SPACE.x4, marginTop: SPACE.x2 }}
                  />
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
