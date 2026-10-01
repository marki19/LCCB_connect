import { Tabs, useRouter } from "expo-router";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Home, Search, Plus, Bell, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_ITEMS = [
  { name: "index", label: "Home", Icon: Home, isAction: false },
  { name: "search", label: "Search", Icon: Search, isAction: false },
  { name: "create", label: "Create", Icon: Plus, isAction: true },
  { name: "notifications", label: "Notifications", Icon: Bell, isAction: false },
  { name: "profile", label: "Profile", Icon: User, isAction: false },
] as const;

function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TAB_ITEMS.map(({ name, label, Icon, isAction }) => {
        const routeIndex = state.routes.findIndex((route: any) => route.name === name);
        const focused = !isAction && state.index === routeIndex;

        if (isAction) {
          return (
            <Pressable
              key={name}
              onPress={() => router.push("/create")}
              style={styles.tab}
            >
              <View style={styles.actionBubble}>
                <Icon size={24} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <Text style={styles.label}>{label}</Text>
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
            style={styles.tab}
          >
            <View style={[styles.iconBubble, focused && styles.activeBubble]}>
              <Icon size={21} color={focused ? "#1A56DB" : "#94A3B8"} strokeWidth={focused ? 2.5 : 2} />
            </View>
            <Text style={[styles.label, focused && styles.activeLabel]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
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
  tab: { flex: 1, alignItems: "center", gap: 2 },
  iconBubble: { width: 38, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  activeBubble: { backgroundColor: "#EBF5FF" },
  actionBubble: { width: 44, height: 32, borderRadius: 16, backgroundColor: "#1A56DB", alignItems: "center", justifyContent: "center", marginTop: -2 },
  label: { color: "#94A3B8", fontSize: 9, fontWeight: "600" },
  activeLabel: { color: "#1A56DB", fontWeight: "700" },
});