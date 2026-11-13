import { useState, useEffect, useRef } from "react";
import {
  View,
  Platform,
  useWindowDimensions,
  StyleSheet,
  Pressable,
  Text,
  Image as RNImage,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useSegments } from "expo-router";
import {
  Home,
  BookOpen,
  Bell,
  User,
  MessageSquare,
  Plus,
  ChevronRight,
  ChevronLeft,
  Search,
  Sun,
  Moon,
  Settings,
  Shield,
  MessageSquarePlus,
} from "lucide-react-native";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { usePresence } from "../contexts/PresenceContext";
import { isAdminRole, isDepartmentAdminRole } from "../lib/roles";
import { setAdminAppPreview } from "../lib/panelMode";
import { apiJson } from "../lib/api";
import { onMessage, onConversation } from "../lib/realtime";
import { elevation, RADIUS, SPACE, TYPE, type ThemeTokens } from "../lib/tokens";
import DesktopTopBar, { TOP_BAR_HEIGHT } from "./topbar/DesktopTopBar";
import FloatingChatWindow from "./chat/FloatingChatWindow";
import DesktopContactsRail from "./chat/DesktopContactsRail";
import DesktopLeftRail from "./leftrail/DesktopLeftRail";
import { useFloatingChat } from "../contexts/FloatingChatContext";

type TabItem = (typeof TAB_ITEMS)[number];
type TabName = TabItem["name"];

const BREAKPOINT = 768;

const TAB_ITEMS = [
  { name: "index", label: "Home", Icon: Home, isAction: false },
  { name: "search", label: "Repository", Icon: BookOpen, isAction: false },
  { name: "create", label: "Create", Icon: Plus, isAction: true },
  { name: "notifications", label: "Notifications", Icon: Bell, isAction: false },
  { name: "profile", label: "Profile", Icon: User, isAction: false },
] as const;

interface DesktopLayoutProps {
  children: React.ReactNode;
  leftSidebar?: React.ReactNode;
  rightSidebar?: React.ReactNode;
  showLeftSidebar?: boolean;
  showRightSidebar?: boolean;
}

export default function DesktopLayout({
  children,
  leftSidebar,
  rightSidebar,
  showLeftSidebar = true,
  showRightSidebar = false,
}: DesktopLayoutProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = Platform.OS === "web" && width >= BREAKPOINT;
  const { profile, session, refreshProfile } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { modeOf } = usePresence();
  const router = useRouter();
  const segments = useSegments();
  const { openChat } = useFloatingChat();
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activePeers, setActivePeers] = useState<any[]>([]);
  const isGuest = profile?.role === "guest";
  const adminUser = isAdminRole(profile?.role);
  const departmentAdmin = isDepartmentAdminRole(profile?.role);
  const visibleTabs = TAB_ITEMS.filter((item) => !isGuest || !item.isAction);

  // Load peers for left sidebar
  useEffect(() => {
    const load = async () => {
      if (!session?.user?.id) return;
      try {
        const rows = await apiJson<any[]>(isGuest ? "/public/peers?limit=20" : "/friends?limit=20");
        const list = rows.map((r: any) => r.peer ?? r).filter(Boolean);
        setActivePeers(list.filter((p: any) => p.id !== profile?.id));
      } catch (e: any) {
        if (e?.status !== 401) {
          console.error("Failed to load peers:", e);
        }
      }
    };
    load();
  }, [isGuest, profile?.id, session?.user?.id]);

  // Load unread count for messages badge + Realtime sync
  useEffect(() => {
    if (isGuest || !profile?.id) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const data = await apiJson<{ unread: number }>("/conversations/unread-count");
        if (!cancelled && typeof data?.unread === "number") {
          setUnreadCount(data.unread);
        }
      } catch (e: any) {
        if (e?.status !== 401) {
          console.error("Failed to load unread count:", e);
        }
      }
    };
    load();

    const unsubMsg = onMessage((evt) => {
      if (evt.action === "INSERT") {
        setUnreadCount((c) => c + 1);
      }
    });

    const unsubConv = onConversation(() => {
      load();
    });

    return () => {
      cancelled = true;
      unsubMsg();
      unsubConv();
    };
  }, [isGuest, profile?.id]);

  // Get active tab index
  const seg = segments as string[];
  const activeTabName = (seg.length > 1 ? (seg[1] as TabName) : undefined) || "index";
  const activeTabIndex = visibleTabs.findIndex((t) => t.name === activeTabName);

  // Mobile: render children directly (Tabs will render MobileTabBar)
  if (!isDesktopWeb) {
    return (
      <View style={styles.mobileContainer}>
        {children}
      </View>
    );
  }

  // Desktop: render three-column layout
  return (
    <SafeAreaView style={[styles.desktopContainer, { backgroundColor: colors.surfacePage }]}>
      {/* DESKTOP TOP BAR */}
      <DesktopTopBar unreadCount={unreadCount} />

      {/* LEFT SIDEBAR - Facebook Style Shortcuts Rail */}
      {showLeftSidebar && (
        <View style={{ marginTop: TOP_BAR_HEIGHT }}>
          {leftSidebar ? leftSidebar : <DesktopLeftRail />}
        </View>
      )}

      {/* CENTER COLUMN */}
      <View style={styles.centerColumn}>
        <View style={[styles.centerColumnInner, { maxWidth: width >= 1600 ? 860 : 760 }]}>
          {children}
        </View>
      </View>

      {/* RIGHT SIDEBAR - Contacts Rail on Wide Desktop */}
      {width >= 1200 && !isGuest && (
        <View style={{ marginTop: TOP_BAR_HEIGHT }}>
          <DesktopContactsRail peers={activePeers} />
        </View>
      )}

      {/* Mobile sidebar overlays */}
      {isDesktopWeb && leftSidebarOpen && (
        <Pressable
          onPress={() => setLeftSidebarOpen(false)}
          style={styles.overlay}
          accessibilityLabel="Close sidebar"
        />
      )}

      {/* Floating Mini-Chat Window (Facebook style) */}
      <FloatingChatWindow />
    </SafeAreaView>
  );
}

// ============================================================================
// MOBILE TAB BAR
// ============================================================================
interface MobileTabBarProps {
  visibleTabs: TabItem[];
  activeIndex: number;
  onTabPress: (name: string) => void;
  unreadCount: number;
  onCreatePress: () => void;
  onMessagesPress: () => void;
  onThemeToggle: () => void;
  isDark: boolean;
  colors: ThemeTokens;
}

function MobileTabBar({
  visibleTabs,
  activeIndex,
  onTabPress,
  unreadCount,
  onCreatePress,
  onMessagesPress,
  onThemeToggle,
  isDark,
  colors,
}: MobileTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.mobileBar,
        {
          paddingBottom: Math.max(insets.bottom, 10),
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.line,
        },
      ]}
    >
      {visibleTabs.map(({ name, label, Icon, isAction }) => {
        const focused = visibleTabs[activeIndex]?.name === name;

        if (isAction) {
          return (
            <Pressable
              key={name}
              onPress={onCreatePress}
              accessibilityRole="button"
              accessibilityLabel="Create a post"
              style={({ pressed }) => [styles.mobileTab, { opacity: pressed ? 0.78 : 1 }]}
            >
              <View
                style={[
                  styles.actionBubble,
                  { backgroundColor: colors.brandSolid, ...elevation("sm", colors) },
                ]}
              >
                <Plus size={22} color={colors.textOnPrimary} strokeWidth={2.6} />
              </View>
              <Text style={[{ ...styles.mobileLabel, color: colors.brand, fontWeight: "700" }]}>{label}</Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={name}
            onPress={() => onTabPress(name)}
            style={styles.mobileTab}
          >
            {focused && (
              <View style={[{ ...styles.mobileActiveIndicator, backgroundColor: colors.brand }]} />
            )}
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: focused ? colors.brandWash : "transparent" },
              ]}
            >
              <Icon
                size={21}
                color={focused ? colors.brand : colors.inkFaint}
                strokeWidth={focused ? 2.4 : 2}
              />
            </View>
            <Text
              style={[
                styles.mobileLabel,
                { color: focused ? colors.brand : colors.inkFaint },
                focused && { fontWeight: "700" },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ============================================================================
// MESSAGES SIDEBAR (RIGHT)
// ============================================================================
interface MessagesSidebarProps {
  unreadCount: number;
  activePeers: any[];
  modeOf: (id: string) => string | null;
  colors: ThemeTokens;
  onOpenChat: (peerId: string) => void;
}

function MessagesSidebar({ unreadCount, activePeers, modeOf, colors, onOpenChat }: MessagesSidebarProps) {
  const [tab, setTab] = useState<"chats" | "requests">("chats");
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load conversations
  useEffect(() => {
    let cancelled = false;
    // Defer state updates to avoid synchronous setState in effect
    setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
    }, 0);
    try {
      // In a real implementation, this would fetch from the messages API
      // For now, show active peers as "recent" chats
      const newConversations = activePeers.slice(0, 10).map((peer) => ({
        id: peer.id,
        name: peer.full_name || peer.username,
        avatar: peer.avatar_url,
        lastMessage: "Tap to start a conversation",
        time: "",
        unread: false,
        presence: modeOf(peer.id),
      }));
      if (!cancelled) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setConversations(newConversations);
      }
    } catch (e: any) {
      if (e?.status !== 401) {
        console.error("Failed to load conversations:", e);
      }
    } finally {
      setTimeout(() => {
        if (!cancelled) {
          setLoading(false);
        }
      }, 0);
    }
    return () => { cancelled = true; };
  }, [activePeers, modeOf]);

  const formatWhen = (iso?: string | null) => {
    if (!iso) return "";
    const date = new Date(iso);
    // eslint-disable-next-line react-hooks/purity
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <View style={styles.messagesSidebar}>
      {/* Tabs */}
      <View style={styles.messagesTabs}>
        <Pressable
          onPress={() => setTab("chats")}
          style={[
            styles.messagesTab,
            tab === "chats" && { borderBottomColor: colors.brand, borderBottomWidth: 2 },
          ]}
        >
          <Text style={[{ ...TYPE.caption, fontWeight: "700", color: tab === "chats" ? colors.brand : colors.inkFaint }]}>
            Chats
            {(unreadCount > 0 || conversations.some((c) => c.unread)) && (
              <Text style={styles.messagesBadge}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            )}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("requests")}
          style={[
            styles.messagesTab,
            tab === "requests" && { borderBottomColor: colors.brand, borderBottomWidth: 2 },
          ]}
        >
          <Text style={[{ ...TYPE.caption, fontWeight: "700", color: tab === "requests" ? colors.brand : colors.inkFaint }]}>
            Requests
          </Text>
        </Pressable>
      </View>

      {/* List */}
      <View style={styles.messagesList}>
        {loading ? (
          <View style={styles.messagesLoading}>
            <Text style={{ ...TYPE.body, color: colors.inkFaint }}>Loading conversations…</Text>
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.messagesEmpty}>
            <MessageSquare size={32} color={colors.inkFaint} />
            <Text style={{ ...TYPE.body, color: colors.inkFaint, marginTop: SPACE.x2 }}>
              {tab === "chats" ? "No conversations yet" : "No message requests"}
            </Text>
            <Pressable
              onPress={() => onOpenChat("")}
              style={{
                marginTop: SPACE.x3,
                paddingHorizontal: SPACE.x4,
                paddingVertical: SPACE.x2,
                backgroundColor: colors.brandSolid,
                borderRadius: RADIUS.pill,
              }}
            >
              <Text style={{ ...TYPE.caption, fontWeight: "700", color: colors.textOnPrimary }}>
                New Message
              </Text>
            </Pressable>
          </View>
        ) : (
          conversations.map((conv) => (
            <Pressable
              key={conv.id}
              onPress={() => onOpenChat(conv.id)}
              style={styles.messagesItem}
            >
              <Avatar name={conv.name} avatarUrl={conv.avatar} size={40} />
              <View style={styles.messagesItemContent}>
                <View style={styles.messagesItemHeader}>
                  <Text style={{ ...TYPE.body, fontSize: 14, color: colors.ink, fontWeight: "600" }}>
                    {conv.name}
                  </Text>
                  <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>{formatWhen(conv.time)}</Text>
                </View>
                <Text style={{ ...TYPE.caption, color: colors.inkSoft }} numberOfLines={1}>
                  {conv.lastMessage}
                </Text>
              </View>
              {conv.presence === "online" && <View style={styles.onlineDot} />}
              {conv.unread && <View style={styles.unreadDot} />}
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

// ============================================================================
// AVATAR COMPONENT (inline for sidebar use)
// ============================================================================
function Avatar({ name, username, avatarUrl, size = 40 }: { name?: string; username?: string; avatarUrl?: string; size: number }) {
  const { colors, isDark } = useTheme();
  const displayName = name || username || "User";

  if (avatarUrl) {
    return (
      <View style={styles.avatarContainer}>
        <RNImage
          source={{ uri: avatarUrl }}
          style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]}
          resizeMode="cover"
        />
      </View>
    );
  }

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <View
      style={[
        styles.avatarFallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isDark ? colors.surfaceSunken : colors.brandWash,
        },
      ]}
    >
      <Text style={{ fontSize: size * 0.35, fontWeight: "700", color: isDark ? colors.brand : colors.brandSolid }}>
        {initials}
      </Text>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  // Mobile container
  mobileContainer: {
    flex: 1,
    backgroundColor: "var(--surface-page)",
  },

  // Desktop container
  desktopContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "var(--surface-page)",
  },

  // Left sidebar
  leftSidebar: {
    width: 280,
    borderRightWidth: 1,
    borderRightColor: "var(--border)",
    backgroundColor: "var(--surface)",
    display: "flex",
    flexDirection: "column",
    paddingTop: SPACE.x4,
    paddingBottom: SPACE.x4,
    marginTop: TOP_BAR_HEIGHT,
  },
  sidebarBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x2,
    marginBottom: SPACE.x2,
  },
  sidebarLogo: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sidebarNav: {
    flex: 1,
    paddingHorizontal: SPACE.x2,
    gap: 2,
  },
  sidebarNavItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    borderRadius: RADIUS.lg,
    minHeight: 44,
  },
  sidebarAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.x2,
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x2,
    borderRadius: RADIUS.lg,
    minHeight: 44,
    marginBottom: SPACE.x2,
  },
  sidebarSection: {
    paddingHorizontal: SPACE.x3,
    marginTop: SPACE.x4,
    marginBottom: SPACE.x2,
  },
  sidebarSectionTitle: {
    ...TYPE.caption,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACE.x2,
  },
  sidebarPeer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x2,
    paddingVertical: SPACE.x1,
    paddingHorizontal: SPACE.x2,
    borderRadius: RADIUS.md,
  },
  sidebarAdminLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    borderRadius: RADIUS.lg,
  },
  sidebarFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: SPACE.x3,
    borderTopWidth: 1,
    borderTopColor: "var(--border)",
    marginHorizontal: SPACE.x2,
  },
  sidebarFooterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x1,
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    borderRadius: RADIUS.md,
  },

  // Center column
  centerColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingHorizontal: SPACE.x4,
    paddingTop: SPACE.x4,
    paddingBottom: SPACE.x8,
    marginTop: TOP_BAR_HEIGHT,
  },
  centerColumnInner: {
    width: "100%",
    flex: 1,
  },

  // Right sidebar
  rightSidebar: {
    width: 360,
    borderLeftWidth: 1,
    borderLeftColor: "var(--border)",
    backgroundColor: "var(--surface)",
    display: "flex",
    flexDirection: "column",
    marginTop: TOP_BAR_HEIGHT,
  },
  rightSidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x3,
    borderBottomWidth: 1,
    borderBottomColor: "var(--border)",
  },
  rightSidebarNewBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: "var(--action)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Messages sidebar
  messagesSidebar: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  messagesTabs: {
    flexDirection: "row",
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x2,
    borderBottomWidth: 1,
    borderBottomColor: "var(--border)",
  },
  messagesTab: {
    flex: 1,
    paddingVertical: SPACE.x2,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACE.x1,
  },
  messagesBadge: {
    backgroundColor: "var(--danger)",
    color: "var(--text-on-primary)",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 17,
    textAlign: "center",
  },
  messagesList: {
    flex: 1,
  },
  messagesLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messagesEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.x4,
    gap: SPACE.x2,
  },
  messagesItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x2,
    borderBottomWidth: 1,
    borderBottomColor: "var(--border)",
  },
  messagesItemContent: {
    flex: 1,
    minWidth: 0,
  },
  messagesItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  avatarContainer: {
    position: "relative",
  },
  avatarImage: {
    borderRadius: 999,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "var(--surface)",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "var(--action)",
  },

  // Mobile tab bar
  mobileBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    borderTopWidth: 1,
    zIndex: 100,
  },
  mobileTab: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 2,
  },
  mobileActiveIndicator: {
    position: "absolute",
    top: 0,
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  iconBubble: {
    width: 42,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBubble: {
    width: 48,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  mobileLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: -0.1,
  },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 50,
  },
});