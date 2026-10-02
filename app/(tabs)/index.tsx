import { useState, useCallback } from "react";
import { View, FlatList, RefreshControl, Text, ScrollView, TouchableOpacity } from "react-native";
import HomeHeader from "../../src/components/HomeHeader";
import PostCard from "../../src/components/PostCard";
import SettingsSidebar from "../../src/components/SettingsSidebar";
import { PROTOTYPE_POSTS, type Post } from "../../src/data/prototype";
import { supabase } from "../../src/lib/supabase";
import { useFocusEffect } from "expo-router";

function shuffleArray<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function HomeScreen() {
  const [posts, setPosts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "projects" | "discussions" | "images">("all");

  const fetchPosts = async () => {
    let query = supabase
      .from('posts')
      .select('*, author:profiles(*)')
      .order('created_at', { ascending: false });

    if (filter === "projects") {
      query = query.in('type', ['project', 'capstone']);
    } else if (filter === "discussions") {
      query = query.eq('type', 'text');
    } else if (filter === "images") {
      query = query.eq('type', 'image');
    }

    const { data, error } = await query;

    if (!error && data) {
      const formattedPosts = data.map((row: any) => {
        const authorName = row.author?.full_name || "Unknown User";
        return {
          id: row.id,
          author: {
            id: row.author_id,
            name: authorName,
            initials: authorName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase(),
            avatarColor: "#BFDBFE",
            course: row.author?.course || "—",
            yearLevel: row.author?.year_level || "—",
          },
          title: row.title,
          description: row.description,
          type: row.type,
          tags: row.tags || [],
          previewUrl: row.preview_url,
          imageUrl: row.image_url,
          likes: row.likes || 0,
          comments: row.comments || 0,
          createdAt: new Date(row.created_at).toLocaleDateString(),
          isLiked: false,
        };
      });
      setPosts(formattedPosts);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
    }, [filter])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts();
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
          backgroundColor: active ? "#1D4ED8" : "#EFF6FF",
          marginRight: 8 
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#FFFFFF" : "#1D4ED8" }}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F0F7FF" }}>
      <HomeHeader onMenuPress={() => setSidebarOpen(true)} />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <View
              style={{
                marginHorizontal: 16,
                marginBottom: 12,
                padding: 14,
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "#DBEAFE",
                flexDirection: "row",
                alignItems: "center",
                shadowColor: "#1A56DB",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: "#BFDBFE",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 10,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#1E293B" }}>MS</Text>
              </View>
              <View
                style={{
                  flex: 1,
                  height: 38,
                  backgroundColor: "#F0F7FF",
                  borderRadius: 19,
                  borderWidth: 1,
                  borderColor: "#DBEAFE",
                  justifyContent: "center",
                  paddingHorizontal: 14,
                }}
              >
                <Text style={{ color: "#94A3B8", fontSize: 13 }}>
                  Share your project or thesis...
                </Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
              <FilterTab label="All Posts" value="all" />
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
            colors={["#1A56DB"]}
            tintColor="#1A56DB"
          />
        }
      />

      <SettingsSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </View>
  );
}
