import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Linking,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  StyleSheet,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Search as SearchIcon,
  BookOpen,
  UploadCloud,
  Users,
  MessageSquare,
  Sparkles,
  X,
  ChevronRight,
  ExternalLink,
  GraduationCap,
  FileText,
} from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useAuth } from "../../src/contexts/AuthContext";
import { usePresence } from "../../src/contexts/PresenceContext";
import { useFloatingChat } from "../../src/contexts/FloatingChatContext";
import { apiFetch, getThesisFileUrl, searchEverything, adaptPost } from "../../src/lib/api";
import { openConversation } from "../../src/lib/messages";
import Avatar from "../../src/components/Avatar";
import PostCard from "../../src/components/PostCard";
import { RADIUS, SPACE, elevation } from "../../src/lib/tokens";

type SearchTab = "all" | "people" | "posts" | "theses";

const TABS: { id: SearchTab; label: string; Icon: any }[] = [
  { id: "all", label: "All", Icon: Sparkles },
  { id: "people", label: "People", Icon: Users },
  { id: "posts", label: "Posts", Icon: MessageSquare },
  { id: "theses", label: "Repository", Icon: BookOpen },
];

const THESIS_CATEGORIES = ["All", "Undergraduate Capstone", "Graduate Dissertation"] as const;

export default function SearchScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ q?: string; tab?: string; type?: string }>();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { isOnline, modeOf } = usePresence();
  const { openChat } = useFloatingChat();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;

  const initialTab: SearchTab =
    searchParams.tab === "people" || searchParams.type === "people"
      ? "people"
      : searchParams.tab === "posts" || searchParams.type === "posts"
      ? "posts"
      : searchParams.tab === "theses" || searchParams.tab === "papers" || searchParams.type === "theses" || searchParams.type === "capstone"
      ? "theses"
      : "all";

  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState(searchParams.q || "");
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.q || "");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // Results state
  const [loading, setLoading] = useState(false);
  const [people, setPeople] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [theses, setTheses] = useState<any[]>([]);
  const [counts, setCounts] = useState<{ people: number; posts: number; theses: number; total: number }>({
    people: 0,
    posts: 0,
    theses: 0,
    total: 0,
  });

  const requestId = useRef(0);

  // Sync external params if changed
  useEffect(() => {
    if (searchParams.q !== undefined && searchParams.q !== searchQuery) {
      setSearchQuery(searchParams.q);
    }
  }, [searchParams.q]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Main search / fetch runner
  const executeSearch = useCallback(async () => {
    const currentReq = requestId.current + 1;
    requestId.current = currentReq;
    setLoading(true);

    try {
      if (!debouncedQuery) {
        // When query is empty:
        // If in "theses" tab, fetch recent repository items for browsing
        if (activeTab === "theses") {
          const params = ["limit=50"];
          if (activeCategory !== "All") {
            params.push(`category=${encodeURIComponent(activeCategory)}`);
          }
          const res = await apiFetch(`/theses?${params.join("&")}`);
          if (currentReq !== requestId.current) return;
          if (res.ok) {
            const data = await res.json();
            setTheses(Array.isArray(data) ? data : []);
          }
          setPeople([]);
          setPosts([]);
          setCounts({ people: 0, posts: 0, theses: 0, total: 0 });
        } else {
          setPeople([]);
          setPosts([]);
          setTheses([]);
          setCounts({ people: 0, posts: 0, theses: 0, total: 0 });
        }
        return;
      }

      // Query is present: call multi-entity search API
      const searchType = activeTab;
      const res = await searchEverything(debouncedQuery, searchType, 30);
      if (currentReq !== requestId.current) return;

      if (activeTab === "all") {
        setPeople(res.people || []);
        setPosts((res.posts || []).map(adaptPost));
        setTheses(res.theses || []);
        setCounts(res.counts || { people: 0, posts: 0, theses: 0, total: 0 });
      } else if (activeTab === "people") {
        setPeople(res.people || []);
        setCounts((c) => ({ ...c, people: res.count || res.people?.length || 0 }));
      } else if (activeTab === "posts") {
        setPosts((res.posts || []).map(adaptPost));
        setCounts((c) => ({ ...c, posts: res.count || res.posts?.length || 0 }));
      } else if (activeTab === "theses") {
        const filtered =
          activeCategory === "All"
            ? res.theses || []
            : (res.theses || []).filter((t: any) => t.category === activeCategory);
        setTheses(filtered);
        setCounts((c) => ({ ...c, theses: filtered.length }));
      }
    } catch (err) {
      console.error("Search execution failed:", err);
    } finally {
      if (currentReq === requestId.current) {
        setLoading(false);
      }
    }
  }, [debouncedQuery, activeTab, activeCategory]);

  useEffect(() => {
    executeSearch();
  }, [executeSearch]);

  const handleStartChat = async (person: any) => {
    if (!profile?.id || profile.role === "guest") {
      Alert.alert("Sign In Required", "Please sign in with your campus account to message peers.");
      return;
    }
    const name = person.full_name || person.username || "Peer";
    if (isDesktop) {
      openChat({
        peerId: person.id,
        peerName: name,
        avatarUrl: person.avatar_url,
      });
    } else {
      try {
        const conv = await openConversation(person.id);
        router.push(`/messages/${conv.id}`);
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to start conversation");
      }
    }
  };

  const renderPeopleCard = (person: any) => {
    const name = person.full_name || person.username || "Peer";
    const dept = person.department_name || person.course || "LCCB Campus";
    return (
      <View
        key={person.id}
        style={[
          styles.peopleCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Avatar
          name={name}
          size={52}
          showPresence
          mode={modeOf(person.id)}
        />
        <View style={styles.peopleInfo}>
          <TouchableOpacity
            onPress={() => router.push(`/profile/${person.id}`)}
            accessibilityRole="link"
          >
            <Text style={[styles.peopleName, { color: colors.textPrimary }]} numberOfLines={1}>
              {name}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.peopleUsername, { color: colors.textTertiary }]} numberOfLines={1}>
            @{person.username || "user"}
          </Text>
          <Text style={[styles.peopleDept, { color: colors.textSecondary }]} numberOfLines={1}>
            {dept} {person.year_level ? `· Year ${person.year_level}` : ""}
          </Text>
        </View>
        <View style={styles.peopleActions}>
          <TouchableOpacity
            onPress={() => handleStartChat(person)}
            style={[styles.chatBtn, { backgroundColor: colors.action }]}
            accessibilityRole="button"
            accessibilityLabel={`Message ${name}`}
          >
            <MessageSquare size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.chatBtnText}>Message</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderThesisCard = (item: any) => (
    <View
      key={item.id}
      style={[
        styles.thesisCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.thesisHeader}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={[styles.thesisTitle, { color: colors.textPrimary }]}>{item.title}</Text>
          <Text style={[styles.thesisAuthor, { color: colors.textTertiary }]}>
            {item.uploader?.full_name || item.author?.full_name || "Academic Author"} •{" "}
            {item.uploader?.department_name || item.department || "Academic Department"}
          </Text>
        </View>
        <View
          style={[
            styles.categoryBadge,
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
              styles.categoryBadgeText,
              {
                color:
                  item.category === "Graduate Dissertation"
                    ? colors.badgeImageText
                    : colors.badgeWebsiteText,
              },
            ]}
          >
            {item.category === "Graduate Dissertation" ? "GRADUATE" : "UNDERGRAD"}
          </Text>
        </View>
      </View>

      <Text style={[styles.thesisAbstract, { color: colors.textSecondary }]} numberOfLines={3}>
        {item.abstract}
      </Text>

      <TouchableOpacity
        onPress={async () => {
          if (!item.pdf_url) return;
          try {
            const url = await getThesisFileUrl(item.id);
            await Linking.openURL(url);
          } catch (err: any) {
            Alert.alert("Could not open manuscript", err.message || "The file is not available.");
          }
        }}
        style={[styles.readBtn, { backgroundColor: colors.actionSurface }]}
        accessibilityRole="button"
      >
        <BookOpen size={16} color={colors.action} style={{ marginRight: 6 }} />
        <Text style={[styles.readBtnText, { color: colors.action }]}>Read Manuscript</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAllTabContent = () => {
    const hasAnyResults = people.length > 0 || posts.length > 0 || theses.length > 0;

    if (!hasAnyResults && !loading) {
      return renderEmptyState();
    }

    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* People Section */}
        {people.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <Users size={18} color={colors.action} style={{ marginRight: 6 }} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>People</Text>
                <View style={[styles.sectionCountPill, { backgroundColor: colors.surfaceSunken }]}>
                  <Text style={[styles.sectionCountText, { color: colors.textSecondary }]}>
                    {people.length}
                  </Text>
                </View>
              </View>
              {people.length > 3 && (
                <TouchableOpacity
                  onPress={() => setActiveTab("people")}
                  style={styles.seeAllBtn}
                  accessibilityRole="button"
                >
                  <Text style={[styles.seeAllText, { color: colors.action }]}>See all</Text>
                  <ChevronRight size={14} color={colors.action} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.cardsGrid}>{people.slice(0, 3).map(renderPeopleCard)}</View>
          </View>
        )}

        {/* Repository / Theses Section */}
        {theses.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <BookOpen size={18} color={colors.action} style={{ marginRight: 6 }} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Theses & Capstones
                </Text>
                <View style={[styles.sectionCountPill, { backgroundColor: colors.surfaceSunken }]}>
                  <Text style={[styles.sectionCountText, { color: colors.textSecondary }]}>
                    {theses.length}
                  </Text>
                </View>
              </View>
              {theses.length > 3 && (
                <TouchableOpacity
                  onPress={() => setActiveTab("theses")}
                  style={styles.seeAllBtn}
                  accessibilityRole="button"
                >
                  <Text style={[styles.seeAllText, { color: colors.action }]}>See all</Text>
                  <ChevronRight size={14} color={colors.action} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.cardsGrid}>{theses.slice(0, 3).map(renderThesisCard)}</View>
          </View>
        )}

        {/* Posts Section */}
        {posts.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <MessageSquare size={18} color={colors.action} style={{ marginRight: 6 }} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Posts</Text>
                <View style={[styles.sectionCountPill, { backgroundColor: colors.surfaceSunken }]}>
                  <Text style={[styles.sectionCountText, { color: colors.textSecondary }]}>
                    {posts.length}
                  </Text>
                </View>
              </View>
              {posts.length > 5 && (
                <TouchableOpacity
                  onPress={() => setActiveTab("posts")}
                  style={styles.seeAllBtn}
                  accessibilityRole="button"
                >
                  <Text style={[styles.seeAllText, { color: colors.action }]}>See all</Text>
                  <ChevronRight size={14} color={colors.action} />
                </TouchableOpacity>
              )}
            </View>
            {posts.map((p) => (
              <View key={p.id} style={{ marginBottom: SPACE.x2 }}>
                <PostCard post={p} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderEmptyState = () => {
    if (!debouncedQuery) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSunken }]}>
            <SearchIcon size={36} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Campus Search Engine
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
            Find classmates, professors, capstones, theses, and campus updates using natural keywords.
          </Text>
          <View style={styles.suggestionsRow}>
            {["Information Technology", "Architecture", "Thesis", "Capstone", "Alumni"].map((hint) => (
              <TouchableOpacity
                key={hint}
                onPress={() => setSearchQuery(hint)}
                style={[styles.suggestionChip, { backgroundColor: colors.surfaceSunken }]}
              >
                <Text style={[styles.suggestionChipText, { color: colors.textSecondary }]}>
                  {hint}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSunken }]}>
          <SearchIcon size={36} color={colors.textTertiary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No results found</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
          We couldn't find matches for "{debouncedQuery}". Try another keyword or check spelling.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.surfacePage }]} edges={["top"]}>
      {/* Top Search & Filter Header */}
      <View style={[styles.headerContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Search</Text>
          <TouchableOpacity
            onPress={() => router.push("/upload-thesis")}
            style={[styles.depositBtn, { backgroundColor: colors.action }]}
            accessibilityRole="button"
          >
            <UploadCloud size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.depositBtnText}>Deposit Thesis</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input Box */}
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
          ]}
        >
          <SearchIcon size={18} color={colors.textTertiary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search people, posts, theses, keywords..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearBtn}
              accessibilityRole="button"
              accessibilityLabel="Clear query"
            >
              <X size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Filters */}
        <View style={styles.tabsRow}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.Icon;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tabButton,
                  isActive && {
                    backgroundColor: colors.action,
                    borderColor: colors.action,
                  },
                  !isActive && {
                    backgroundColor: colors.surfaceSunken,
                    borderColor: colors.border,
                  },
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <TabIcon
                  size={15}
                  color={isActive ? "#FFFFFF" : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    {
                      color: isActive ? "#FFFFFF" : colors.textSecondary,
                      fontWeight: isActive ? "700" : "500",
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Repository Sub-Categories when Repository tab is active */}
        {activeTab === "theses" && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.subCategoryScroll}
            contentContainerStyle={{ paddingRight: SPACE.x4 }}
          >
            {THESIS_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setActiveCategory(cat)}
                  style={[
                    styles.subCategoryChip,
                    {
                      backgroundColor: isActive ? colors.actionSurface : colors.surfaceSunken,
                      borderColor: isActive ? colors.action : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.subCategoryChipText,
                      {
                        color: isActive ? colors.action : colors.textSecondary,
                        fontWeight: isActive ? "700" : "500",
                      },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Main Results View */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.action} />
          <Text style={[styles.loadingText, { color: colors.textTertiary }]}>
            Searching campus index...
          </Text>
        </View>
      ) : activeTab === "all" ? (
        renderAllTabContent()
      ) : activeTab === "people" ? (
        <FlatList
          data={people}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => renderPeopleCard(item)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
        />
      ) : activeTab === "posts" ? (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={{ marginBottom: SPACE.x2 }}>
              <PostCard post={item} />
            </View>
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
        />
      ) : (
        <FlatList
          data={theses}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => renderThesisCard(item)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: SPACE.x4,
    paddingTop: SPACE.x3,
    paddingBottom: SPACE.x3,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACE.x3,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  depositBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    borderRadius: RADIUS.pill,
  },
  depositBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACE.x3,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  clearBtn: {
    padding: SPACE.x1,
  },
  tabsRow: {
    flexDirection: "row",
    marginTop: SPACE.x3,
    gap: SPACE.x2,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  tabButtonText: {
    fontSize: 13,
  },
  subCategoryScroll: {
    marginTop: SPACE.x3,
  },
  subCategoryChip: {
    paddingHorizontal: SPACE.x3,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    marginRight: SPACE.x2,
  },
  subCategoryChipText: {
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 14,
    marginTop: SPACE.x3,
  },
  scrollContent: {
    padding: SPACE.x4,
  },
  listContent: {
    padding: SPACE.x4,
  },
  sectionContainer: {
    marginBottom: SPACE.x6,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACE.x3,
  },
  sectionTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  sectionCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    marginLeft: 8,
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: "700",
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    marginRight: 2,
  },
  cardsGrid: {
    gap: SPACE.x3,
  },
  peopleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACE.x3,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },
  peopleInfo: {
    flex: 1,
    marginLeft: SPACE.x3,
  },
  peopleName: {
    fontSize: 15,
    fontWeight: "700",
  },
  peopleUsername: {
    fontSize: 12,
    marginTop: 1,
  },
  peopleDept: {
    fontSize: 12,
    marginTop: 2,
  },
  peopleActions: {
    marginLeft: SPACE.x2,
  },
  chatBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x3,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  chatBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  thesisCard: {
    padding: SPACE.x4,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACE.x3,
  },
  thesisHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACE.x2,
  },
  thesisTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  thesisAuthor: {
    fontSize: 12,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  thesisAbstract: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: SPACE.x3,
  },
  readBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: SPACE.x3,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  readBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.x6,
    paddingVertical: SPACE.x8,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.x4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: SPACE.x2,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 340,
    marginBottom: SPACE.x4,
  },
  suggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: SPACE.x2,
  },
  suggestionChip: {
    paddingHorizontal: SPACE.x3,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  suggestionChipText: {
    fontSize: 12,
  },
});
