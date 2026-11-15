import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Linking,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import {
  GraduationCap,
  Search as SearchIcon,
  FileText,
  ExternalLink,
  Building2,
  RefreshCw,
  X,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";
import { apiFetch, getThesisFileUrl } from "../../src/lib/api";
import { fetchDepartments } from "../../src/lib/catalog";
import type { Department } from "../../src/types";
import { RADIUS, SPACE } from "../../src/lib/tokens";

export default function CapstonesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;

  const [theses, setTheses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", "Undergraduate Capstone", "Graduate Dissertation"];

  // Load department options
  useEffect(() => {
    fetchDepartments()
      .then(setDepartments)
      .catch(() => {});
  }, []);

  const loadTheses = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "30");
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      if (selectedDeptId) {
        params.set("department_id", selectedDeptId);
      }
      if (selectedCategory !== "All") {
        params.set("category", selectedCategory);
      }

      const res = await apiFetch(`/theses?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTheses(Array.isArray(data) ? data : data.theses || []);
      }
    } catch (err: any) {
      console.error("Failed to load capstones:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, selectedDeptId, selectedCategory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTheses();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadTheses]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTheses();
  };

  const handleOpenPdf = async (item: any) => {
    if (!item.pdf_url) {
      Alert.alert("Manuscript unavailable", "This capstone does not have an attached PDF.");
      return;
    }
    try {
      const url = await getThesisFileUrl(item.id);
      await Linking.openURL(url);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to open manuscript URL");
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
            {item.uploader?.full_name || item.author?.full_name || "Academic Author"} •{" "}
            {item.uploader?.department_name || item.department || "Academic Department"}
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            {
              backgroundColor:
                item.category === "Graduate Dissertation"
                  ? colors.badgeImageBg
                  : colors.badgeWebsiteBg,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color:
                  item.category === "Graduate Dissertation"
                    ? colors.badgeImageText
                    : colors.badgeWebsiteText,
              },
            ]}
          >
            {item.category === "Graduate Dissertation" ? "GRADUATE" : "CAPSTONE"}
          </Text>
        </View>
      </View>

      <Text style={[styles.abstract, { color: colors.textSecondary }]} numberOfLines={3}>
        {item.abstract || "No abstract provided for this manuscript."}
      </Text>

      <View style={styles.cardFooter}>
        <TouchableOpacity
          onPress={() => handleOpenPdf(item)}
          style={[styles.pdfButton, { backgroundColor: colors.action }]}
          accessibilityRole="button"
          accessibilityLabel="Read Manuscript PDF"
        >
          <FileText size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.pdfButtonText}>Read Manuscript</Text>
          <ExternalLink size={13} color="#FFFFFF" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surfacePage }]}>
      {/* Header Banner */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.headerIconCircle, { backgroundColor: colors.surfaceSunken }]}>
            <GraduationCap size={24} color={colors.action} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              Academic Capstones
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textTertiary }]}>
              Explore student theses, capstone projects, and graduate research
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
          ]}
        >
          <SearchIcon size={18} color={colors.textTertiary} style={{ marginRight: 10 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search capstone titles, abstracts, or authors..."
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")} accessibilityLabel="Clear search">
              <X size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category & Department Filters */}
        <View style={styles.filtersRow}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.filterPill,
                {
                  backgroundColor:
                    selectedCategory === cat ? colors.action : colors.surfaceSunken,
                  borderColor: selectedCategory === cat ? colors.action : colors.border,
                },
              ]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.filterPillText,
                  { color: selectedCategory === cat ? "#FFFFFF" : colors.textPrimary },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Department Select if available */}
          {departments.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                if (selectedDeptId) {
                  setSelectedDeptId(null);
                } else {
                  setSelectedDeptId(departments[0]?.id || null);
                }
              }}
              style={[
                styles.filterPill,
                {
                  backgroundColor: selectedDeptId ? colors.brandSolid : colors.surfaceSunken,
                  borderColor: selectedDeptId ? colors.brandSolid : colors.border,
                },
              ]}
            >
              <Building2
                size={14}
                color={selectedDeptId ? "#FFFFFF" : colors.textSecondary}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.filterPillText,
                  { color: selectedDeptId ? "#FFFFFF" : colors.textPrimary },
                ]}
              >
                {selectedDeptId
                  ? departments.find((d) => d.id === selectedDeptId)?.name || "Department"
                  : "All Departments"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main List */}
      {loading && !refreshing ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.action} />
          <Text style={[styles.loadingText, { color: colors.textTertiary }]}>
            Loading capstones...
          </Text>
        </View>
      ) : (
        <FlatList
          data={theses}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            theses.length === 0 && { flex: 1, justifyContent: "center" },
          ]}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSunken }]}>
                <GraduationCap size={36} color={colors.textTertiary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                No capstones found
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                Try adjusting your search terms or filter selections.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  headerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  filtersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 12.5,
    marginTop: 3,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  abstract: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
  },
  pdfButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  pdfButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  centerLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13.5,
    textAlign: "center",
    maxWidth: 320,
  },
});
