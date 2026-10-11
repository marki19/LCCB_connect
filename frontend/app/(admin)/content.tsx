import { useState, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";

export default function AdminContentScreen() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
      try {
        const res = await fetch(`${apiUrl}/posts`);
        if (res.ok) {
          const data = await res.json();
          setPosts(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to load posts:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  return (
    <ScrollView className="flex-1 p-8" showsVerticalScrollIndicator={false}>
      <View className="mb-8">
        <Text className="text-3xl font-black text-slate-900 tracking-tight">Content Moderation</Text>
        <Text className="text-slate-500 text-lg mt-1">Review live broadcasts and project posts directly from PostgreSQL.</Text>
      </View>

      <View className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm min-h-[500px]">
        {loading ? (
          <ActivityIndicator size="large" color="#1D4ED8" />
        ) : posts.length === 0 ? (
          <Text className="text-slate-500 text-sm italic">No posts found in database.</Text>
        ) : (
          <View>
            <View className="flex-row border-b border-slate-200 pb-3 mb-3">
              <Text className="flex-1 font-bold text-slate-700 w-32">Type</Text>
              <Text className="flex-2 font-bold text-slate-700 w-48">Author</Text>
              <Text className="flex-3 font-bold text-slate-700 w-72">Content / Title</Text>
              <Text className="flex-1 font-bold text-slate-700 w-24">Likes</Text>
            </View>
            {posts.map((p) => (
              <View key={p.id} className="flex-row items-center py-3 border-b border-slate-100">
                <Text className="text-blue-600 font-semibold text-xs uppercase w-32">{p.type || "text"}</Text>
                <Text className="text-slate-800 font-medium w-48">{p.author?.full_name || p.author?.username || "—"}</Text>
                <Text numberOfLines={1} className="text-slate-600 text-sm w-72">{p.title || p.content || "—"}</Text>
                <Text className="text-slate-500 text-sm w-24">{p.likes || 0}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
