import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search as SearchIcon, Filter } from "lucide-react-native";
import PostCard from "../src/components/PostCard";
import { PROTOTYPE_POSTS, type PostType } from "../src/data/prototype";

type SearchFilter = "all" | "people" | "posts" | "projects" | "capstones";

const FILTERS: { label: string; value: SearchFilter }[] = [
  { label: "All", value: "all" },
  { label: "People", value: "people" },
  { label: "Posts", value: "posts" },
  { label: "Projects", value: "projects" },
  { label: "Capstones", value: "capstones" },
];

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<SearchFilter>("all");

  const filteredPosts = PROTOTYPE_POSTS.filter((post) => {
    const titleMatch = post.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = post.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const contentMatch = (post as any).content?.toLowerCase().includes(searchQuery.toLowerCase());
    const authorMatch = post.author?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesQuery = titleMatch || descMatch || contentMatch || authorMatch;
    
    let matchesFilter = true;
    if (activeFilter === "posts") matchesFilter = post.type === "text" || post.type === "image" || post.type === "website"; // 'website' for legacy mock
    if (activeFilter === "projects") matchesFilter = post.type === "project";
    if (activeFilter === "capstones") matchesFilter = post.type === "capstone" || post.type === "thesis";
    if (activeFilter === "people") matchesFilter = authorMatch; // For now, just show posts by matching author if people

    return matchesQuery && matchesFilter;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F0F7FF" }}>
      <View style={{ padding: 16, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#DBEAFE" }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#1E293B", marginBottom: 12 }}>Explore</Text>
        
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ 
            flex: 1, 
            flexDirection: "row", 
            alignItems: "center", 
            backgroundColor: "#F1F5F9", 
            borderRadius: 12, 
            paddingHorizontal: 12,
            height: 44
          }}>
            <SearchIcon size={18} color="#94A3B8" />
            <TextInput
              style={{ flex: 1, marginLeft: 8, fontSize: 15, color: "#1E293B" }}
              placeholder="Search students, projects, or posts..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity style={{ 
            width: 44, 
            height: 44, 
            backgroundColor: "#1A56DB", 
            borderRadius: 12, 
            alignItems: "center", 
            justifyContent: "center",
            marginLeft: 10
          }}>
            <Filter size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.value;
            return (
              <TouchableOpacity
                key={filter.value}
                onPress={() => setActiveFilter(filter.value)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: isActive ? "#1A56DB" : "#F1F5F9",
                  borderRadius: 20,
                  marginRight: 8,
                  borderWidth: 1,
                  borderColor: isActive ? "#1A56DB" : "#E2E8F0"
                }}
              >
                <Text style={{ 
                  fontSize: 13, 
                  fontWeight: isActive ? "700" : "500", 
                  color: isActive ? "#FFFFFF" : "#64748B" 
                }}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={{ paddingVertical: 16 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", justifyContent: "center", padding: 40, marginTop: 40 }}>
            <SearchIcon size={48} color="#CBD5E1" />
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#64748B", marginTop: 16 }}>No results found</Text>
            <Text style={{ fontSize: 14, color: "#94A3B8", textAlign: "center", marginTop: 8 }}>
              Try adjusting your search or filters to find what you're looking for.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}