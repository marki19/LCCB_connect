import { Tabs, useRouter } from "expo-router";
import { View, Text, Pressable, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { Home, Plus, Bell, User, BookOpen, GraduationCap } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/contexts/AuthContext";

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
  const isGuest = profile?.role === "guest";
  const visibleTabs = TAB_ITEMS.filter((item) => !isGuest || !item.isAction);
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 768;

  // Desktop Web: Facebook / LinkedIn Style Top Bar
  if (isDesktopWeb) {
    return (
      <View style={styles.webTopBar}>
        {/* Left: Brand Logo */}
        <View style={styles.webBrand}>
          <View style={styles.webLogoIcon}>
            <GraduationCap size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.webBrandTitle}>LCCB <Text style={{ color: "#1A56DB" }}>Connect</Text></Text>
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
                  style={styles.webCreateButton}
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
                style={[styles.webTab, focused && styles.webTabActive]}
              >
                <Icon size={18} color={focused ? "#1A56DB" : "#64748B"} strokeWidth={focused ? 2.5 : 2} />
                <Text style={[styles.webTabLabel, focused && styles.webTabLabelActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  // Mobile App: Standard Ergonomic Bottom Bar
  return (
    <View style={[styles.mobileBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
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
              <View style={styles.actionBubble}>
                <Icon size={24} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <Text style={styles.mobileLabel}>{label}</Text>
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
            <View style={[styles.iconBubble, focused && styles.activeBubble]}>
              <Icon size={21} color={focused ? "#1A56DB" : "#94A3B8"} strokeWidth={focused ? 2.5 : 2} />
            </View>
            <Text style={[styles.mobileLabel, focused && styles.activeMobileLabel]}>{label}</Text>
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