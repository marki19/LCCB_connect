import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Settings, MapPin, Calendar, LogOut } from "lucide-react-native";
import { PROTOTYPE_POSTS } from "../src/data/prototype";
import PostCard from "../src/components/PostCard";
import { useAuth } from "../src/contexts/AuthContext";
import { supabase } from "../src/lib/supabase";

export default function ProfileScreen() {
  const { profile } = useAuth();
  
  const currentUser = profile || {
    id: "guest",
    full_name: "Guest User",
    username: "guest",
    avatar_url: null,
    course: "—",
    year_level: "—",
    bio: "Passionate about UI/UX design and mobile development."
  };

  const getInitials = (name: string | null) => {
    if (!name) return "??";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // For now, filter mock posts by checking if the post author ID matches our current user ID, 
  // or just show empty if not found.
  const myPosts = PROTOTYPE_POSTS.filter((p) => p.author.id === currentUser.id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F0F7FF" }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover photo */}
        <View style={{ height: 120, backgroundColor: "#BFDBFE" }} />

        {/* Profile info */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 20, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#DBEAFE" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#BFDBFE", alignItems: "center", justifyContent: "center", marginTop: -40, borderWidth: 4, borderColor: "#FFFFFF" }}>
              <Text style={{ fontSize: 28, fontWeight: "800", color: "#1E293B" }}>{getInitials(currentUser.full_name)}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={{ padding: 8, backgroundColor: "#F1F5F9", borderRadius: 20 }}>
                <Settings size={20} color="#64748B" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSignOut} style={{ padding: 8, backgroundColor: "#FEE2E2", borderRadius: 20 }}>
                <LogOut size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={{ fontSize: 24, fontWeight: "800", color: "#1E293B", marginTop: 8 }}>{currentUser.full_name}</Text>
          <Text style={{ fontSize: 15, color: "#64748B", marginTop: 2, fontWeight: "500" }}>{currentUser.course} · {currentUser.year_level}</Text>

          <Text style={{ fontSize: 14, color: "#334155", marginTop: 12, lineHeight: 22 }}>
            {currentUser.bio || "No bio yet."}
          </Text>

          <View style={{ flexDirection: "row", marginTop: 12, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MapPin size={14} color="#94A3B8" />
              <Text style={{ fontSize: 13, color: "#64748B", marginLeft: 4 }}>Bacolod City</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Calendar size={14} color="#94A3B8" />
              <Text style={{ fontSize: 13, color: "#64748B", marginLeft: 4 }}>Joined Aug 2023</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={{ flexDirection: "row", marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#F1F5F9" }}>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#1E293B" }}>{myPosts.length}</Text>
              <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Projects</Text>
            </View>
            <View style={{ flex: 1, alignItems: "center", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#F1F5F9" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#1E293B" }}>{myPosts.reduce((s, p) => s + p.likes, 0)}</Text>
              <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Likes</Text>
            </View>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#1E293B" }}>{myPosts.reduce((s, p) => s + p.comments, 0)}</Text>
              <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Comments</Text>
            </View>
          </View>
        </View>

        {/* Portfolio */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#1E293B", marginBottom: 16 }}>Portfolio</Text>
          {myPosts.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Text style={{ fontSize: 15, color: "#94A3B8", fontWeight: "500" }}>No posts yet</Text>
            </View>
          ) : (
            myPosts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}