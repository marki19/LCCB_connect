import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Settings, MapPin, Calendar, LogOut } from "lucide-react-native";
import PostCard from "../../src/components/PostCard";
import { useAuth } from "../../src/contexts/AuthContext";
import type { Post } from "../../src/types";
import { apiFetch } from "../../src/lib/api";

import { useRouter } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const { colors, isDark } = useTheme();
  const isGuest = profile?.role === "guest";
  const router = useRouter();
  
  const currentUser = profile || {
    id: "u1",
    full_name: "Mark Antipo",
    username: "mark_antipo",
    avatar_url: null,
    bio: "Full stack developer & capstone project lead.",
    department_name: null,
    year_level: "3rd Year",
    skills: ["React Native", "PostgreSQL", "Node.js"],
  };

  const getInitials = (name: string | null) => {
    if (!name) return "??";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    if (!currentUser.id || currentUser.id === 'guest' || isGuest) {
      setLoadingPosts(false);
      setMyPosts([]);
      return;
    }
    
    const fetchPosts = async () => {
      setLoadingPosts(true);
      let posts: any[] = [];

      try {
        const res = await apiFetch(`/posts`);
        if (res.ok) {
          const allPosts = await res.json();
          posts = allPosts.filter((p: any) => p.author_id === currentUser.id);
        }
      } catch (err) {
        console.error("Failed to load user posts from SQL backend:", err);
      }
        
      if (posts && posts.length > 0) {
        const formattedPosts = posts.map((row: any) => ({
          id: row.id,
          author: {
            id: currentUser.id,
            name: currentUser.full_name,
            initials: getInitials(currentUser.full_name),
            avatarColor: "#BFDBFE",
            course: currentUser.department_name,
            yearLevel: currentUser.year_level,
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
        setMyPosts(formattedPosts);
      } else {
        setMyPosts([]);
      }
      setLoadingPosts(false);
    };
    
    fetchPosts();
  }, [currentUser.id, isGuest]);

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

          <View style={{ flexDirection: "row", marginTop: 12, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MapPin size={14} color={colors.textTertiary} />
              <Text style={{ fontSize: 13, color: colors.textTertiary, marginLeft: 4 }}>Bacolod City</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Calendar size={14} color={colors.textTertiary} />
              <Text style={{ fontSize: 13, color: colors.textTertiary, marginLeft: 4 }}>Joined Aug 2023</Text>
            </View>
          </View>

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
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>{myPosts.length}</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Projects</Text>
            </View>
            <View style={{ flex: 1, alignItems: "center", borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>{myPosts.reduce((s, p) => s + p.likes, 0)}</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Likes</Text>
            </View>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>{myPosts.reduce((s, p) => s + p.comments, 0)}</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Comments</Text>
            </View>
          </View>
        </View>

        {/* Portfolio */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textPrimary, marginBottom: 16 }}>Portfolio</Text>
          {myPosts.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Text style={{ fontSize: 15, color: colors.textTertiary, fontWeight: "500" }}>No posts yet</Text>
            </View>
          ) : (
            myPosts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}