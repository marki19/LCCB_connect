import { Tabs } from "expo-router";
import DesktopLayout from "../../src/components/DesktopLayout";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { isAdminRole, isDepartmentAdminRole } from "../../src/lib/roles";
import { setAdminAppPreview } from "../../src/lib/panelMode";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Image,
} from "react-native";

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
  const { isDark, toggleTheme } = useTheme();
  const isGuest = profile?.role === "guest";
  const adminUser = isAdminRole(profile?.role);
  const departmentAdmin = isDepartmentAdminRole(profile?.role);
  const visibleTabs = TAB_ITEMS.filter((item) => !isGuest || !item.isAction);

  return (
    <DesktopLayout
      leftSidebar={
        <LeftSidebar
          visibleTabs={visibleTabs}
          isGuest={isGuest}
          adminUser={adminUser}
          departmentAdmin={departmentAdmin}
          profile={profile}
          isDark={isDark}
          toggleTheme={toggleTheme}
        />
      }
      rightSidebar={
        <RightSidebar isGuest={isGuest} unreadCount={0} activePeers={[]} />
      }
      showRightSidebar={!isGuest}
    >
      <Tabs
        tabBar={(props) => <MobileTabBar {...props} visibleTabs={visibleTabs} />}
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

function LeftSidebar({
  visibleTabs,
  isGuest,
  adminUser,
  departmentAdmin,
  profile,
  isDark,
  toggleTheme,
}: {
  visibleTabs: typeof TAB_ITEMS;
  isGuest: boolean;
  adminUser: boolean;
  departmentAdmin: boolean;
  profile: any;
  isDark: boolean;
  toggleTheme: () => void;
}) {
  const { router } = require("expo-router");

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="LCCB Connect home"
        onPress={() => router.push("/(tabs)/")}
        style={styles.sidebarBrand}
      >
        <View
          style={[
            styles.sidebarLogo,
            { backgroundColor: "var(--brand-wash)", borderColor: "var(--brand-wash-strong)" },
          ]}
        >
          <Image
            source={require("../../assets/images/logo-seal.png")}
            style={{ width: 24, height: 24 }}
            resizeMode="contain"
          />
        </View>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "var(--ink)" }}>
          LCCB <Text style={{ color: "var(--brand)" }}>Connect</Text>
        </Text>
      </Pressable>

      <View style={styles.sidebarNav}>
        {visibleTabs.map(({ name, label, isAction }: TabItem) => {
          if (isAction) {
            return (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityLabel="Create a post"
                onPress={() => router.push("/create")}
                style={({ pressed }) => [
                  styles.sidebarAction,
                  { backgroundColor: pressed ? "var(--brand-solid)" : "var(--brand-solid)" },
                ]}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: "var(--text-on-primary)",
                  }}
                >
                  Create
                </Text>
              </Pressable>
            );
          }
          return (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityLabel={label}
              onPress={() => router.push(`/(tabs)/${name}`)}
              style={({ pressed }) => [
                styles.sidebarNavItem,
                pressed && { backgroundColor: "var(--panel-inset)" },
              ]}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: "var(--ink)",
                  fontWeight: "500",
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}

        {(adminUser || departmentAdmin) && (
          <View style={styles.sidebarSection}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={adminUser ? "Open the admin console" : "Open the moderation console"}
              onPress={() => {
                if (adminUser) {
                  setAdminAppPreview(false);
                  router.push("/(admin)");
                } else {
                  router.push("/(moderation)" as any);
                }
              }}
              style={styles.sidebarAdminLink}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: adminUser ? "var(--brand)" : "var(--action)",
                  fontWeight: "600",
                }}
              >
                {adminUser ? "Admin Console" : "Moderation Console"}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.sidebarFooter}>
        <Pressable
          onPress={() => void toggleTheme()}
          accessibilityRole="button"
          accessibilityLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
          style={styles.sidebarFooterItem}
        >
          <Text style={{ fontSize: 12, color: "var(--ink-faint)" }}>
            {isDark ? "Light" : "Dark"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/settings")}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={styles.sidebarFooterItem}
        >
          <Text style={{ fontSize: 12, color: "var(--ink-faint)" }}>Settings</Text>
        </Pressable>
      </View>
    </>
  );
}

function RightSidebar({
  isGuest,
  unreadCount,
  activePeers,
}: {
  isGuest: boolean;
  unreadCount: number;
  activePeers: any[];
}) {
  if (isGuest) return null;

  return (
    <View style={styles.rightSidebar}>
      <View style={styles.rightSidebarHeader}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "var(--ink)" }}>Messages</Text>
      </View>
      <View style={styles.messagesEmpty}>
        <Text style={{ fontSize: 14, color: "var(--ink-faint)", marginTop: 16 }}>No conversations yet</Text>
      </View>
    </View>
  );
}

function MobileTabBar({
  visibleTabs,
  state,
  descriptors,
  emitter,
  navigateToTab,
}: any) {
  const { useSafeAreaInsets } = require("react-native-safe-area-context");
  const { useRouter } = require("expo-router");
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
  sidebarBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  sidebarLogo: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sidebarNav: {
    flex: 1,
    paddingHorizontal: 8,
    gap: 2,
  },
  sidebarNavItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    minHeight: 44,
  },
  sidebarAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    minHeight: 44,
    marginBottom: 8,
  },
  sidebarSection: {
    paddingHorizontal: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  sidebarAdminLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
  },
  sidebarFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "var(--border)",
    marginHorizontal: 8,
  },
  sidebarFooterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },

  rightSidebar: {
    width: 360,
    borderLeftWidth: 1,
    borderLeftColor: "var(--border)",
    backgroundColor: "var(--surface)",
    display: "flex",
    flexDirection: "column",
  },
  rightSidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "var(--border)",
  },
  messagesEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

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