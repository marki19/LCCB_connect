import { useState, useCallback, useEffect } from "react";
import { View, FlatList, RefreshControl, Text, ScrollView, TouchableOpacity, Platform, useWindowDimensions } from "react-native";
import { BookOpen, FolderGit2, MessageSquare, Settings, UploadCloud, Users, Calendar } from "lucide-react-native";
import HomeHeader from "../../src/components/HomeHeader";
import PostCard from "../../src/components/PostCard";
import SettingsSidebar from "../../src/components/SettingsSidebar";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useFocusEffect, useRouter } from "expo-router";
import { apiFetch } from "../../src/lib/api";

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const isGuest = profile?.role === "guest";
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 900;

  const [posts, setPosts] = useState<any[]>([]);
  const [activePeers, setActivePeers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "theses" | "websites" | "projects" | "discussions" | "images">("all");

  // Drop a deleted card immediately; the next feed refresh reconciles with the server.
  const handlePostDeleted = useCallback((id: string | number) => {
    setPosts((prev) => prev.filter((p) => String(p.id) !== String(id)));
  }, []);

  const getInitials = (name?: string | null) => {
    if (!name) return "LC";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  };

  // Fetch real users from backend / database
  const fetchActivePeers = async () => {
    try {
      const res = await apiFetch(`/public/peers`);
      if (res.ok) {
        const users = await res.json();
        if (users && users.length > 0) {
          setActivePeers(users);
        }
      }
    } catch (e) {
      console.error("Failed to load peers from SQL backend:", e);
    }
  };

  // Current active user: use authenticated profile or primary user from database
  const activeUser = profile?.full_name ? profile : (activePeers[0] || {
    full_name: "Mark Antipo",
    username: "mark_antipo",
    department_name: null,
    year_level: "3rd Year",
  });

  const fetchUnifiedFeed = async () => {
    let postItems: any[] = [];
    let thesisItems: any[] = [];

    // 1. Fetch Posts from raw SQL backend API
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
            isLiked: false,
          };
        });
      }
    } catch (err) {
      console.error("Failed to load posts from SQL backend:", err);
    }

    // 2. Fetch Theses from raw SQL backend API
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
            title: `📑 ${t.title}`,
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
      }
    } catch (err) {
      console.error("Failed to load theses from SQL backend:", err);
    }

    // 3. Merge & Filter
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
  };

  useFocusEffect(
    useCallback(() => {
      fetchUnifiedFeed();
      fetchActivePeers();
    }, [filter])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchUnifiedFeed(), fetchActivePeers()]);
    setRefreshing(false);
  }, [filter]);

  const FilterTab = ({ label, value }: { label: string, value: any }) => {
    const active = filter === value;
    return (
      <TouchableOpacity 
        onPress={() => setFilter(value)}
        style={{ 
          paddingHorizontal: 16, 
          paddingVertical: 8, 
          borderRadius: 20, 
          backgroundColor: active ? colors.action : colors.surfaceSunken,
          marginRight: 8 
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#FFFFFF" : colors.textPrimary }}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <HomeHeader onMenuPress={() => setSidebarOpen(true)} />

      {/* Main 3-Column Container */}
      <View style={{ flex: 1, flexDirection: "row", justifyContent: "center" }}>
        
        {/* LEFT SIDEBAR (Desktop Web Facebook Style) */}
        {isDesktopWeb && (
          <View style={{ width: 280, paddingHorizontal: 16, paddingTop: 18, borderRightWidth: 1, borderRightColor: colors.border }}>
            {/* User Profile Card from Database */}
            <TouchableOpacity 
              onPress={() => router.push("/(tabs)/profile")}
              style={{ flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, backgroundColor: colors.surface, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.actionSurfaceAlt, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                <Text style={{ fontWeight: "800", color: colors.textPrimary, fontSize: 14 }}>{getInitials(activeUser.full_name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.textPrimary, fontSize: 14 }} numberOfLines={1}>{activeUser.full_name}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{activeUser.department_name || "No department"} {activeUser.year_level ? `· ${activeUser.year_level}` : ""}</Text>
              </View>
            </TouchableOpacity>

            {/* Navigation Shortcuts */}
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, textTransform: "uppercase", marginBottom: 8, paddingLeft: 8 }}>Shortcuts</Text>
            
            <TouchableOpacity onPress={() => setFilter("all")} style={{ flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, gap: 10, backgroundColor: filter === "all" ? colors.actionSurface : "transparent" }}>
              <Users size={18} color={colors.action} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>Campus Feed</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/(tabs)/search")} style={{ flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, gap: 10 }}>
              <BookOpen size={18} color={colors.action} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>Thesis Repository</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setFilter("projects")} style={{ flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, gap: 10, backgroundColor: filter === "projects" ? colors.actionSurface : "transparent" }}>
              <FolderGit2 size={18} color="#10B981" />
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>Capstones & Projects</Text>
            </TouchableOpacity>

            {!isGuest && (
              <TouchableOpacity onPress={() => router.push("/messages")} style={{ flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, gap: 10 }}>
                <MessageSquare size={18} color="#8B5CF6" />
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>Messages</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => setSidebarOpen(true)} style={{ flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, gap: 10 }}>
              <Settings size={18} color={colors.textTertiary} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>Settings & Privacy</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* CENTER COLUMN: FEED (Compressed in middle) */}
        <View style={{ flex: 1, maxWidth: isDesktopWeb ? 640 : "100%", width: "100%" }}>
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <PostCard post={item} onDeleted={handlePostDeleted} />}
            contentContainerStyle={{ paddingTop: 14, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={{ marginBottom: 14 }}>
                {/* Create post trigger card */}
                {!isGuest && (
                  <TouchableOpacity
                    onPress={() => router.push("/create")}
                    activeOpacity={0.8}
                    style={{
                      marginHorizontal: 16,
                      marginBottom: 12,
                      padding: 14,
                      backgroundColor: colors.surface,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: colors.border,
                      flexDirection: "row",
                      alignItems: "center",
                      shadowColor: colors.shadow,
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isDark ? 0.3 : 0.05,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: colors.actionSurfaceAlt,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 10,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "800", color: colors.textPrimary }}>{getInitials(activeUser.full_name)}</Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        height: 38,
                        backgroundColor: colors.surfaceSunken,
                        borderRadius: 19,
                        borderWidth: 1,
                        borderColor: colors.border,
                        justifyContent: "center",
                        paddingHorizontal: 14,
                      }}
                    >
                      <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                        Share your project or deposit thesis...
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Filter Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                  <FilterTab label="All" value="all" />
                  <FilterTab label="🌐 Websites" value="websites" />
                  <FilterTab label="📑 Theses" value="theses" />
                  <FilterTab label="Projects" value="projects" />
                  <FilterTab label="Discussions" value="discussions" />
                  <FilterTab label="Images" value="images" />
                </ScrollView>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.action]}
                tintColor={colors.action}
              />
            }
          />
        </View>

        {/* RIGHT SIDEBAR (Desktop Web: Deadlines & Live DB Active Peers) */}
        {isDesktopWeb && (
          <View style={{ width: 300, paddingHorizontal: 18, paddingTop: 18, borderLeftWidth: 1, borderLeftColor: colors.border }}>
            
            {/* Quick Deposit Banner */}
            {!isGuest && (
              <View style={{ backgroundColor: isDark ? "hsl(215, 35%, 18%)" : "#1A56DB", borderRadius: 16, padding: 16, marginBottom: 18, borderWidth: isDark ? 1 : 0, borderColor: colors.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <UploadCloud size={20} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 14 }}>Deposit Manuscript</Text>
                </View>
                <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, lineHeight: 17, marginBottom: 12 }}>
                  Archive your capstone or dissertation into the LCCB Digital Repository.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/upload-thesis")}
                  style={{ backgroundColor: colors.surface, paddingVertical: 8, borderRadius: 8, alignItems: "center" }}
                >
                  <Text style={{ color: colors.action, fontWeight: "700", fontSize: 12 }}>Upload PDF</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Academic Deadlines */}
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, textTransform: "uppercase", marginBottom: 10 }}>Academic Deadlines</Text>
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 18 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Calendar size={15} color={colors.action} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textPrimary }}>Capstone Title Defense</Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.textTertiary }}>College of Computer Studies • Term 1</Text>
            </View>

            {/* Live Active Peers (Fetched from database via raw SQL backend) */}
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, textTransform: "uppercase", marginBottom: 8 }}>
              Active Peers ({activePeers.length})
            </Text>
            
            {activePeers.map((peer) => (
              <TouchableOpacity
                key={peer.id}
                onPress={() => router.push("/messages")}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 10 }}
              >
                <View style={{ position: "relative" }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.actionSurfaceAlt, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.action }}>{getInitials(peer.full_name)}</Text>
                  </View>
                  <View style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E", borderWidth: 2, borderColor: colors.surface }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }} numberOfLines={1}>{peer.full_name}</Text>
                  <Text style={{ fontSize: 10, color: colors.textTertiary }}>{peer.department_name || "No department"} {peer.year_level ? `· ${peer.year_level}` : ""}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

      </View>

      <SettingsSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </View>
  );
}
