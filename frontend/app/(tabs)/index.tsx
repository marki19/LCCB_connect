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
  Building2,
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
import { fetchDepartments, fetchCourses } from "../../src/lib/catalog";
import type { Department, Course } from "../../src/types";
import HomeHeader from "../../src/components/HomeHeader";
import PostCard from "../../src/components/PostCard";
import RepostCard from "../../src/components/RepostCard";
import SettingsSidebar from "../../src/components/SettingsSidebar";
import Avatar from "../../src/components/Avatar";
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
import IdentityBanner from "../../src/components/IdentityBanner";

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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    fetchDepartments().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (selectedDeptId) {
      fetchCourses(selectedDeptId).then(setCourses).catch(() => setCourses([]));
    } else {
      setCourses([]);
    }
    setSelectedCourseId(null);
  }, [selectedDeptId]);

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
      const list = rows.map((r: any) => r.peer ?? r).filter(Boolean);
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

  const onlineCount = activePeers.filter((p) => isOnline(p.id)).length;

  const fetchUnifiedFeed = useCallback(async () => {
      if (!loadedRef.current) setLoading(true);
      setError("");
      let postItems: any[] = [];
      let thesisItems: any[] = [];
      let postFailed = false;
      let thesisFailed = false;

      const postQuery = new URLSearchParams();
      if (selectedDeptId) postQuery.set("department_id", selectedDeptId);
      if (selectedCourseId) postQuery.set("course_id", selectedCourseId);
      const postQueryStr = postQuery.toString() ? `?${postQuery.toString()}` : "";

      const thesisQuery = new URLSearchParams();
      if (selectedDeptId) thesisQuery.set("department_id", selectedDeptId);
      const thesisQueryStr = thesisQuery.toString() ? `?${thesisQuery.toString()}` : "";

      try {
        const res = await apiFetch(`/posts${postQueryStr}`);
        if (res.ok) {
          const data = await res.json();
          postItems = data.map((row: any) => {
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
              title: row.title || "Post Update",
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
      const res = await apiFetch(`/theses${thesisQueryStr}`);
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
  }, [filter, selectedDeptId, selectedCourseId]);

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

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginHorizontal: SPACE.x4,
                    marginTop: SPACE.x2,
                    marginBottom: SPACE.x2,
                  }}
                >
                  <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>
                    {onlineCount} online · {posts.length} {posts.length === 1 ? "post" : "posts"}
                  </Text>
                </View>

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

                <View style={{ marginBottom: SPACE.x3 }}>
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
                            minHeight: 38,
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

                  {/* Department Faceted Filters */}
                  {departments.length > 0 && (
                    <View style={{ marginTop: SPACE.x2 }}>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: SPACE.x4, gap: 6 }}
                      >
                        <Pressable
                          accessibilityRole="tab"
                          accessibilityLabel="All Departments"
                          accessibilityState={{ selected: selectedDeptId === null }}
                          onPress={() => setSelectedDeptId(null)}
                          style={({ pressed }) => ({
                            minHeight: 30,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                            borderRadius: RADIUS.pill,
                            borderWidth: 1,
                            borderColor: selectedDeptId === null ? colors.brandSolid : colors.line,
                            backgroundColor: selectedDeptId === null
                              ? colors.brandSolid
                              : pressed
                              ? colors.panelInset
                              : colors.panel,
                            paddingHorizontal: SPACE.x3,
                            opacity: pressed ? 0.9 : 1,
                          })}
                        >
                          <Building2
                            size={12}
                            color={selectedDeptId === null ? colors.textOnPrimary : colors.inkSoft}
                            strokeWidth={2}
                          />
                          <Text
                            style={{
                              ...TYPE.caption,
                              fontSize: 12,
                              fontWeight: "600",
                              color: selectedDeptId === null ? colors.textOnPrimary : colors.inkSoft,
                            }}
                          >
                            All Depts
                          </Text>
                        </Pressable>

                        {departments.map((dept) => {
                          const active = selectedDeptId === dept.id;
                          return (
                            <Pressable
                              key={dept.id}
                              accessibilityRole="tab"
                              accessibilityLabel={dept.name}
                              accessibilityState={{ selected: active }}
                              onPress={() => setSelectedDeptId(active ? null : dept.id)}
                              style={({ pressed }) => ({
                                minHeight: 30,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 5,
                                borderRadius: RADIUS.pill,
                                borderWidth: 1,
                                borderColor: active ? colors.brandSolid : colors.line,
                                backgroundColor: active
                                  ? colors.brandSolid
                                  : pressed
                                  ? colors.panelInset
                                  : colors.panel,
                                paddingHorizontal: SPACE.x3,
                                opacity: pressed ? 0.9 : 1,
                              })}
                            >
                              <Building2
                                size={12}
                                color={active ? colors.textOnPrimary : colors.inkSoft}
                                strokeWidth={2}
                              />
                              <Text
                                style={{
                                  ...TYPE.caption,
                                  fontSize: 12,
                                  fontWeight: "600",
                                  color: active ? colors.textOnPrimary : colors.inkSoft,
                                }}
                              >
                                {dept.code || dept.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Course Faceted Filters (Cascaded when department is selected) */}
                  {selectedDeptId && courses.length > 0 && (
                    <View style={{ marginTop: 6 }}>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: SPACE.x4, gap: 6 }}
                      >
                        <Pressable
                          accessibilityRole="tab"
                          accessibilityLabel="All Courses"
                          accessibilityState={{ selected: selectedCourseId === null }}
                          onPress={() => setSelectedCourseId(null)}
                          style={({ pressed }) => ({
                            minHeight: 28,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            borderRadius: RADIUS.pill,
                            borderWidth: 1,
                            borderColor: selectedCourseId === null ? colors.brandSolid : colors.line,
                            backgroundColor: selectedCourseId === null
                              ? colors.brandSolid
                              : pressed
                              ? colors.panelInset
                              : colors.surfaceSunken,
                            paddingHorizontal: SPACE.x3,
                            opacity: pressed ? 0.9 : 1,
                          })}
                        >
                          <GraduationCap
                            size={12}
                            color={selectedCourseId === null ? colors.textOnPrimary : colors.inkSoft}
                            strokeWidth={2}
                          />
                          <Text
                            style={{
                              ...TYPE.caption,
                              fontSize: 11,
                              fontWeight: "600",
                              color: selectedCourseId === null ? colors.textOnPrimary : colors.inkSoft,
                            }}
                          >
                            All Programs
                          </Text>
                        </Pressable>

                        {courses.map((course) => {
                          const active = selectedCourseId === course.id;
                          return (
                            <Pressable
                              key={course.id}
                              accessibilityRole="tab"
                              accessibilityLabel={course.name}
                              accessibilityState={{ selected: active }}
                              onPress={() => setSelectedCourseId(active ? null : course.id)}
                              style={({ pressed }) => ({
                                minHeight: 28,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                borderRadius: RADIUS.pill,
                                borderWidth: 1,
                                borderColor: active ? colors.brandSolid : colors.line,
                                backgroundColor: active
                                  ? colors.brandSolid
                                  : pressed
                                  ? colors.panelInset
                                  : colors.surfaceSunken,
                                paddingHorizontal: SPACE.x3,
                                opacity: pressed ? 0.9 : 1,
                              })}
                            >
                              <GraduationCap
                                size={12}
                                color={active ? colors.textOnPrimary : colors.inkSoft}
                                strokeWidth={2}
                              />
                              <Text
                                style={{
                                  ...TYPE.caption,
                                  fontSize: 11,
                                  fontWeight: "600",
                                  color: active ? colors.textOnPrimary : colors.inkSoft,
                                }}
                              >
                                {course.code || course.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Reset scope pill if department or course filter is active */}
                  {(selectedDeptId || selectedCourseId) && (
                    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.x4, marginTop: 6, gap: 6 }}>
                      <Pressable
                        onPress={() => {
                          setSelectedDeptId(null);
                          setSelectedCourseId(null);
                        }}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingVertical: 3,
                          paddingHorizontal: 8,
                          borderRadius: RADIUS.sm,
                          backgroundColor: pressed ? colors.hoverOverlay : "transparent",
                        })}
                        accessibilityRole="button"
                        accessibilityLabel="Clear scope filter"
                      >
                        <X size={12} color={colors.inkFaint} strokeWidth={2} />
                        <Text style={{ fontSize: 11, color: colors.inkFaint, fontWeight: "500" }}>
                          Clear department scope
                        </Text>
                      </Pressable>
                    </View>
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
        </View>
      </View>

      <SettingsSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </View>
  );
}
