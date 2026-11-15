/**
 * DesktopTopBar — Facebook-style fixed top navigation bar (desktop web only).
 *
 * Layout:
 *   [Logo + Wordmark + Search pill]  |  [Home Repo Capstones Discussions]  |  [Grid Chats Bell Avatar]
 *
 * State: single active popover — only one panel open at a time.
 * Outside click / Escape closes the active panel.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Image as RNImage,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter, useSegments } from "expo-router";
import {
  LayoutGrid,
  MessageCircle,
  Bell,
  Search,
  ChevronDown,
  Users,
  BookOpen,
  MessageSquare,
  Sparkles,
  Globe,
  FolderGit2,
} from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useFeedFilter, type FeedCategory } from "../../contexts/FeedFilterContext";
import { RADIUS, SPACE, TYPE, elevation } from "../../lib/tokens";
import { getSearchSuggestions, apiJson } from "../../lib/api";
import { onMessage, onConversation, onNotification } from "../../lib/realtime";
import Avatar from "../Avatar";
import MenuPopover from "./MenuPopover";
import ChatsPopover from "./ChatsPopover";
import NotificationsPopover from "./NotificationsPopover";
import AccountPopover from "./AccountPopover";
import { TOP_BAR_HEIGHT } from "./constants";

export type PopoverType = "menu" | "chats" | "notifications" | "account" | null;

const CATEGORY_TABS = [
  { id: "all", label: "All Posts", Icon: Sparkles },
  { id: "websites", label: "Websites", Icon: Globe },
  { id: "theses", label: "Theses", Icon: BookOpen },
  { id: "projects", label: "Projects", Icon: FolderGit2 },
  { id: "discussions", label: "Discussions", Icon: MessageSquare },
] as const;

interface DesktopTopBarProps {
  unreadCount?: number;
  notificationCount?: number;
}

export default function DesktopTopBar({
  unreadCount = 0,
  notificationCount = 0,
}: DesktopTopBarProps) {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { activeCategory, setCategory } = useFeedFilter();
  const router = useRouter();
  const segments = useSegments();
  const [activePopover, setActivePopover] = useState<PopoverType>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [liveUnreadCount, setLiveUnreadCount] = useState(unreadCount);
  const [liveNotificationCount, setLiveNotificationCount] = useState(notificationCount);
  const barRef = useRef<any>(null);

  // Sync prop changes
  useEffect(() => {
    setLiveUnreadCount(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    setLiveNotificationCount(notificationCount);
  }, [notificationCount]);

  // Initial fetch and Realtime subscriptions
  useEffect(() => {
    if (!profile?.id || profile.role === "guest") return;

    let cancelled = false;

    // Fetch initial message unread count
    apiJson<{ unread: number }>("/conversations/unread-count")
      .then((data) => {
        if (!cancelled && typeof data?.unread === "number") {
          setLiveUnreadCount(data.unread);
        }
      })
      .catch(() => {});

    // Fetch initial notification unread count
    apiJson<{ unread: number }>("/notifications/unread-count")
      .then((data) => {
        if (!cancelled && typeof data?.unread === "number") {
          setLiveNotificationCount(data.unread);
        }
      })
      .catch(() => {});

    // Listen for realtime messages
    const unsubMsg = onMessage((evt) => {
      if (evt.action === "INSERT") {
        setLiveUnreadCount((c) => c + 1);
      }
    });

    // Listen for conversation updates (reconnect, seen receipts)
    const unsubConv = onConversation(() => {
      apiJson<{ unread: number }>("/conversations/unread-count")
        .then((data) => {
          if (!cancelled && typeof data?.unread === "number") {
            setLiveUnreadCount(data.unread);
          }
        })
        .catch(() => {});
    });

    // Listen for realtime notifications
    const unsubNotif = onNotification((evt) => {
      if (evt.action === "INSERT" && !evt.notification.is_read) {
        setLiveNotificationCount((c) => c + 1);
      }
    });

    return () => {
      cancelled = true;
      unsubMsg();
      unsubConv();
      unsubNotif();
    };
  }, [profile?.id, profile?.role]);

  // Active tab detection
  const seg = segments as string[];
  const activeTab = seg.length > 1 ? seg[1] : "index";

  // Debounced search suggestions
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const list = await getSearchSuggestions(searchQuery.trim(), 5);
        setSuggestions(list || []);
      } catch (err) {
        // Non-fatal
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      router.push({
        pathname: "/(tabs)/search",
        params: { q: searchQuery.trim() },
      });
    }
  };

  const handleSelectSuggestion = (item: any) => {
    setShowSuggestions(false);
    setSearchQuery("");
    if (item.href) {
      router.push(item.href as any);
    }
  };

  // Toggle popover — same button click closes it
  const toggle = useCallback((name: Exclude<PopoverType, null>) => {
    setActivePopover((prev) => (prev === name ? null : name));
    setShowSuggestions(false);
  }, []);

  const closeAll = useCallback(() => {
    setActivePopover(null);
    setShowSuggestions(false);
  }, []);

  // Close on Escape (web only)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeAll]);

  // Web-only fixed positioning
  const fixedStyle =
    Platform.OS === "web"
      ? ({
          position: "fixed" as any,
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
        } as any)
      : {};

  return (
    <>
      {/* Outside-click trap — invisible full-screen layer behind popovers / suggestions */}
      {(activePopover !== null || showSuggestions) && (
        <Pressable
          onPress={closeAll}
          style={[
            StyleSheet.absoluteFill,
            { zIndex: 999 },
            Platform.OS === "web" ? ({ position: "fixed" } as any) : {},
          ]}
          accessibilityLabel="Close menu"
        />
      )}

      {/* Top bar */}
      <View
        ref={barRef}
        style={[
          styles.bar,
          fixedStyle,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        {/* ── LEFT: Logo + Search ── */}
        <View style={styles.left}>
          <Pressable
            onPress={() => router.push("/(tabs)/")}
            style={styles.brand}
            accessibilityRole="link"
            accessibilityLabel="LCCB Connect home"
          >
            <View
              style={[
                styles.logoWrap,
                {
                  backgroundColor: colors.brandWash,
                  borderColor: colors.brandWashStrong,
                },
              ]}
            >
              <RNImage
                source={require("../../../assets/images/logo-seal.png")}
                style={{ width: 22, height: 22 }}
                resizeMode="contain"
              />
            </View>
            <Text style={[TYPE.title, styles.brandText, { color: colors.ink }]}>
              LCCB{" "}
              <Text style={{ color: colors.brand }}>Connect</Text>
            </Text>
          </Pressable>

          {/* Search pill */}
          <View style={styles.searchPillWrapper}>
            <View
              style={[
                styles.searchPill,
                {
                  backgroundColor: colors.surfaceSunken,
                  borderColor: colors.border,
                },
              ]}
            >
              <Search size={14} color={colors.inkFaint} />
              <TextInput
                placeholder="Search…"
                placeholderTextColor={colors.inkFaint}
                style={[styles.searchInput, { color: colors.ink }]}
                accessibilityLabel="Search LCCB Connect"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
              />
            </View>

            {/* Suggestions Dropdown Popover */}
            {showSuggestions && suggestions.length > 0 && (
              <View
                style={[
                  styles.suggestionsDropdown,
                  {
                    backgroundColor: colors.surfaceElevated || colors.surface,
                    borderColor: colors.border,
                    ...elevation("lg", colors),
                  },
                ]}
              >
                <View style={styles.suggestionsHeader}>
                  <Text style={[styles.suggestionsHeaderText, { color: colors.textTertiary }]}>
                    SUGGESTIONS
                  </Text>
                </View>
                {suggestions.map((item, idx) => (
                  <Pressable
                    key={`${item.type}-${item.id}-${idx}`}
                    onPress={() => handleSelectSuggestion(item)}
                    style={({ pressed }) => [
                      styles.suggestionItem,
                      pressed && { backgroundColor: colors.surfaceSunken },
                    ]}
                  >
                    <View style={[styles.suggestionIconWrap, { backgroundColor: colors.surfaceSunken }]}>
                      {item.type === "person" ? (
                        <Avatar name={item.title} size={28} />
                      ) : item.type === "thesis" ? (
                        <BookOpen size={16} color={colors.action} />
                      ) : (
                        <MessageSquare size={16} color={colors.textSecondary} />
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: SPACE.x2 }}>
                      <Text
                        style={[styles.suggestionTitle, { color: colors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={[styles.suggestionSubtitle, { color: colors.textTertiary }]}
                        numberOfLines={1}
                      >
                        {item.subtitle}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                <Pressable
                  onPress={handleSearchSubmit}
                  style={({ pressed }) => [
                    styles.allResultsRow,
                    { borderTopColor: colors.border },
                    pressed && { backgroundColor: colors.surfaceSunken },
                  ]}
                >
                  <Search size={14} color={colors.action} style={{ marginRight: 6 }} />
                  <Text style={[styles.allResultsText, { color: colors.action }]}>
                    See all results for "{searchQuery}"
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* ── CENTER: Category filter tabs ── */}
        <View style={styles.center}>
          {CATEGORY_TABS.map(({ id, label, Icon }) => {
            const isActive = activeCategory === id;
            return (
              <Pressable
                key={id}
                onPress={() => setCategory(id as FeedCategory)}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: isActive }}
                {...(Platform.OS === "web" ? ({ title: label } as any) : {})}
                style={({ pressed }) => [
                  styles.navTab,
                  pressed && { backgroundColor: colors.hoverOverlay },
                ]}
              >
                <View style={styles.navTabContent}>
                  <Icon
                    size={22}
                    color={isActive ? colors.brand : colors.inkSoft}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </View>
                {isActive && (
                  <View
                    style={[
                      styles.navActiveBar,
                      { backgroundColor: colors.brand },
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ── RIGHT: Action buttons ── */}
        <View style={styles.right}>
          {/* Grid / Menu */}
          <TopBarButton
            onPress={() => toggle("menu")}
            active={activePopover === "menu"}
            accessibilityLabel="Open menu"
            colors={colors}
          >
            <LayoutGrid size={18} color={colors.ink} strokeWidth={2} />
          </TopBarButton>

          {/* Chats */}
          <TopBarButton
            onPress={() => toggle("chats")}
            active={activePopover === "chats"}
            accessibilityLabel="Open chats"
            colors={colors}
            badge={liveUnreadCount}
          >
            <MessageCircle size={18} color={colors.ink} strokeWidth={2} />
          </TopBarButton>

          {/* Notifications */}
          <TopBarButton
            onPress={() => toggle("notifications")}
            active={activePopover === "notifications"}
            accessibilityLabel="Open notifications"
            colors={colors}
            badge={liveNotificationCount}
          >
            <Bell size={18} color={colors.ink} strokeWidth={2} />
          </TopBarButton>

          {/* Account */}
          <Pressable
            onPress={() => toggle("account")}
            accessibilityRole="button"
            accessibilityLabel="Open account menu"
            style={({ pressed }) => [
              styles.avatarBtn,
              {
                backgroundColor:
                  activePopover === "account" || pressed
                    ? colors.panelInset
                    : colors.panelInset,
                borderColor:
                  activePopover === "account"
                    ? colors.brand
                    : "transparent",
              },
            ]}
          >
            <Avatar
              name={profile?.full_name ?? profile?.username}
              size={30}
            />
            <ChevronDown size={12} color={colors.inkFaint} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>

      {/* ── POPOVERS ── render above the fixed trap layer (zIndex 1001) */}
      {activePopover === "menu" && (
        <MenuPopover onClose={closeAll} />
      )}
      {activePopover === "chats" && (
        <ChatsPopover onClose={closeAll} unreadCount={liveUnreadCount} />
      )}
      {activePopover === "notifications" && (
        <NotificationsPopover
          onClose={closeAll}
          onClearUnread={() => setLiveNotificationCount(0)}
        />
      )}
      {activePopover === "account" && (
        <AccountPopover onClose={closeAll} />
      )}
    </>
  );
}

// ── TopBarButton ─────────────────────────────────────────────────────────────

interface TopBarButtonProps {
  onPress: () => void;
  active: boolean;
  accessibilityLabel: string;
  badge?: number;
  colors: any;
  children: React.ReactNode;
}

function TopBarButton({
  onPress,
  active,
  accessibilityLabel,
  badge,
  colors,
  children,
}: TopBarButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded: active }}
      style={({ pressed }) => [
        styles.iconBtn,
        {
          backgroundColor:
            active || pressed ? colors.hoverOverlay : colors.panelInset,
        },
      ]}
    >
      {children}
      {!!badge && badge > 0 && (
        <View
          style={[styles.badge, { backgroundColor: colors.destructive }]}
        >
          <Text style={styles.badgeText}>
            {badge > 9 ? "9+" : String(badge)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bar: {
    height: TOP_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x4,
    borderBottomWidth: 1,
    gap: SPACE.x3,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
    minWidth: 240,
    maxWidth: 300,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x2,
    flexShrink: 0,
  },
  logoWrap: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  brandText: {
    fontSize: 15,
    letterSpacing: -0.3,
  },
  searchPillWrapper: {
    position: "relative",
    flex: 1,
    minWidth: 160,
    maxWidth: 220,
    zIndex: 1100,
  },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x2,
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x1,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    width: "100%",
    height: 34,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    outlineStyle: "none",
  } as any,
  suggestionsDropdown: {
    position: "absolute",
    top: 40,
    left: 0,
    width: 320,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: "hidden",
    zIndex: 1200,
  },
  suggestionsHeader: {
    paddingHorizontal: SPACE.x3,
    paddingTop: SPACE.x2,
    paddingBottom: 4,
  },
  suggestionsHeaderText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
  },
  suggestionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  suggestionSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  allResultsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x3,
    borderTopWidth: 1,
  },
  allResultsText: {
    fontSize: 12,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    gap: 6,
    height: TOP_BAR_HEIGHT,
    maxWidth: 520,
    marginHorizontal: "auto" as any,
  },
  navTab: {
    paddingHorizontal: SPACE.x2,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderRadius: RADIUS.md,
    minWidth: 80,
    maxWidth: 110,
    flex: 1,
    height: TOP_BAR_HEIGHT - 8,
    marginVertical: 4,
  },
  navTabContent: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  navActiveBar: {
    position: "absolute",
    bottom: -4,
    left: 4,
    right: 4,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x2,
    flexShrink: 0,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 11,
  },
  avatarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 40,
    paddingHorizontal: 6,
    borderRadius: 20,
    borderWidth: 2,
  },
});

export { TOP_BAR_HEIGHT };
