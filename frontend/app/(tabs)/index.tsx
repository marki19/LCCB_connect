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
  Image as ImageIcon,
  MessageSquare,
  PenLine,
  Settings,
  Sparkles,
  UploadCloud,
  Users,
  WifiOff,
} from "lucide-react-native";
import HomeHeader from "../../src/components/HomeHeader";
import PostCard from "../../src/components/PostCard";
import SettingsSidebar from "../../src/components/SettingsSidebar";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { usePresence } from "../../src/contexts/PresenceContext";
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

type FilterValue = "all" | "theses" | "websites" | "projects" | "discussions" | "images";

const FILTERS: { value: FilterValue; label: string; icon: any }[] = [
  { value: "all", label: "All", icon: Sparkles },
  { value: "websites", label: "Websites", icon: Globe },
  { value: "theses", label: "Theses", icon: FileText },
  { value: "projects", label: "Projects", icon: FolderGit2 },
  { value: "discussions", label: "Discussions", icon: MessageSquare },
  { value: "images", label: "Images", icon: ImageIcon },
];

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
  images: {
    title: "No images yet",
    body: "Photos from campus life will appear here. Post the first frame.",
    icon: ImageIcon,
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

function SideLink({
  icon: Icon,
  label,
  active,
  onPress,
  colors,
  tone = colors.brand,
  badgeCount = 0,
}: {
  icon: any;
  label: string;
  active?: boolean;
  onPress: () => void;
  colors: ThemeTokens;
  tone?: string;
  badgeCount?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badgeCount > 0 ? `${label}, ${badgeCount} unread` : label}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.x3,
          borderRadius: RADIUS.md,
          paddingHorizontal: SPACE.x3,
          backgroundColor: active
            ? colors.brandWash
            : hovered || focused
            ? colors.panelInset
            : "transparent",
        },
        focusRing(colors, focused),
      ]}
    >
      <Icon size={18} color={active ? colors.brand : tone} strokeWidth={2.1} />
      <Text
        style={{
          ...TYPE.bodyStrong,
          fontSize: 13,
          fontWeight: active ? "700" : "600",
          color: active ? colors.brand : colors.ink,
        }}
      >
        {label}
      </Text>
      {badgeCount > 0 ? (
        <View
          style={{
            marginLeft: "auto",
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            paddingHorizontal: 6,
            backgroundColor: "#DC2626",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "800" }}>
            {badgeCount > 99 ? "99+" : badgeCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const { isOnline } = usePresence();
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
  const [filter, setFilter] = useState<FilterValue>("all");
  const loadedRef = useRef(false);

  const handlePostDeleted = useCallback((id: string | number) => {
    setPosts((prev) => prev.filter((p) => String(p.id) !== String(id)));
  }, []);

  const fetchActivePeers = useCallback(async () => {
    try {
      const rows = isGuest
        ? await apiJson<any[]>("/public/peers?limit=20")
        : await apiJson<{ peer: any }[]>("/friends?limit=20");
      const list = rows.map((r: any) => r.peer ?? r).filter(Boolean);
      setActivePeers(list.filter((p: any) => p.id !== profile?.id));
    } catch (e) {
      console.error("Failed to load peers:", e);
    }
  }, [isGuest, profile?.id]);

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

  const onlineCount = activePeers.filter((p) => isOnline(p.id)).length;
  const sortedPeers = useMemo(
    () => [...activePeers].sort((a, b) => Number(isOnline(b.id)) - Number(isOnline(a.id))),
    [activePeers, isOnline]
  );

  const fetchUnifiedFeed = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    setError("");
    let postItems: any[] = [];
    let thesisItems: any[] = [];
    let postFailed = false;
    let thesisFailed = false;

    try {
      const res = await apiFetch(`/posts`);
      if (res.ok) {
        const data = await res.json();
        postItems = data.map((row: any) => {
          const authorName = row.author?.full_name || "Unknown Author";
          return {
            id: row.id,
            author: {
              id: row.author_id,
              name: authorName,
              initials: getInitials(authorName),
              avatarColor: "#BFDBFE",
              course: row.author?.department_name || "—",
              yearLevel: row.author?.year_level || "—",
            },
            title: row.title || "Post Update",
            description: row.content || row.description || "",
            type: row.type || "text",
            tags: row.technologies || row.tags || [],
            previewUrl: row.github_url || row.preview_url,
            imageUrl: row.image_url,
            preview_metadata: row.preview_metadata || null,
            likes: row.likes || 0,
            comments: row.comments || 0,
            createdAt: new Date(row.created_at).toLocaleDateString(),
            rawDate: new Date(row.created_at).getTime(),
            isLiked: Boolean(row.is_liked),
            visibility: row.visibility,
          };
        });
      } else {
        postFailed = true;
      }
    } catch (err) {
      postFailed = true;
      console.error("Failed to load posts from SQL backend:", err);
    }

    try {
      const res = await apiFetch(`/theses`);
      if (res.ok) {
        const data = await res.json();
        thesisItems = data.map((t: any) => {
          const uploaderName = t.uploader?.full_name || t.author?.full_name || "Academic Author";
          return {
            id: t.id,
            author: {
              id: t.uploader_id,
              name: uploaderName,
              initials: getInitials(uploaderName),
              avatarColor: "#EDE9FE",
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
      unified = unified.filter((item) => item.type === "text");
    } else if (filter === "images") {
      unified = unified.filter((item) => item.type === "image");
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

      <View style={{ flex: 1, flexDirection: "row" }}>
        {/* LEFT RAIL — desktop only */}
        {isDesktopWeb && (
          <View
            style={{
              width: isWideWeb ? 320 : 272,
              paddingHorizontal: SPACE.x4,
              paddingTop: SPACE.x5,
              borderRightWidth: 1,
              borderRightColor: colors.line,
              backgroundColor: colors.surfacePage,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open your profile"
              onPress={() => router.push("/(tabs)/profile")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                padding: SPACE.x3,
                borderRadius: RADIUS.xl,
                backgroundColor: colors.panel,
                marginBottom: SPACE.x5,
                borderWidth: 1,
                borderColor: colors.line,
                opacity: pressed ? 0.9 : 1,
                ...elevation("sm", colors),
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.brandWash,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: SPACE.x3,
                }}
              >
                <Text style={{ fontWeight: "800", color: colors.brand, fontSize: 14 }}>
                  {getInitials(activeName)}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{ fontWeight: "700", color: colors.ink, fontSize: 14 }}
                  numberOfLines={1}
                >
                  {activeName}
                </Text>
                <Text style={{ color: colors.inkFaint, fontSize: 11 }} numberOfLines={1}>
                  {activeUser?.department_name || "No department"}
                  {activeUser?.year_level ? ` · ${activeUser.year_level}` : ""}
                </Text>
              </View>
            </Pressable>

            <Text
              style={{
                ...TYPE.micro,
                fontSize: 8.5,
                color: colors.inkFaint,
                marginBottom: SPACE.x2,
                paddingLeft: SPACE.x3,
              }}
            >
              Shortcuts
            </Text>

            <SideLink
              icon={Users}
              label="Campus Feed"
              active={filter === "all"}
              onPress={() => setFilter("all")}
              colors={colors}
              tone={colors.brand}
            />
            <SideLink
              icon={BookOpen}
              label="Thesis Repository"
              onPress={() => router.push("/(tabs)/search")}
              colors={colors}
              tone={colors.jadeText}
            />
            <SideLink
              icon={FolderGit2}
              label="Capstones & Projects"
              active={filter === "projects"}
              onPress={() => setFilter("projects")}
              colors={colors}
              tone={colors.badgeThesisText}
            />
            {!isGuest && (
              <SideLink
                icon={MessageSquare}
                label="Messages"
                onPress={() => router.push("/messages")}
                colors={colors}
                tone={colors.infoText}
                badgeCount={unreadCount}
              />
            )}
            <SideLink
              icon={Settings}
              label="Settings & Privacy"
              onPress={() => setSidebarOpen(true)}
              colors={colors}
              tone={colors.inkFaint}
            />
          </View>
        )}

        {/* CENTER — feed */}
        <View style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
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
              renderItem={({ item }) => <PostCard post={item} onDeleted={handlePostDeleted} />}
              contentContainerStyle={{
                flexGrow: 1,
                paddingTop: SPACE.x2,
                paddingBottom: SPACE.x8,
              }}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <View style={{ marginBottom: SPACE.x3 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginHorizontal: SPACE.x4,
                      marginVertical: SPACE.x2,
                      minHeight: 48,
                    }}
                  >
                    <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>
                      {onlineCount} online · {posts.length} posts
                    </Text>
                    {!isGuest && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Create a post"
                        onPress={goCreate}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          backgroundColor: colors.brandSolid,
                          borderRadius: RADIUS.pill,
                          paddingHorizontal: SPACE.x3,
                          minHeight: 36,
                        }}
                      >
                        <PenLine size={14} color={colors.textOnPrimary} />
                        <Text
                          style={{ ...TYPE.caption, fontWeight: "700", color: colors.textOnPrimary }}
                        >
                          Create
                        </Text>
                      </Pressable>
                    )}
                  </View>
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
              <Pressable
                onPress={goCreate}
                accessibilityRole="button"
                accessibilityLabel="Create a post or deposit a thesis"
                style={({ pressed }) => ({
                  marginHorizontal: SPACE.x4,
                  marginBottom: SPACE.x3,
                  minHeight: 64,
                  padding: SPACE.x3,
                  backgroundColor: colors.panel,
                  borderRadius: RADIUS.xl,
                  borderWidth: 1,
                  borderColor: colors.line,
                  flexDirection: "row",
                  alignItems: "center",
                  opacity: pressed ? 0.92 : 1,
                  ...elevation("sm", colors),
                })}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: colors.brandWash,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: SPACE.x3,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "800", color: colors.brand }}>
                    {getInitials(activeName)}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    minHeight: 40,
                    backgroundColor: colors.surfaceSunken,
                    borderRadius: RADIUS.pill,
                    borderWidth: 1,
                    borderColor: colors.line,
                    justifyContent: "center",
                    paddingHorizontal: SPACE.x4,
                  }}
                >
                  <Text style={{ color: colors.inkFaint, fontSize: 13 }} numberOfLines={1}>
                    Share your project or deposit a thesis…
                  </Text>
                </View>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.brandSolid,
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: SPACE.x2,
                  }}
                >
                  <PenLine size={16} color={colors.textOnPrimary} />
                </View>
              </Pressable>
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: SPACE.x4, gap: SPACE.x2 }}
            >
              {FILTERS.map((item) => {
                const active = filter === item.value;
                const Icon = item.icon;
                return (
                  <Pressable
                    key={item.value}
                    accessibilityRole="tab"
                    accessibilityLabel={`Show ${item.label}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => setFilter(item.value)}
                    style={({ pressed }) => ({
                      minHeight: 44,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      borderRadius: RADIUS.pill,
                      borderWidth: 1,
                      borderColor: active ? colors.brandSolid : colors.line,
                      backgroundColor: active
                        ? colors.brandSolid
                        : pressed
                        ? colors.panelInset
                        : colors.panel,
                      paddingHorizontal: SPACE.x4,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Icon
                      size={14}
                      color={active ? colors.textOnPrimary : colors.inkSoft}
                      strokeWidth={2.1}
                    />
                    <Text
                      style={{
                        ...TYPE.caption,
                        fontWeight: "700",
                        color: active ? colors.textOnPrimary : colors.inkSoft,
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* RIGHT RAIL — desktop only */}
        {isDesktopWeb && (
          <View
            style={{
              width: isWideWeb ? 320 : 312,
              paddingHorizontal: SPACE.x4,
              paddingTop: SPACE.x5,
              borderLeftWidth: 1,
              borderLeftColor: colors.line,
              backgroundColor: colors.surfacePage,
            }}
          >
            {!isGuest && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Upload a thesis"
                onPress={() => router.push("/upload-thesis")}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.x2,
                  paddingVertical: SPACE.x2,
                  paddingHorizontal: SPACE.x3,
                  borderRadius: RADIUS.md,
                  backgroundColor: colors.panel,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <UploadCloud size={16} color={colors.brand} />
                <Text style={{ color: colors.brand, fontWeight: "700", fontSize: 12 }}>
                  Upload thesis
                </Text>
              </Pressable>
            )}

            <Text
              style={{
                ...TYPE.micro,
                fontSize: 8.5,
                color: colors.inkFaint,
                marginBottom: SPACE.x2,
              }}
            >
              {isGuest ? "Campus directory" : "Campus peers"}
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: SPACE.x2,
              }}
            >
              <Text style={{ ...TYPE.micro, fontSize: 8.5, color: colors.inkFaint }}>
                {isGuest ? "Campus directory" : "Campus peers"}
              </Text>
              {onlineCount > 0 ? (
                <StatusBadge label={`${onlineCount} online`} tone="success" />
              ) : null}
            </View>

            {sortedPeers.length === 0 ? (
              <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>
                {isGuest ? "No one in the directory yet." : "No friends online yet. Add some classmates!"}
              </Text>
            ) : (
              sortedPeers.map((peer) => (
                <Pressable
                  key={peer.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${peer.full_name}`}
                  onPress={() => router.push("/messages")}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: SPACE.x2,
                    gap: SPACE.x3,
                    borderRadius: RADIUS.md,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <View style={{ position: "relative" }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: colors.brandWash,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.brand }}>
                        {getInitials(peer.full_name)}
                      </Text>
                    </View>
                    <View
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: isOnline(peer.id) ? colors.jade : colors.inkFaint,
                        borderWidth: 2,
                        borderColor: colors.surfacePage,
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: 13, fontWeight: "600", color: colors.ink }}
                      numberOfLines={1}
                    >
                      {peer.full_name}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.inkFaint }} numberOfLines={1}>
                      {peer.department_name || "No department"}
                      {peer.year_level ? ` · ${peer.year_level}` : ""}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}
      </View>

      <SettingsSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </View>
  );
}
