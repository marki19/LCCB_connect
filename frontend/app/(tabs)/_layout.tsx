import { Tabs, useRouter } from "expo-router";
import DesktopLayout from "../../src/components/DesktopLayout";
import { useAuth } from "../../src/contexts/AuthContext";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
        tabBar={isDesktopWeb ? () => null : (props) => <MobileTabBar {...props} visibleTabs={visibleTabs} />}
        screenOptions={{ headerShown: false, tabBarPosition: "bottom" }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="search" />
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
}: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

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
          paddingBottom: Math.max(insets.bottom, 10),
          backgroundColor: "var(--tab-bar-bg)",
          borderTopColor: "var(--border)",
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
              <View style={[{ ...styles.actionBubble, backgroundColor: "var(--brand-solid)" }]}>
                <Text style={{ color: "var(--text-on-primary)", fontWeight: "700" }}>+</Text>
              </View>
              <Text style={[{ ...styles.mobileLabel, color: "var(--brand)", fontWeight: "700" }]}>
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
              <View style={[{ ...styles.mobileActiveIndicator, backgroundColor: "var(--brand)" }]} />
            )}
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: focused ? "var(--brand-wash)" : "transparent" },
              ]}
            >
              <Text style={{ fontSize: 21, color: focused ? "var(--brand)" : "var(--ink-faint)" }}>
                {label[0]}
              </Text>
            </View>
            <Text
              style={[
                styles.mobileLabel,
                { color: focused ? "var(--brand)" : "var(--ink-faint)" },
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
