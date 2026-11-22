import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import {
  Folder,
  BookOpen,
  Search,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  ChevronRight,
} from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";
import { classifyRepositoryAssets } from "../../lib/repositoryExplorer";
import RepositoryExplorerView from "./RepositoryExplorerView";
import type { Post } from "../../types";

interface ProfileRepositoriesTabProps {
  repositories: Post[] | any[];
  loading: boolean;
  isSelf?: boolean;
}

type FilterKey = "all" | "project" | "capstone" | "thesis";

export default function ProfileRepositoriesTab({
  repositories,
  loading,
  isSelf = false,
}: ProfileRepositoriesTabProps) {
  const { colors } = useTheme();

  const [selectedRepo, setSelectedRepo] = useState<any | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  // Filter & Search Logic
  const filteredList = useMemo(() => {
    return repositories.filter((item) => {
      // 1. Filter by repository type
      const repoType = (
        item.repository_type ||
        (item.type === "thesis" ? "thesis" : "project")
      ).toLowerCase();

      if (filter !== "all" && repoType !== filter) {
        return false;
      }

      // 2. Filter by search query
      if (search.trim()) {
        const query = search.toLowerCase();
        const titleMatch = (item.title || "").toLowerCase().includes(query);
        const descMatch = (item.description || item.content || item.abstract || "")
          .toLowerCase()
          .includes(query);
        const categoryMatch = (item.repository_category || item.category || "")
          .toLowerCase()
          .includes(query);
        const tagsMatch = Array.isArray(item.tags)
          ? item.tags.some((t: string) => t.toLowerCase().includes(query))
          : false;

        return titleMatch || descMatch || categoryMatch || tagsMatch;
      }

      return true;
    });
  }, [repositories, filter, search]);

  // If a repository is drilled into, render the detailed GitHub-style explorer
  if (selectedRepo) {
    return (
      <RepositoryExplorerView
        post={selectedRepo}
        onBack={() => setSelectedRepo(null)}
      />
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All Repositories" },
    { key: "project", label: "Projects" },
    { key: "capstone", label: "Capstones" },
    { key: "thesis", label: "Theses / Research" },
  ];

  return (
    <View style={styles.container}>
      {/* Search & Filter Bar */}
      <View style={[styles.controlsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Search Input */}
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
          <Search size={16} color={colors.inkFaint} style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search projects by title, tool, or keyword..."
            placeholderTextColor={colors.inkFaint}
            style={[styles.searchInput, { color: colors.ink }]}
          />
        </View>

        {/* Filter Pills */}
        <View style={styles.filterPillsRow}>
          {filters.map((f) => {
            const isActive = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={({ pressed, hovered }: any) => [
                  styles.filterPill,
                  {
                    backgroundColor: isActive ? colors.brand : colors.surfaceSunken,
                    borderColor: isActive ? colors.brand : colors.border,
                    opacity: pressed ? 0.8 : hovered ? 0.9 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    {
                      color: isActive ? "#FFFFFF" : colors.inkSoft,
                      fontWeight: isActive ? "700" : "500",
                    },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Empty State */}
      {filteredList.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceSunken }]}>
            <Folder size={32} color={colors.inkFaint} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>
            {search.trim() ? "No matching repositories found" : "No repositories published"}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.inkFaint }]}>
            {search.trim()
              ? "Try adjusting your search query or filter."
              : isSelf
              ? "Publish your capstone, creative projects, or research papers to build your campus portfolio."
              : "This user has not published any public project repositories yet."}
          </Text>
        </View>
      ) : (
        /* Repository Cards List */
        <View style={styles.repoList}>
          {filteredList.map((item) => {
            const assets = classifyRepositoryAssets(item);
            const repoType = (
              item.repository_type ||
              (item.type === "thesis" ? "thesis" : "project")
            ).toUpperCase();
            const abstract = item.description || item.content || item.abstract || "";
            const category = item.repository_category || item.category;

            return (
              <Pressable
                key={item.id}
                onPress={() => setSelectedRepo(item)}
                accessibilityRole="button"
                accessibilityLabel={`Open repository ${item.title}`}
                style={({ pressed, hovered }: any) => [
                  styles.repoCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: hovered ? colors.brand : colors.border,
                    transform: [{ translateY: pressed ? 1 : hovered ? -1 : 0 }],
                  },
                ]}
              >
                {/* Card Top Row */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.repoIconWrap, { backgroundColor: colors.surfaceSunken }]}>
                      {repoType === "THESIS" ? (
                        <BookOpen size={18} color={colors.brand} />
                      ) : (
                        <Folder size={18} color={colors.brand} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.titleLine}>
                        <Text style={[styles.repoTitle, { color: colors.ink }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor: colors.brandWash,
                              borderColor: colors.brand,
                            },
                          ]}
                        >
                          <Text style={[styles.badgeText, { color: colors.brand }]}>
                            {repoType}
                          </Text>
                        </View>
                      </View>
                      {category ? (
                        <Text style={[styles.repoCategory, { color: colors.inkFaint }]}>
                          {category}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Abstract Preview */}
                {abstract ? (
                  <Text style={[styles.repoAbstract, { color: colors.inkSoft }]} numberOfLines={2}>
                    {abstract}
                  </Text>
                ) : null}

                {/* Tags */}
                {Array.isArray(item.tags) && item.tags.length > 0 && (
                  <View style={styles.tagChipsRow}>
                    {item.tags.slice(0, 4).map((tag: string, idx: number) => (
                      <View
                        key={idx}
                        style={[
                          styles.tagChip,
                          { backgroundColor: colors.surfaceSunken, borderColor: colors.line },
                        ]}
                      >
                        <Text style={[styles.tagText, { color: colors.inkSoft }]}>#{tag}</Text>
                      </View>
                    ))}
                    {item.tags.length > 4 && (
                      <Text style={[styles.tagOverflow, { color: colors.inkFaint }]}>
                        +{item.tags.length - 4} more
                      </Text>
                    )}
                  </View>
                )}

                {/* Bottom Stats & Explore Button */}
                <View style={[styles.cardFooter, { borderTopColor: colors.line }]}>
                  <View style={styles.assetCounts}>
                    {assets.documents.length > 0 && (
                      <View style={styles.countItem}>
                        <FileText size={13} color={colors.inkFaint} />
                        <Text style={[styles.countText, { color: colors.inkSoft }]}>
                          {assets.documents.length} doc{assets.documents.length === 1 ? "" : "s"}
                        </Text>
                      </View>
                    )}
                    {assets.media.length > 0 && (
                      <View style={styles.countItem}>
                        <ImageIcon size={13} color={colors.inkFaint} />
                        <Text style={[styles.countText, { color: colors.inkSoft }]}>
                          {assets.media.length} media
                        </Text>
                      </View>
                    )}
                    {assets.links.length > 0 && (
                      <View style={styles.countItem}>
                        <ExternalLink size={13} color={colors.inkFaint} />
                        <Text style={[styles.countText, { color: colors.inkSoft }]}>
                          {assets.links.length} link{assets.links.length === 1 ? "" : "s"}
                        </Text>
                      </View>
                    )}
                    {assets.allCount === 0 && (
                      <Text style={[styles.countText, { color: colors.inkFaint }]}>
                        Readme overview
                      </Text>
                    )}
                  </View>

                  <View style={styles.exploreLinkRow}>
                    <Text style={[styles.exploreText, { color: colors.brand }]}>
                      Explore Files
                    </Text>
                    <ChevronRight size={15} color={colors.brand} />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  controlsCard: {
    padding: SPACE.x3,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACE.x4,
    gap: SPACE.x2 + 2,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x3,
    paddingVertical: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  filterPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACE.x2,
  },
  filterPill: {
    paddingHorizontal: SPACE.x3,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
  },
  loadingBox: {
    paddingVertical: SPACE.x8,
    alignItems: "center",
  },
  emptyBox: {
    padding: SPACE.x8,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.x3,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 340,
    marginTop: 4,
    lineHeight: 18,
  },
  repoList: {
    gap: SPACE.x3,
  },
  repoCard: {
    padding: SPACE.x4,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: SPACE.x3,
  },
  repoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACE.x2,
  },
  repoTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  repoCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  repoAbstract: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: SPACE.x3,
  },
  tagChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACE.x1 + 2,
    marginTop: SPACE.x3,
  },
  tagChip: {
    paddingHorizontal: SPACE.x2 + 2,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11,
  },
  tagOverflow: {
    fontSize: 11,
    marginLeft: 2,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: SPACE.x3,
    marginTop: SPACE.x3,
  },
  assetCounts: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
  },
  countItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  countText: {
    fontSize: 12,
  },
  exploreLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  exploreText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
