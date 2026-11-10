import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  Linking,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search as SearchIcon, BookOpen, UploadCloud } from "lucide-react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";
import { apiFetch, getThesisFileUrl } from "../../src/lib/api";
import { focusRing, RADIUS, SPACE, TYPE } from "../../src/lib/tokens";
import Button from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import Reveal from "../../src/components/ui/Reveal";
import { Skeleton } from "../../src/components/ui/Skeleton";
import EmptyState from "../../src/components/admin/EmptyState";
import Modal from "../../src/components/ui/Modal";

type Filter = "All" | "Undergraduate Capstone" | "Graduate Dissertation";

const FILTERS: Filter[] = ["All", "Undergraduate Capstone", "Graduate Dissertation"];

function categoryLabel(category?: string) {
  return category === "Graduate Dissertation" ? "Graduate" : "Undergraduate";
}

export default function SearchScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [theses, setTheses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
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

  const openManuscript = async (item: any) => {
    if (!item.pdf_url) return;
    try {
      // Manuscripts are private (migration 015): the list response carries the
      // raw object key, not a usable URL. Ask the backend for a short-lived
      // signed URL before opening it.
      const url = await getThesisFileUrl(item.id);
      await Linking.openURL(url);
    } catch (err: any) {
      setNotice(err.message || "The file is not available.");
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setActiveFilter("All");
  };

  const ThesisCard = ({ item, index }: { item: any; index: number }) => (
    <Reveal delay={Math.min(index, 6) * 40}>
      <Card style={{ marginBottom: SPACE.x3 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: SPACE.x3,
            marginBottom: SPACE.x2,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...TYPE.title, color: colors.ink }}>{item.title}</Text>
            <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: SPACE.x1 }}>
              {item.uploader?.full_name || item.author?.full_name || "Unknown User"}
              {" · "}
              {item.uploader?.department_name || item.department || "—"}
            </Text>
          </View>
          <View
            style={{
              backgroundColor:
                item.category === "Graduate Dissertation"
                  ? colors.badgeImageBg
                  : colors.badgeWebsiteBg,
              paddingHorizontal: SPACE.x2,
              paddingVertical: 4,
              borderRadius: RADIUS.pill,
            }}
          >
            <Text
              style={{
                ...TYPE.micro,
                fontSize: 9,
                color:
                  item.category === "Graduate Dissertation"
                    ? colors.badgeImageText
                    : colors.badgeWebsiteText,
              }}
            >
              {categoryLabel(item.category)}
            </Text>
          </View>
        </View>

        <Text
          numberOfLines={3}
          style={{ ...TYPE.body, color: colors.inkSoft, marginBottom: SPACE.x4 }}
        >
          {item.abstract}
        </Text>

        <Button
          label="Read manuscript"
          variant="subtle"
          size="sm"
          icon={BookOpen}
          onPress={() => void openManuscript(item)}
          accessibilityLabel={`Read manuscript: ${item.title}`}
        />
      </Card>
    </Reveal>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: SPACE.x10 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 880,
            alignSelf: "center",
            paddingHorizontal: SPACE.x4,
            paddingTop: SPACE.x5,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: isWide ? "row" : "column",
              alignItems: isWide ? "flex-end" : "flex-start",
              justifyContent: "space-between",
              gap: SPACE.x4,
              marginBottom: SPACE.x5,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>Academic archive</Text>
              <Text style={{ ...TYPE.h1, color: colors.ink, marginTop: SPACE.x1 }}>
                Repository
              </Text>
              <Text
                style={{
                  ...TYPE.body,
                  color: colors.inkSoft,
                  marginTop: SPACE.x2,
                  maxWidth: 520,
                }}
              >
                Browse capstones and dissertations deposited by the LCCB community.
              </Text>
            </View>
            <Button
              label="Deposit thesis"
              icon={UploadCloud}
              onPress={() => router.push("/upload-thesis")}
              accessibilityLabel="Deposit a thesis"
            />
          </View>

          {/* Search */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.x2,
              backgroundColor: colors.inputBg,
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: searchFocused ? colors.inputBorderFocus : colors.inputBorder,
              paddingHorizontal: SPACE.x3,
              minHeight: 50,
              ...focusRing(colors, searchFocused),
            }}
          >
            <SearchIcon size={18} color={searchFocused ? colors.primary : colors.textTertiary} />
            <TextInput
              style={{
                flex: 1,
                fontSize: 15,
                color: colors.textPrimary,
                paddingVertical: SPACE.x3,
                outlineStyle: "none",
              } as any}
              placeholder="Search by title, author, or keyword…"
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              accessibilityLabel="Search the thesis archive"
            />
            {searchQuery ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setSearchQuery("")}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: SPACE.x1 })}
              >
                <Text style={{ ...TYPE.caption, color: colors.textTertiary }}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Filters */}
          <ScrollView
            horizontal
            accessibilityRole="tablist"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: SPACE.x2, paddingVertical: SPACE.x4 }}
          >
            {FILTERS.map((filter) => {
              const isActive = activeFilter === filter;
              return (
                <Pressable
                  key={filter}
                  accessibilityRole="tab"
                  accessibilityLabel={`Show ${filter}`}
                  accessibilityState={{ selected: isActive }}
                  onPress={() => setActiveFilter(filter)}
                  style={({ pressed }) => ({
                    minHeight: 40,
                    justifyContent: "center",
                    paddingHorizontal: SPACE.x4,
                    borderRadius: RADIUS.pill,
                    borderWidth: 1,
                    borderColor: isActive ? colors.primary : colors.border,
                    backgroundColor: isActive
                      ? colors.primary
                      : pressed
                      ? colors.surfaceSunken
                      : colors.surface,
                  })}
                >
                  <Text
                    style={{
                      ...TYPE.caption,
                      fontWeight: "700",
                      color: isActive ? colors.textOnPrimary : colors.textSecondary,
                    }}
                  >
                    {filter === "All"
                      ? "All works"
                      : filter === "Undergraduate Capstone"
                      ? "Capstones"
                      : "Dissertations"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {!loading ? (
            <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginBottom: SPACE.x3 }}>
              {theses.length} {theses.length === 1 ? "manuscript" : "manuscripts"}
              {debouncedQuery ? ` matching “${debouncedQuery}”` : ""}
            </Text>
          ) : null}

          {loading ? (
            <View style={{ gap: SPACE.x3 }}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: colors.panel,
                    borderRadius: RADIUS.xl,
                    borderWidth: 1,
                    borderColor: colors.line,
                    padding: SPACE.x5,
                    gap: SPACE.x3,
                  }}
                >
                  <Skeleton width="62%" height={18} radius={6} />
                  <Skeleton width="38%" height={11} radius={5} />
                  <Skeleton height={12} radius={6} />
                  <Skeleton width="82%" height={12} radius={6} />
                  <Skeleton width={140} height={34} radius={RADIUS.md} />
                </View>
              ))}
            </View>
          ) : theses.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.panel,
                borderRadius: RADIUS.xxl,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <EmptyState
                icon={BookOpen}
                tone="brand"
                title="No manuscripts found"
                body={
                  debouncedQuery || activeFilter !== "All"
                    ? "Nothing matches this search. Try a different keyword or clear the filters."
                    : "There are no theses in the archive yet. Deposit the first one."
                }
                actionLabel={
                  debouncedQuery || activeFilter !== "All" ? "Clear filters" : "Deposit a thesis"
                }
                onAction={
                  debouncedQuery || activeFilter !== "All"
                    ? clearFilters
                    : () => router.push("/upload-thesis")
                }
              />
            </View>
          ) : (
            <FlatList
              data={theses}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item, index }) => <ThesisCard item={item} index={index} />}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </ScrollView>

      <Modal
        visible={!!notice}
        onClose={() => setNotice(null)}
        maxWidth={420}
        accessibilityLabel="Notice"
      >
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>Could not open manuscript</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
            {notice}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: SPACE.x5 }}>
            <Button label="Got it" onPress={() => setNotice(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
