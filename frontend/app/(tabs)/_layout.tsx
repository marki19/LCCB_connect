import { Tabs, useRouter } from "expo-router";
import { View, Text, Pressable, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { Home, Plus, Bell, User, BookOpen, GraduationCap, Sun, Moon, Shield } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { isAdminRole } from "../../src/lib/roles";
import { setAdminAppPreview } from "../../src/lib/panelMode";

const TAB_ITEMS = [
  { name: "index", label: "Home", Icon: Home, isAction: false },
  { name: "search", label: "Repository", Icon: BookOpen, isAction: false },
  { name: "create", label: "Create", Icon: Plus, isAction: true },
  { name: "notifications", label: "Notifications", Icon: Bell, isAction: false },
  { name: "profile", label: "Profile", Icon: User, isAction: false },
] as const;

function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const isGuest = profile?.role === "guest";
  const visibleTabs = TAB_ITEMS.filter((item) => !isGuest || !item.isAction);
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 768;

  // Desktop Web: Facebook / LinkedIn Style Top Bar
  if (isDesktopWeb) {
    return (
      <View
        style={[
          styles.webTopBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            shadowColor: colors.shadow,
          },
        ]}
      >
        {/* Left: Brand Logo */}
        <View style={styles.webBrand}>
          <View style={[styles.webLogoIcon, { backgroundColor: colors.action }]}>
            <GraduationCap size={20} color="#FFFFFF" />
          </View>
          <Text style={[styles.webBrandTitle, { color: colors.textPrimary }]}>
            LCCB <Text style={{ color: colors.action }}>Connect</Text>
          </Text>
        </View>

        {/* Center: Navigation Links */}
        <View style={styles.webNavLinks}>
          {visibleTabs.map(({ name, label, Icon, isAction }) => {
            const routeIndex = state.routes.findIndex((route: any) => route.name === name);
            const focused = !isAction && state.index === routeIndex;

            if (isAction) {
              return (
                <Pressable
                  key={name}
                  onPress={() => router.push("/create")}
                  style={[styles.webCreateButton, { backgroundColor: colors.action }]}
                >
                  <Plus size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                  <Text style={styles.webCreateText}>Create Post</Text>
                </Pressable>
              );
            }

            return (
              <Pressable
                key={name}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                onPress={() => {
                  const route = state.routes[routeIndex];
                  if (!route) return;
                  const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                }}
                style={[
                  styles.webTab,
                  focused && { backgroundColor: colors.actionSurface },
                ]}
              >
                <Icon
                  size={18}
                  color={focused ? colors.action : colors.textTertiary}
                  strokeWidth={focused ? 2.5 : 2}
                />
                <Text
                  style={[
                    styles.webTabLabel,
                    { color: focused ? colors.action : colors.textTertiary },
                    focused && { fontWeight: "700" },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => void toggleTheme()}
            accessibilityRole="button"
            accessibilityLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
            style={[styles.webTab, { paddingHorizontal: 12, marginLeft: 4 }]}
          >
            {isDark ? (
              <Sun size={18} color={colors.action} strokeWidth={2.2} />
            ) : (
              <Moon size={18} color={colors.textTertiary} strokeWidth={2} />
            )}
            <Text style={[styles.webTabLabel, { color: colors.textTertiary }]}>
              {isDark ? "Light" : "Dark"}
            </Text>
          </Pressable>

          {isAdminRole(profile?.role) ? (
            <Pressable
              onPress={() => {
                setAdminAppPreview(false);
                router.push("/(admin)");
              }}
              accessibilityRole="button"
              accessibilityLabel="Open the admin console"
              style={[
                styles.webTab,
                {
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginLeft: 8,
                },
              ]}
            >
              <Shield size={18} color={colors.action} strokeWidth={2.2} />
              <Text style={[styles.webTabLabel, { color: colors.action }]}>
                Admin Console
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  // Mobile App: Standard Ergonomic Bottom Bar
  return (
    <View
      style={[
        styles.mobileBar,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      {visibleTabs.map(({ name, label, Icon, isAction }) => {
        const routeIndex = state.routes.findIndex((route: any) => route.name === name);
        const focused = !isAction && state.index === routeIndex;

        if (isAction) {
          return (
            <Pressable
              key={name}
              onPress={() => router.push("/create")}
              style={styles.mobileTab}
            >
              <View style={[styles.actionBubble, { backgroundColor: colors.action }]}>
                <Icon size={24} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <Text style={[styles.mobileLabel, { color: colors.textTertiary }]}>{label}</Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={name}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const route = state.routes[routeIndex];
              if (!route) return;
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={styles.mobileTab}
          >
            <View
              style={[
                styles.iconBubble,
                focused && { backgroundColor: colors.actionSurface },
              ]}
            >
              <Icon
                size={21}
                color={focused ? colors.action : colors.textTertiary}
                strokeWidth={focused ? 2.5 : 2}
              />
            </View>
            <Text
              style={[
                styles.mobileLabel,
                { color: focused ? colors.action : colors.textTertiary },
                focused && { fontWeight: "700" },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 768;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isDesktopWeb ? "top" : "bottom",
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Desktop Web Top Header Styles (Facebook style)
  webTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#DBEAFE",
    paddingHorizontal: 24,
    height: 64,
    shadowColor: "#1A56DB",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    zIndex: 100,
  },
  webBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  webLogoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1A56DB",
    alignItems: "center",
    justifyContent: "center",
  },
  webBrandTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  webNavLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  webTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  webTabActive: {
    backgroundColor: "#EFF6FF",
  },
  webTabLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  webTabLabelActive: {
    color: "#1A56DB",
    fontWeight: "700",
  },
  webCreateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A56DB",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    marginLeft: 8,
    shadowColor: "#1A56DB",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  webCreateText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // Mobile Bottom Bar Styles
  mobileBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#DBEAFE",
    paddingTop: 7,
    shadowColor: "#1A56DB",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 10,
  },
  mobileTab: { flex: 1, alignItems: "center", gap: 2 },
  iconBubble: { width: 38, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  activeBubble: { backgroundColor: "#EBF5FF" },
  actionBubble: { width: 44, height: 32, borderRadius: 16, backgroundColor: "#1A56DB", alignItems: "center", justifyContent: "center", marginTop: -2 },
  mobileLabel: { color: "#94A3B8", fontSize: 9, fontWeight: "600" },
  activeMobileLabel: { color: "#1A56DB", fontWeight: "700" },
});