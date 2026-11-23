import { Tabs, useRouter } from "expo-router";
import DesktopLayout from "../../src/components/DesktopLayout";
import { useAuth } from "../../src/contexts/AuthContext";
import { useNotifications } from "../../src/contexts/NotificationsContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FolderGit2,
  BookOpen,
  Home,
  MessageCircle,
  Bell,
} from "lucide-react-native";
import { elevation, RADIUS, SPACE } from "../../src/lib/tokens";
import { useState, useEffect } from "react";
import { apiJson } from "../../src/lib/api";
import { onMessage, onConversation, onUnreadRefresh } from "../../src/lib/realtime";

type TabItem = {
  name: string;
  label: string;
  Icon: any;
};

const TAB_ITEMS: readonly TabItem[] = [
  { name: "capstones", label: "Projects", Icon: FolderGit2 },
  { name: "search", label: "Repositories", Icon: BookOpen },
  { name: "index", label: "Home", Icon: Home },
  { name: "messages", label: "Chats", Icon: MessageCircle },
  { name: "notifications", label: "Notifications", Icon: Bell },
] as const;

export default function TabsLayout() {
  const { profile } = useAuth();
  const isGuest = profile?.role === "guest";
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 768;

  return (
    <DesktopLayout showRightSidebar={false}>
      <Tabs
        tabBar={isDesktopWeb ? () => null : (props) => <MobileTabBar {...props} visibleTabs={TAB_ITEMS} isDesktopWeb={isDesktopWeb} />}
        screenOptions={{ headerShown: false, tabBarPosition: "bottom" }}
      >
        <Tabs.Screen name="capstones" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="index" />
        <Tabs.Screen name="messages" />
        <Tabs.Screen name="notifications" />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="discussions" options={{ href: null }} />
        {/*
          Friends renders inside the shell (rail + top bar stay mounted), like
          Notifications, but is reached from the rail, the menu and
          notifications — never from the tab bar.

          It must stay a *declared, non-hidden* screen. `href: null` compiles to
          `options.hidden`, and expo-router's tab navigator redirects away from
          any hidden route that becomes focused — which dropped the user on the
          first tab (Projects) instead. Tab-bar visibility is owned by
          `TAB_ITEMS` below: the mobile bar renders only those entries and
          desktop renders no bar at all, so this screen stays invisible either
          way while remaining navigable.
        */}
        <Tabs.Screen name="friends" />
      </Tabs>
    </DesktopLayout>
  );
}

function MobileTabBar({
  visibleTabs,
  state,
  emitter,
  navigateToTab,
}: any) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { unreadCount: unreadNotifications } = useNotifications();
  const [unreadMessages, setUnreadMessages] = useState(0);

  const isGuest = profile?.role === "guest";

  // Real-time unread count sync for chats. The bell badge comes from the shared
  // notifications store, which every surface updates.
  useEffect(() => {
    if (isGuest || !profile?.id) return;
    let cancelled = false;

    const loadCounts = async () => {
      try {
        const msgData = await apiJson<{ unread: number }>(
          "/conversations/unread-count"
        ).catch(() => ({ unread: 0 }));
        if (!cancelled && typeof msgData?.unread === "number") {
          setUnreadMessages(msgData.unread);
        }
      } catch {
        // Best effort
      }
    };

    loadCounts();

    const unsubMsg = onMessage(() => {
      loadCounts();
    });
    const unsubUnread = onUnreadRefresh((newCount) => {
      if (typeof newCount === "number") {
        setUnreadMessages(newCount);
      } else {
        loadCounts();
      }
    });
    const unsubConv = onConversation(() => {
      loadCounts();
    });

    return () => {
      cancelled = true;
      unsubMsg();
      unsubUnread();
      unsubConv();
    };
  }, [isGuest, profile?.id]);

  const navigate = (name: string, focused: boolean) => {
    const route = state.routes.find((r: any) => r.name === name);
    if (!route || focused) return;
    const event = emitter.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigateToTab(route.key);
    }
  };

  return (
    <View
      style={[
        styles.mobileBar,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: colors.tabBarBg || colors.surface,
          borderTopColor: colors.line,
        },
      ]}
    >
      {visibleTabs.map(({ name, label, Icon }: TabItem) => {
        const routeIndex = state.routes.findIndex((route: any) => route.name === name);
        const focused = state.index === routeIndex;
        const badgeCount =
          name === "messages" ? unreadMessages : name === "notifications" ? unreadNotifications : 0;

        return (
          <Pressable
            key={name}
            onPress={() => navigate(name, focused)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            style={({ pressed }: any) => [
              styles.mobileTab,
              {
                cursor: "pointer",
                opacity: pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
            ]}
          >
            {focused && (
              <View style={[styles.mobileActiveIndicator, { backgroundColor: colors.brand }]} />
            )}
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: focused ? colors.brandWash : "transparent" },
              ]}
            >
              <Icon
                size={22}
                color={focused ? colors.brand : colors.inkFaint}
                strokeWidth={focused ? 2.4 : 1.9}
              />
              {badgeCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.coral }]}>
                  <Text style={[styles.badgeText, { color: colors.textOnDanger }]}>
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.mobileLabel,
                {
                  color: focused ? colors.brand : colors.inkFaint,
                  fontWeight: focused ? "700" : "500",
                },
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

const styles = StyleSheet.create({
  mobileBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    zIndex: 100,
    paddingTop: 6,
  },
  mobileTab: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  mobileActiveIndicator: {
    position: "absolute",
    top: -6,
    width: 24,
    height: 3,
    borderRadius: 1.5,
  },
  iconBubble: {
    width: 40,
    height: 30,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  mobileLabel: {
    fontSize: 10,
    letterSpacing: -0.2,
  },
});
