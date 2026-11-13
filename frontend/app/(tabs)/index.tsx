import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  Text,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import {
  BookOpen,
  FileText,
  FolderGit2,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  MessageSquare,
  PenLine,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react-native";
import HomeHeader from "../../src/components/HomeHeader";
import PostCard from "../../src/components/PostCard";
import RepostCard from "../../src/components/RepostCard";
import SettingsSidebar from "../../src/components/SettingsSidebar";
import Avatar from "../../src/components/Avatar";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useFocusEffect, useRouter } from "expo-router";
import { apiFetch, apiJson } from "../../src/lib/api";
import {
  elevation,
  focusRing,
  RADIUS,
  SPACE,
  TYPE,
  type ThemeTokens,
} from "../../src/lib/tokens";
import StatusBadge from "../../src/components/admin/StatusBadge";
import EmptyState from "../../src/components/admin/EmptyState";
import { Skeleton } from "../../src/components/ui/Skeleton";
import IdentityBanner from "../../src/components/IdentityBanner";
import { useFeedFilter, type FeedCategory } from "../../src/contexts/FeedFilterContext";

type FilterValue = FeedCategory;

const FILTER_COPY: Record<FilterValue, { title: string; body: string; icon: any }> = {
  all: {
    title: "The campus is quiet",
    body: "No posts yet. Be the first to share an update, a project, or a thesis.",
    icon: Sparkles,
  },
  websites: {
    title: "No websites yet",
    body: "Project links and live sites will collect here. Share the first one.",
    icon: Globe,
  },
  theses: {
    title: "The archive is waiting",
    body: "No theses have been deposited in this view. Help start the archive.",
    icon: BookOpen,
  },
  projects: {
    title: "No projects in this view",
    body: "Capstones and side projects will show up here as they are shared.",
    icon: FolderGit2,
  },
  discussions: {
    title: "No discussions yet",
    body: "Ask a question, share a thought, or start a conversation on campus.",
    icon: MessageSquare,
  },
};

function getInitials(name?: string | null) {
  if (!name) return "LC";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}


export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const isGuest = profile?.role === "guest";
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 1200;
  const isWideWeb = Platform.OS === "web" && width >= 1600;

  const [posts, setPosts] = useState<any[]>([]);
  const [activePeers, setActivePeers] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { activeCategory: filter, setCategory: setFilter } = useFeedFilter();
  const loadedRef = useRef(false);

  const handlePostDeleted = useCallback((id: string | number) => {
    setPosts((prev) => prev.filter((p) => String(p.id) !== String(id)));
  }, []);

  const fetchActivePeers = useCallback(async () => {
    try {
      // No profile = not authenticated, use public endpoint
      if (!profile) {
        const rows = await apiJson<any[]>("/public/peers?limit=20");
        setActivePeers(rows);
        return;
      }
      const rows = isGuest
        ? await apiJson<any[]>("/public/peers?limit=20")
        : await apiJson<{ peer: any }[]>("/friends?limit=20");
      const list = Array.isArray(rows) ? rows.map((r: any) => r.peer ?? r).filter(Boolean) : [];
      setActivePeers(list.filter((p: any) => p.id !== profile?.id));
    } catch (e) {
      console.error("Failed to load peers:", e);
    }
  }, [isGuest, profile]);

  const fetchUnreadCount = useCallback(async () => {
    if (isGuest || !profile?.id) {
      setUnreadCount(0);
      return;
    }

    try {
      const res = await apiFetch("/conversations/unread-count");
      if (!res.ok) {
        setUnreadCount(0);
        return;
      }

      const data = await res.json();
      const next = Number(data?.unread);
      setUnreadCount(Number.isFinite(next) ? next : 0);
    } catch (err) {
      console.error("Failed to load unread count:", err);
    }
  }, [isGuest, profile?.id]);

  const activeUser = profile;
  const activeName = activeUser?.full_name || (isGuest ? "Guest Visitor" : "You");

  const fetchUnifiedFeed = useCallback(async () => {
      if (!loadedRef.current) setLoading(true);
      setError("");
      let postItems: any[] = [];
      let thesisItems: any[] = [];
      let postFailed = false;
      let thesisFailed = false;

      try {
        const res = await apiFetch("/posts");
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (Array.isArray(data?.posts) ? data.posts : []);
          postItems = list.map((row: any) => {
            const authorName = row.author?.full_name || "Unknown Author";
            const baseItem: any = {
              id: row.id,
              author: {
                id: row.author_id,
                name: authorName,
                initials: getInitials(authorName),
                avatarColor: "#BFDBFE",
                course: row.author?.department_name || "—",
                yearLevel: row.author?.year_level || "—",
              },
              title: row.title || "",
              description: row.content || row.description || "",
              content: row.content || undefined,
              type: row.type || "text",
              tags: row.technologies || row.tags || [],
              previewUrl: row.github_url || row.preview_url,
              imageUrl: row.image_url,
              image_urls: row.image_urls || (row.image_url ? [row.image_url] : []),
              preview_metadata: row.preview_metadata || null,
              likes: row.likes || 0,
              comments: row.comments || 0,
              createdAt: new Date(row.created_at).toLocaleDateString(),
              rawDate: new Date(row.created_at).getTime(),
              isLiked: Boolean(row.is_liked),
              visibility: row.visibility,
              repost_count: row.repost_count || 0,
              allow_reposts: row.allow_reposts !== false,
              edited_at: row.edited_at || null,
              deleted_at: row.deleted_at || null,
              kind: row.kind || "post",
              author_department_id: row.author_department_id || null,
              author_course_id: row.author_course_id || null,
            };

            // Handle reposts: backend returns kind="repost" with embedded original + reposter info
            if (row.kind === "repost" && row.repost) {
              const reposterName = row.reposter?.full_name || authorName;
              baseItem.repost = {
                id: row.repost.id,
                caption: row.repost.caption || undefined,
                created_at: row.repost.created_at,
                reposter: {
                  id: row.reposter?.id || row.author_id,
                  name: reposterName,
                  initials: getInitials(reposterName),
                  avatarColor: "#BFDBFE",
                  course: row.reposter?.department_name || "—",
                  yearLevel: row.reposter?.year_level || "—",
                },
              };
            }

            return baseItem;
          });
        } else {
          postFailed = true;
        }
      } catch (err) {
        postFailed = true;
        console.error("Failed to load posts from SQL backend:", err);
      }

    try {
      const res = await apiFetch("/theses");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.theses) ? data.theses : []);
        thesisItems = list.map((t: any) => {
          const uploaderName = t.uploader?.full_name || t.author?.full_name || "Academic Author";
          return {
            id: t.id,
            author: {
              id: t.uploader_id,
              name: uploaderName,
              initials: getInitials(uploaderName),
              course: t.uploader?.department_name || t.department || "—",
              yearLevel: t.category || "Thesis",
            },
            title: t.title,
            description: t.abstract,
            type: "thesis",
            tags: [t.uploader?.department_name || t.department, t.category].filter(Boolean),
            previewUrl: t.pdf_url,
            imageUrl: undefined,
            likes: 0,
            comments: 0,
            createdAt: new Date(t.created_at).toLocaleDateString(),
            rawDate: new Date(t.created_at).getTime(),
            isLiked: false,
          };
        });
      } else {
        thesisFailed = true;
      }
    } catch (err) {
      thesisFailed = true;
      console.error("Failed to load theses from SQL backend:", err);
    }

    if (postFailed && thesisFailed) {
      setError("We couldn't reach the campus feed. Check your connection and try again.");
    }

    let unified = [...postItems, ...thesisItems].sort((a, b) => b.rawDate - a.rawDate);

    if (filter === "theses") {
      unified = unified.filter((item) => item.type === "thesis");
    } else if (filter === "websites") {
      unified = unified.filter((item) => item.type === "website");
    } else if (filter === "projects") {
      unified = unified.filter((item) => item.type === "project" || item.type === "capstone");
    } else if (filter === "discussions") {
      unified = unified.filter((item) => item.type === "text" || item.type === "image" || item.type === "discussion");
    }

    setPosts(unified);
    setLoading(false);
    loadedRef.current = true;
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      void fetchUnifiedFeed();
      void fetchActivePeers();
      void fetchUnreadCount();
    }, [fetchUnifiedFeed, fetchActivePeers, fetchUnreadCount])
  );

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 12000);
    return () => clearTimeout(timer);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchUnifiedFeed(), fetchActivePeers(), fetchUnreadCount()]);
    setRefreshing(false);
  }, [fetchUnifiedFeed, fetchActivePeers, fetchUnreadCount]);

  const emptyCopy = FILTER_COPY[filter];

  const goCreate = () => router.push("/create");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <HomeHeader
        onMenuPress={() => setSidebarOpen(true)}
        unreadCount={unreadCount}
      />

      <View style={{ flex: 1, alignItems: "center" }}>
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: isWideWeb ? 860 : 760,
          }}
        >
          <FlatList
            data={posts}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) =>
              item.kind === "repost" ? (
                <RepostCard post={item} repostInfo={item.repost!} onDeleted={handlePostDeleted} />
              ) : (
                <PostCard post={item} onDeleted={handlePostDeleted} />
              )
            }
            contentContainerStyle={{
              flexGrow: 1,
              paddingTop: SPACE.x2,
              paddingBottom: 96,
            }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View>
                <IdentityBanner />

                {error ? (
                  <View
                    style={{
                      marginHorizontal: SPACE.x4,
                      marginBottom: SPACE.x3,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: SPACE.x3,
                      borderRadius: RADIUS.lg,
                      borderWidth: 1,
                      borderColor: colors.coral,
                      backgroundColor: colors.coralWash,
                      padding: SPACE.x3,
                    }}
                  >
                    <WifiOff size={17} color={colors.coralText} />
                    <Text
                      style={{ ...TYPE.caption, fontWeight: "600", color: colors.coralText, flex: 1 }}
                    >
                      {error}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Retry loading the feed"
                      onPress={() => void onRefresh()}
                      style={({ pressed }) => ({
                        minHeight: 32,
                        justifyContent: "center",
                        borderRadius: RADIUS.pill,
                        borderWidth: 1,
                        borderColor: colors.coral,
                        paddingHorizontal: SPACE.x3,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text
                        style={{ ...TYPE.caption, fontWeight: "700", color: colors.coralText }}
                      >
                        Retry
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {!isGuest && (
                  <View
                    style={{
                      marginHorizontal: SPACE.x4,
                      marginBottom: SPACE.x3,
                      padding: SPACE.x3,
                      backgroundColor: colors.panel,
                      borderRadius: RADIUS.xl,
                      borderWidth: 1,
                      borderColor: colors.line,
                      ...elevation("sm", colors),
                    }}
                  >
                    {/* Top row: Avatar + Pill Input */}
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Avatar
                        name={activeName}
                        size={40}
                      />
                      <Pressable
                        onPress={() => goCreate()}
                        accessibilityRole="button"
                        accessibilityLabel="What's on your mind?"
                        style={({ pressed }) => ({
                          flex: 1,
                          minHeight: 40,
                          backgroundColor: colors.surfaceSunken,
                          borderRadius: RADIUS.pill,
                          borderWidth: 1,
                          borderColor: colors.line,
                          justifyContent: "center",
                          paddingHorizontal: SPACE.x4,
                          marginLeft: SPACE.x3,
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        <Text style={{ color: colors.inkFaint, fontSize: 13 }} numberOfLines={1}>
                          {`What's on your mind, ${activeName.split(" ")[0]}?`}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Divider line */}
                    <View
                      style={{
                        height: 1,
                        backgroundColor: colors.line,
                        marginTop: SPACE.x3,
                        marginBottom: SPACE.x2,
                      }}
                    />

                    {/* Action buttons row */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: SPACE.x1,
                      }}
                    >
                      <Pressable
                        onPress={() => router.push({ pathname: "/create", params: { editType: "project" } })}
                        accessibilityRole="button"
                        accessibilityLabel="Share Project"
                        style={({ pressed }) => ({
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          paddingVertical: 8,
                          borderRadius: RADIUS.md,
                          backgroundColor: pressed ? colors.hoverOverlay : "transparent",
                        })}
                      >
                        <FolderGit2 size={18} color="#10B981" strokeWidth={2} />
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.inkSoft }}>
                          Project
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => router.push({ pathname: "/create", params: { editType: "capstone" } })}
                        accessibilityRole="button"
                        accessibilityLabel="Share Capstone"
                        style={({ pressed }) => ({
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          paddingVertical: 8,
                          borderRadius: RADIUS.md,
                          backgroundColor: pressed ? colors.hoverOverlay : "transparent",
                        })}
                      >
                        <GraduationCap size={18} color="#F59E0B" strokeWidth={2} />
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.inkSoft }}>
                          Capstone
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => router.push({ pathname: "/create", params: { editType: "image" } })}
                        accessibilityRole="button"
                        accessibilityLabel="Share Photo"
                        style={({ pressed }) => ({
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          paddingVertical: 8,
                          borderRadius: RADIUS.md,
                          backgroundColor: pressed ? colors.hoverOverlay : "transparent",
                        })}
                      >
                        <ImageIcon size={18} color="#8B5CF6" strokeWidth={2} />
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.inkSoft }}>
                          Photo
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => router.push({ pathname: "/create", params: { editType: "text" } })}
                        accessibilityRole="button"
                        accessibilityLabel="Start Discussion"
                        style={({ pressed }) => ({
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          paddingVertical: 8,
                          borderRadius: RADIUS.md,
                          backgroundColor: pressed ? colors.hoverOverlay : "transparent",
                        })}
                      >
                        <MessageSquare size={18} color="#3B82F6" strokeWidth={2} />
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.inkSoft }}>
                          Discuss
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            }
            ListEmptyComponent={
              loading ? (
                <View style={{ paddingHorizontal: SPACE.x4, gap: SPACE.x3 }}>
                  {[0, 1, 2].map((index) => (
                    <View
                      key={index}
                      style={{
                        borderRadius: RADIUS.xl,
                        borderWidth: 1,
                        borderColor: colors.line,
                        backgroundColor: colors.panel,
                        padding: SPACE.x4,
                        gap: SPACE.x3,
                        ...elevation("sm", colors),
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x3 }}>
                        <Skeleton width={38} height={38} radius={19} />
                        <View style={{ flex: 1, gap: 6 }}>
                          <Skeleton width="45%" height={10} radius={5} />
                          <Skeleton width="28%" height={9} radius={5} />
                        </View>
                      </View>
                      <Skeleton width="88%" height={13} radius={6} />
                      <Skeleton width="70%" height={11} radius={6} />
                      <Skeleton height={120} radius={RADIUS.lg} />
                    </View>
                  ))}
                </View>
              ) : (
                <View
                  style={{
                    flexGrow: 1,
                    justifyContent: "center",
                    marginHorizontal: SPACE.x4,
                    borderRadius: RADIUS.xxl,
                    borderWidth: 1,
                    borderColor: colors.line,
                    backgroundColor: colors.panel,
                  }}
                >
                  <EmptyState
                    icon={error ? WifiOff : emptyCopy.icon}
                    tone={error ? "danger" : "brand"}
                    title={error ? "Nothing to show yet" : emptyCopy.title}
                    body={
                      error
                        ? "The feed could not load. Pull down to try again, or check your connection."
                        : emptyCopy.body
                    }
                    actionLabel={isGuest ? "Explore the repository" : "Share the first one"}
                    onAction={
                      isGuest ? () => router.push("/(tabs)/search") : goCreate
                    }
                  />
                </View>
              )
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.brandSolid]}
                tintColor={colors.brandSolid}
                progressBackgroundColor={colors.panel}
              />
            }
          />
        </View>
      </View>

      <SettingsSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </View>
  );
}
