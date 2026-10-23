import { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, Linking, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search as SearchIcon, BookOpen, UploadCloud } from "lucide-react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";
import { apiFetch } from "../../src/lib/api";

export default function SearchScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"All" | "Undergraduate Capstone" | "Graduate Dissertation">("All");
  const { colors } = useTheme();
  
  const [theses, setTheses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchTheses = useCallback(async () => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);

    try {
      const params = ["limit=100"];
      if (debouncedQuery) params.push(`q=${encodeURIComponent(debouncedQuery)}`);
      if (activeFilter !== "All") {
        params.push(`category=${encodeURIComponent(activeFilter)}`);
      }

      const res = await apiFetch(`/theses?${params.join("&")}`);
      if (currentRequest !== requestId.current) return;

      if (res.ok) {
        const data = await res.json();
        setTheses(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load theses from SQL backend:", err);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [activeFilter, debouncedQuery]);

  useFocusEffect(
    useCallback(() => {
      void fetchTheses();
    }, [fetchTheses])
  );

  const ThesisCard = ({ item }: { item: any }) => (
    <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 4 }}>{item.title}</Text>
          <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: "500" }}>
            {(item.uploader?.full_name || item.author?.full_name || "Unknown User")} • {item.uploader?.department_name || item.department || "—"}
          </Text>
        </View>
        <View style={{ backgroundColor: item.category === "Graduate Dissertation" ? colors.badgeImageBg : colors.badgeWebsiteBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: item.category === "Graduate Dissertation" ? colors.badgeImageText : colors.badgeWebsiteText }}>
            {item.category === "Graduate Dissertation" ? "GRADUATE" : "UNDERGRAD"}
          </Text>
        </View>
      </View>
      
      <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 14 }} numberOfLines={3}>
        {item.abstract}
      </Text>
      
      <TouchableOpacity 
        onPress={() => item.pdf_url && Linking.openURL(item.pdf_url)}
        style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.actionSurface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
      >
        <BookOpen size={16} color={colors.action} style={{ marginRight: 6 }} />
        <Text style={{ color: colors.action, fontWeight: "600", fontSize: 13 }}>Read Manuscript</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <View style={{ padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.textPrimary }}>Repository</Text>
          <TouchableOpacity 
            onPress={() => router.push("/upload-thesis")}
            style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.action, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 }}
          >
            <UploadCloud size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>Deposit</Text>
          </TouchableOpacity>
        </View>
        
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSunken, borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: colors.border }}>
            <SearchIcon size={18} color={colors.textTertiary} />
            <TextInput
              style={{ flex: 1, marginLeft: 8, fontSize: 15, color: colors.textPrimary }}
              placeholder="Search by title, author, or keyword..."
              placeholderTextColor={colors.textTertiary}
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
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: isActive ? colors.action : colors.surfaceSunken,
                  borderRadius: 20,
                  marginRight: 8,
                  borderWidth: 1,
                  borderColor: isActive ? colors.action : colors.border,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: isActive ? "700" : "500", color: isActive ? "#FFFFFF" : colors.textSecondary }}>
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.action} />
        </View>
      ) : (
        <FlatList
          data={theses}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ThesisCard item={item} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", padding: 40, marginTop: 40 }}>
              <BookOpen size={48} color={colors.textTertiary} />
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textPrimary, marginTop: 16 }}>No manuscripts found</Text>
              <Text style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", marginTop: 8 }}>
                There are no theses matching your search yet.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}