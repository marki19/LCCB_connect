import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  useWindowDimensions,
  StyleSheet,
  ActivityIndicator,
  Image as RNImage,
  Modal,
  TextInput,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Bookmark,
  Settings,
  Folder,
  Plus,
  Lock,
  SlidersHorizontal,
  Check,
  Share2,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  X,
  ArrowLeft,
  RefreshCw,
  FileText,
  Image as ImageIcon,
} from "lucide-react-native";
import { useTheme } from "../src/contexts/ThemeContext";
import { useAuth } from "../src/contexts/AuthContext";
import { useSettingsSidebar } from "../src/contexts/SettingsSidebarContext";
import {
  getSavedPosts,
  unsavePost,
  adaptPost,
  getSavedCollections,
  createSavedCollection,
  addItemToCollection,
  type SavedCollection,
} from "../src/lib/api";
import DesktopTopBar, { TOP_BAR_HEIGHT } from "../src/components/topbar/DesktopTopBar";
import Avatar from "../src/components/Avatar";
import { RADIUS, SPACE, elevation } from "../src/lib/tokens";
import type { Post } from "../src/types";

type SavedFilterType = "all" | "posts" | "photos" | "capstones" | "links";

export default function SavedPostsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { openSettingsSidebar } = useSettingsSidebar();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;

  // Saved posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collections state
  const [collections, setCollections] = useState<SavedCollection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);

  // Add to collection modal
  const [selectedPostForCollection, setSelectedPostForCollection] = useState<Post | null>(null);

  // Filter dropdown state
  const [filterType, setFilterType] = useState<SavedFilterType>("all");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Active more-options menu post ID
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | number | null>(null);

  const loadSaved = useCallback(async () => {
    try {
      setError(null);
      const res = await getSavedPosts();
      const list = Array.isArray(res) ? res : res?.posts || [];
      setPosts(list.map((p: any) => adaptPost({ ...p, is_saved: true })));
    } catch (err: any) {
      setError(err?.message || "Failed to load saved posts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadCollections = useCallback(async () => {
    try {
      const data = await getSavedCollections();
      setCollections(data);
    } catch (err) {
      // Collections are an enhancement; soft fail
    }
  }, []);

  useEffect(() => {
    loadSaved();
    loadCollections();
  }, [loadSaved, loadCollections]);

  const onRefresh = () => {
    setRefreshing(true);
    loadSaved();
    loadCollections();
  };

  const handleUnsave = async (postId: string | number) => {
    try {
      // Optimistic removal
      setPosts((prev) => prev.filter((p) => String(p.id) !== String(postId)));
      setActiveMenuPostId(null);
      await unsavePost(String(postId));
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to unsave post");
      loadSaved();
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    try {
      setCreatingCollection(true);
      const col = await createSavedCollection(newCollectionName.trim());
      setCollections((prev) => [col, ...prev]);
      setNewCollectionName("");
      setIsCreateModalOpen(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create collection");
    } finally {
      setCreatingCollection(false);
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    if (!selectedPostForCollection) return;
    try {
      await addItemToCollection(collectionId, String(selectedPostForCollection.id));
      setSelectedPostForCollection(null);
      Alert.alert("Saved", "Added to your collection.");
      loadCollections();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add to collection");
    }
  };

  // Filter posts
  const filteredPosts = posts.filter((post) => {
    if (filterType === "photos") {
      return (
        (post.image_urls && post.image_urls.length > 0) ||
        Boolean(post.imageUrl)
      );
    }
    if (filterType === "capstones") {
      return post.type === "capstone" || post.type === "thesis";
    }
    if (filterType === "links") {
      return Boolean(post.previewUrl || post.preview_metadata);
    }
    if (filterType === "posts") {
      return post.type === "text" || (post as any).type === "post" || post.type === "discussion";
    }
    return true;
  });

  const getFilterTitle = () => {
    switch (filterType) {
      case "posts":
        return "Posts";
      case "photos":
        return "Photos & Media";
      case "capstones":
        return "Research & Capstones";
      case "links":
        return "Links";
      default:
        return "All";
    }
  };

  // Render horizontal Facebook-style saved item card
  const renderItemCard = ({ item }: { item: Post }) => {
    const hasImage = Boolean(item.imageUrl || (item.image_urls && item.image_urls.length > 0));
    const coverUri = item.imageUrl || item.image_urls?.[0];
    const isMenuOpen = activeMenuPostId === item.id;

    return (
      <View
        style={[
          styles.itemCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {/* Left: Thumbnail Preview */}
        <TouchableOpacity
          onPress={() => router.push(`/post/${item.id}`)}
          style={[styles.thumbnailWrap, { backgroundColor: colors.surfaceSunken }]}
          accessibilityRole="link"
        >
          {hasImage && coverUri ? (
            <RNImage
              source={{ uri: coverUri }}
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.thumbnailFallback}>
              {item.type === "capstone" || item.type === "thesis" ? (
                <FileText size={36} color={colors.action} />
              ) : (
                <Bookmark size={36} color={colors.textTertiary} />
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* Right: Content & Actions */}
        <View style={styles.itemContent}>
          {/* Title / Headline */}
          <TouchableOpacity
            onPress={() => router.push(`/post/${item.id}`)}
            accessibilityRole="link"
          >
            <Text style={[styles.itemTitle, { color: colors.textPrimary }]} numberOfLines={2}>
              {item.title || item.content || item.description || "Saved Item"}
            </Text>
          </TouchableOpacity>

          {/* Type & Subtitle */}
          <Text style={[styles.itemSubtitle, { color: colors.textTertiary }]}>
            {item.type === "capstone" ? "Capstone" : "Post"} • {item.createdAt || "Saved"} •{" "}
            {item.author?.course || "LCCB Campus"}
          </Text>

          {/* Author Attribution */}
          <TouchableOpacity
            onPress={() => item.author?.id && router.push(`/profile/${item.author.id}`)}
            style={styles.authorAttribution}
            accessibilityRole="link"
          >
            <Avatar name={item.author?.name || "Peer"} size={22} />
            <Text style={[styles.authorAttributionText, { color: colors.textSecondary }]}>
              Saved from{" "}
              <Text style={{ fontWeight: "700", color: colors.textPrimary }}>
                {item.author?.name || "Author"}
              </Text>
              's post
            </Text>
          </TouchableOpacity>

          {/* Action Buttons Row */}
          <View style={styles.actionsRow}>
            {/* Add to Collection Button */}
            <TouchableOpacity
              onPress={() => setSelectedPostForCollection(item)}
              style={[styles.addColBtn, { backgroundColor: colors.surfaceSunken }]}
              accessibilityRole="button"
              accessibilityLabel="Add to collection"
            >
              <Text style={[styles.addColBtnText, { color: colors.textPrimary }]}>
                Add to Collection
              </Text>
            </TouchableOpacity>

            {/* Share Button */}
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(`${window.location.origin}/post/${item.id}`);
                  Alert.alert("Copied", "Link copied to clipboard");
                } else {
                  Alert.alert("Share", `Share post: /post/${item.id}`);
                }
              }}
              style={[styles.iconActionBtn, { backgroundColor: colors.surfaceSunken }]}
              accessibilityRole="button"
              accessibilityLabel="Share post"
            >
              <Share2 size={16} color={colors.textPrimary} />
            </TouchableOpacity>

            {/* More Options Button */}
            <View style={{ position: "relative" }}>
              <TouchableOpacity
                onPress={() => setActiveMenuPostId(isMenuOpen ? null : item.id)}
                style={[styles.iconActionBtn, { backgroundColor: colors.surfaceSunken }]}
                accessibilityRole="button"
                accessibilityLabel="More options"
              >
                <MoreHorizontal size={17} color={colors.textPrimary} />
              </TouchableOpacity>

              {/* More Popover Dropdown */}
              {isMenuOpen && (
                <View
                  style={[
                    styles.cardMenuDropdown,
                    { backgroundColor: colors.surface, borderColor: colors.border, ...elevation("md", colors) },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => handleUnsave(item.id)}
                    style={styles.cardMenuItem}
                  >
                    <Trash2 size={16} color={colors.destructive} style={{ marginRight: 8 }} />
                    <Text style={[styles.cardMenuItemText, { color: colors.destructive }]}>
                      Unsave post
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setActiveMenuPostId(null);
                      router.push(`/post/${item.id}`);
                    }}
                    style={styles.cardMenuItem}
                  >
                    <ExternalLink size={16} color={colors.textPrimary} style={{ marginRight: 8 }} />
                    <Text style={[styles.cardMenuItemText, { color: colors.textPrimary }]}>
                      View original post
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  // Dedicated Saved Left Rail (Facebook exact styling)
  const savedLeftRail = (
    <View style={[styles.savedSidebar, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
      {/* Sidebar Header: "Saved" + Settings gear */}
      <View style={styles.sidebarHeader}>
        <Text style={[styles.sidebarHeaderTitle, { color: colors.textPrimary }]}>Saved</Text>
        <TouchableOpacity
          onPress={openSettingsSidebar}
          style={[styles.sidebarSettingsBtn, { backgroundColor: colors.surfaceSunken }]}
          accessibilityRole="button"
          accessibilityLabel="Saved settings"
        >
          <Settings size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Nav Item: "Saved Items" with blue icon */}
      <TouchableOpacity
        onPress={() => {
          setActiveCollectionId(null);
          setFilterType("all");
        }}
        style={[
          styles.savedNavItem,
          activeCollectionId === null && { backgroundColor: colors.surfaceSunken },
        ]}
        accessibilityRole="button"
      >
        <View style={[styles.savedNavIconWrap, { backgroundColor: colors.action }]}>
          <Bookmark size={20} color="#FFFFFF" fill="#FFFFFF" />
        </View>
        <Text style={[styles.savedNavLabel, { color: colors.textPrimary }]}>
          Saved Items
        </Text>
      </TouchableOpacity>

      <View style={[styles.sidebarDivider, { backgroundColor: colors.border }]} />

      {/* "My collections" Section */}
      <View style={styles.collectionsHeader}>
        <Text style={[styles.collectionsTitle, { color: colors.textPrimary }]}>
          My collections
        </Text>
      </View>

      {/* Collections list */}
      <View style={{ flex: 1 }}>
        {collections.map((col) => {
          const isActive = activeCollectionId === col.id;
          return (
            <TouchableOpacity
              key={col.id}
              onPress={() => setActiveCollectionId(col.id)}
              style={[
                styles.collectionItem,
                isActive && { backgroundColor: colors.surfaceSunken },
              ]}
            >
              <View style={[styles.collectionThumbWrap, { backgroundColor: colors.surfaceSunken }]}>
                {col.cover_image ? (
                  <RNImage
                    source={{ uri: col.cover_image }}
                    style={{ width: "100%", height: "100%", borderRadius: 6 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Folder size={20} color={colors.action} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.collectionItemName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {col.name}
                </Text>
                <View style={styles.collectionLockRow}>
                  <Lock size={11} color={colors.textTertiary} style={{ marginRight: 4 }} />
                  <Text style={[styles.collectionLockText, { color: colors.textTertiary }]}>
                    Only me · {col.item_count || 0} {col.item_count === 1 ? "item" : "items"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* "+ Create new collection" button */}
        <TouchableOpacity
          onPress={() => setIsCreateModalOpen(true)}
          style={[styles.createColBtn, { backgroundColor: colors.surfaceSunken }]}
          accessibilityRole="button"
        >
          <Plus size={18} color={colors.action} style={{ marginRight: 8 }} />
          <Text style={[styles.createColBtnText, { color: colors.action }]}>
            Create new collection
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.screenRoot, { backgroundColor: colors.surfacePage }]}>
      {/* Top Bar on Desktop */}
      {isDesktop && <DesktopTopBar />}

      {/* Main Body */}
      <View style={[styles.bodyLayout, isDesktop && { marginTop: TOP_BAR_HEIGHT }]}>
        {/* Left Column: Fixed Saved Rail on Desktop */}
        {isDesktop && savedLeftRail}

        {/* Center / Right Column: Main Content Feed */}
        <View style={styles.mainFeedColumn}>
          {/* Header Row: Filter Title + Filter Button */}
          <View style={[styles.feedHeaderRow, { borderBottomColor: colors.border }]}>
            {!isDesktop && (
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.mobileBackBtn}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <ArrowLeft size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            )}

            <Text style={[styles.feedHeaderTitle, { color: colors.textPrimary }]}>
              {getFilterTitle()}
            </Text>

            {/* Filter Button */}
            <View style={{ position: "relative" }}>
              <TouchableOpacity
                onPress={() => setIsFilterDropdownOpen((prev) => !prev)}
                style={[
                  styles.filterBtn,
                  { backgroundColor: isFilterDropdownOpen ? colors.action : colors.surfaceSunken },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Filter saved items"
              >
                <SlidersHorizontal
                  size={19}
                  color={isFilterDropdownOpen ? "#FFFFFF" : colors.textPrimary}
                />
              </TouchableOpacity>

              {/* Filter Popover Dropdown */}
              {isFilterDropdownOpen && (
                <View
                  style={[
                    styles.filterDropdown,
                    { backgroundColor: colors.surface, borderColor: colors.border, ...elevation("md", colors) },
                  ]}
                >
                  {(
                    [
                      { id: "all", label: "All" },
                      { id: "posts", label: "Posts" },
                      { id: "photos", label: "Photos & Media" },
                      { id: "capstones", label: "Research & Capstones" },
                      { id: "links", label: "Links" },
                    ] as const
                  ).map((option) => {
                    const isSelected = filterType === option.id;
                    return (
                      <TouchableOpacity
                        key={option.id}
                        onPress={() => {
                          setFilterType(option.id);
                          setIsFilterDropdownOpen(false);
                        }}
                        style={[
                          styles.filterDropdownItem,
                          isSelected && { backgroundColor: colors.surfaceSunken },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterDropdownItemText,
                            { color: isSelected ? colors.action : colors.textPrimary, fontWeight: isSelected ? "700" : "500" },
                          ]}
                        >
                          {option.label}
                        </Text>
                        {isSelected && <Check size={16} color={colors.action} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          {/* Saved Posts List */}
          {loading && !refreshing ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color={colors.action} />
              <Text style={[styles.loadingText, { color: colors.textTertiary }]}>
                Loading saved posts...
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredPosts}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItemCard}
              contentContainerStyle={[
                styles.feedListContent,
                filteredPosts.length === 0 && { flex: 1, justifyContent: "center" },
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.action}
                  colors={[colors.action]}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSunken }]}>
                    <Bookmark size={40} color={colors.textTertiary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                    No saved posts in {getFilterTitle()}
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                    Items and updates you save will appear here for easy access.
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>

      {/* Modal: Create Collection */}
      <Modal
        visible={isCreateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <Pressable
          onPress={() => setIsCreateModalOpen(false)}
          style={styles.modalOverlay}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Create Collection
              </Text>
              <TouchableOpacity onPress={() => setIsCreateModalOpen(false)}>
                <X size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              placeholder="Collection name (e.g. Thesis notes, Design ideas)"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.modalInput,
                { backgroundColor: colors.surfaceSunken, color: colors.textPrimary, borderColor: colors.border },
              ]}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setIsCreateModalOpen(false)}
                style={[styles.modalBtnCancel, { backgroundColor: colors.surfaceSunken }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateCollection}
                disabled={creatingCollection || !newCollectionName.trim()}
                style={[
                  styles.modalBtnSubmit,
                  { backgroundColor: colors.action, opacity: !newCollectionName.trim() ? 0.6 : 1 },
                ]}
              >
                {creatingCollection ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Add to Collection */}
      <Modal
        visible={Boolean(selectedPostForCollection)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPostForCollection(null)}
      >
        <Pressable
          onPress={() => setSelectedPostForCollection(null)}
          style={styles.modalOverlay}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Add to Collection
              </Text>
              <TouchableOpacity onPress={() => setSelectedPostForCollection(null)}>
                <X size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {collections.length === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <Text style={{ color: colors.textTertiary, marginBottom: 12 }}>
                  You have not created any collections yet.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedPostForCollection(null);
                    setIsCreateModalOpen(true);
                  }}
                  style={[styles.addColBtn, { backgroundColor: colors.action }]}
                >
                  <Text style={[styles.addColBtnText, { color: "#FFFFFF" }]}>
                    Create Collection
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ maxHeight: 300 }}>
                {collections.map((col) => (
                  <TouchableOpacity
                    key={col.id}
                    onPress={() => handleAddToCollection(col.id)}
                    style={[styles.collectionSelectRow, { borderBottomColor: colors.border }]}
                  >
                    <Folder size={18} color={colors.action} style={{ marginRight: 10 }} />
                    <Text style={[styles.collectionSelectName, { color: colors.textPrimary }]}>
                      {col.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  bodyLayout: {
    flex: 1,
    flexDirection: "row",
    position: "relative",
  },
  // Dedicated Saved Left Rail
  savedSidebar: {
    width: 360,
    height: "100%",
    borderRightWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sidebarHeaderTitle: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  sidebarSettingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  savedNavItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    gap: 12,
  },
  savedNavIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  savedNavLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  sidebarDivider: {
    height: 1,
    marginVertical: 14,
  },
  collectionsHeader: {
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  collectionsTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  collectionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    gap: 12,
    marginVertical: 2,
  },
  collectionThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  collectionItemName: {
    fontSize: 14.5,
    fontWeight: "600",
  },
  collectionLockRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  collectionLockText: {
    fontSize: 12,
  },
  createColBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    marginTop: 12,
  },
  createColBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Main Feed Column
  mainFeedColumn: {
    flex: 1,
    maxWidth: 880,
    paddingHorizontal: 20,
    alignSelf: "stretch",
  },
  feedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  mobileBackBtn: {
    marginRight: 12,
  },
  feedHeaderTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  filterDropdown: {
    position: "absolute",
    top: 48,
    right: 0,
    width: 220,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: 6,
    zIndex: 1000,
  },
  filterDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterDropdownItemText: {
    fontSize: 14,
  },
  feedListContent: {
    paddingVertical: 16,
    gap: 12,
  },

  // Facebook Horizontal Saved Item Card
  itemCard: {
    flexDirection: "row",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 14,
    gap: 16,
  },
  thumbnailWrap: {
    width: 120,
    height: 120,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  thumbnailFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: "space-between",
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  itemSubtitle: {
    fontSize: 12.5,
    marginTop: 3,
  },
  authorAttribution: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  authorAttributionText: {
    fontSize: 12.5,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  addColBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  addColBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cardMenuDropdown: {
    position: "absolute",
    bottom: 42,
    right: 0,
    width: 190,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: 4,
    zIndex: 100,
  },
  cardMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cardMenuItemText: {
    fontSize: 13.5,
    fontWeight: "500",
  },

  centerLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
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

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalInput: {
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalBtnCancel: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
  },
  modalBtnSubmit: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  collectionSelectRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  collectionSelectName: {
    fontSize: 14.5,
    fontWeight: "600",
  },
});
