import { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, Linking, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search as SearchIcon, Filter, BookOpen, Download, UploadCloud } from "lucide-react-native";
import { useFocusEffect, useRouter } from "expo-router";

export default function SearchScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"All" | "Undergraduate Capstone" | "Graduate Dissertation">("All");
  
  const [theses, setTheses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTheses = async () => {
    setLoading(true);

    try {
      // 1. Fetch from raw SQL backend API
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${apiUrl}/theses`);
      if (res.ok) {
        const data = await res.json();
        let filtered = data;
        if (activeFilter !== "All") {
          filtered = filtered.filter((t: any) => t.category === activeFilter || t.category === "Capstone");
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter((t: any) =>
            t.title?.toLowerCase().includes(q) ||
            t.abstract?.toLowerCase().includes(q) ||
            (t.uploader?.full_name || t.author?.full_name)?.toLowerCase().includes(q)
          );
        }
        setTheses(filtered);
      }
    } catch (err) {
      console.error("Failed to load theses from SQL backend:", err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTheses();
    }, [activeFilter, searchQuery])
  );

  const ThesisCard = ({ item }: { item: any }) => (
    <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E2E8F0" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#1E293B", marginBottom: 4 }}>{item.title}</Text>
          <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "500" }}>
            {(item.uploader?.full_name || item.author?.full_name || "Unknown User")} • {item.department}
          </Text>
        </View>
        <View style={{ backgroundColor: item.category === "Graduate Dissertation" ? "#FCE7F3" : "#E0E7FF", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: item.category === "Graduate Dissertation" ? "#BE185D" : "#4338CA" }}>
            {item.category === "Graduate Dissertation" ? "GRADUATE" : "UNDERGRAD"}
          </Text>
        </View>
      </View>
      
      <Text style={{ fontSize: 14, color: "#475569", lineHeight: 20, marginBottom: 14 }} numberOfLines={3}>
        {item.abstract}
      </Text>
      
      <TouchableOpacity 
        onPress={() => item.pdf_url && Linking.openURL(item.pdf_url)}
        style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "#F1F5F9", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
      >
        <BookOpen size={16} color="#1A56DB" style={{ marginRight: 6 }} />
        <Text style={{ color: "#1A56DB", fontWeight: "600", fontSize: 13 }}>Read Manuscript</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F0F7FF" }}>
      <View style={{ padding: 16, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#DBEAFE" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: "#1E293B" }}>Repository</Text>
          <TouchableOpacity 
            onPress={() => router.push("/upload-thesis")}
            style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#1A56DB", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 }}
          >
            <UploadCloud size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>Deposit</Text>
          </TouchableOpacity>
        </View>
        
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 12, paddingHorizontal: 12, height: 44 }}>
            <SearchIcon size={18} color="#94A3B8" />
            <TextInput
              style={{ flex: 1, marginLeft: 8, fontSize: 15, color: "#1E293B" }}
              placeholder="Search by title, author, or keyword..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
          {["All", "Undergraduate Capstone", "Graduate Dissertation"].map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setActiveFilter(filter as any)}
                style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: isActive ? "#1A56DB" : "#F1F5F9", borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: isActive ? "#1A56DB" : "#E2E8F0" }}
              >
                <Text style={{ fontSize: 13, fontWeight: isActive ? "700" : "500", color: isActive ? "#FFFFFF" : "#64748B" }}>
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#1A56DB" />
        </View>
      ) : (
        <FlatList
          data={theses}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ThesisCard item={item} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", padding: 40, marginTop: 40 }}>
              <BookOpen size={48} color="#CBD5E1" />
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#64748B", marginTop: 16 }}>No manuscripts found</Text>
              <Text style={{ fontSize: 14, color: "#94A3B8", textAlign: "center", marginTop: 8 }}>
                There are no theses matching your search yet.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}