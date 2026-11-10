import { Tabs, useRouter } from "expo-router";
import DesktopLayout from "../../src/components/DesktopLayout";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Sun, Moon, Shield } from "lucide-react-native";
import { elevation, focusRing } from "../../src/lib/tokens";
import { useState } from "react";

type TabItem = {
  name: string;
  label: string;
  isAction: boolean;
};

const TAB_ITEMS: readonly TabItem[] = [
  { name: "index", label: "Home", isAction: false },
  { name: "search", label: "Repository", isAction: false },
  { name: "create", label: "Create", isAction: true },
  { name: "notifications", label: "Notifications", isAction: false },
  { name: "profile", label: "Profile", isAction: false },
] as const;

export default function TabsLayout() {
  const { profile } = useAuth();
  const isGuest = profile?.role === "guest";
  const visibleTabs = TAB_ITEMS.filter((item) => !isGuest || !item.isAction);
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 768;

  return (
    <DesktopLayout showRightSidebar={false}>
      <Tabs
        tabBar={isDesktopWeb ? () => null : (props) => <MobileTabBar {...props} visibleTabs={visibleTabs} isDesktopWeb={isDesktopWeb} />}
        screenOptions={{ headerShown: false, tabBarPosition: "bottom" }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="capstones" options={{ href: null }} />
        <Tabs.Screen name="discussions" options={{ href: null }} />
        <Tabs.Screen name="notifications" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </DesktopLayout>
  );
}

function MobileTabBar({
  visibleTabs,
  state,
  descriptors,
  emitter,
  navigateToTab,
  isDesktopWeb,
}: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);

  const adminUser = profile?.role === "admin" || profile?.role === "superadmin";
  const departmentAdmin = profile?.role === "moderator" || profile?.role === "department_admin";

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

  // Mobile: thumb-friendly bottom bar
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
      {visibleTabs.map(({ name, label, isAction }: TabItem) => {
        const routeIndex = state.routes.findIndex((route: any) => route.name === name);
        const focused = !isAction && state.index === routeIndex;

        if (isAction) {
          return (
            <Pressable
              key={name}
              onPress={() => router.push("/create")}
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
              <Text style={[{ ...styles.mobileLabel, color: colors.brand, fontWeight: "700" }]}>
                {label}
              </Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={name}
            onPress={() => navigate(name, focused)}
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
              <Text style={{ fontSize: 21, color: focused ? colors.brand : colors.inkFaint }}>
                {label[0]}
              </Text>
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

const styles = StyleSheet.create({
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
});
