import { useState } from "react";
import { Tabs, useRouter } from "expo-router";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Image,
} from "react-native";
import { Home, Plus, Bell, User, BookOpen, Sun, Moon, Shield } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { isAdminRole } from "../../src/lib/roles";
import { setAdminAppPreview } from "../../src/lib/panelMode";
import {
  elevation,
  focusRing,
  RADIUS,
  SPACE,
  TYPE,
  type ThemeTokens,
} from "../../src/lib/tokens";

const TAB_ITEMS = [
  { name: "index", label: "Home", Icon: Home, isAction: false },
  { name: "search", label: "Repository", Icon: BookOpen, isAction: false },
  { name: "create", label: "Create", Icon: Plus, isAction: true },
  { name: "notifications", label: "Notifications", Icon: Bell, isAction: false },
  { name: "profile", label: "Profile", Icon: User, isAction: false },
] as const;

function DesktopTab({
  label,
  icon: Icon,
  focused,
  onPress,
  colors,
  showLabel = true,
}: {
  label: string;
  icon: any;
  focused: boolean;
  onPress: () => void;
  colors: ThemeTokens;
  showLabel?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocusVisible(true)}
      onBlur={() => setFocusVisible(false)}
      style={[
        styles.webTab,
        !showLabel && styles.webTabCompact,
        {
          backgroundColor: focused
            ? colors.brandWash
            : hovered
            ? colors.panelInset
            : "transparent",
        },
        focusRing(colors, focusVisible),
      ]}
    >
      <Icon
        size={17}
        color={focused ? colors.brand : colors.inkFaint}
        strokeWidth={focused ? 2.4 : 2}
      />
      {showLabel ? (
        <Text
          style={[
            styles.webTabLabel,
            {
              color: focused ? colors.brand : colors.inkSoft,
              fontWeight: focused ? "700" : "600",
            },
          ]}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

function MobileTab({
  label,
  icon: Icon,
  focused,
  onPress,
  colors,
}: {
  label: string;
  icon: any;
  focused: boolean;
  onPress: () => void;
  colors: ThemeTokens;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      style={({ pressed }) => [styles.mobileTab, { opacity: pressed ? 0.72 : 1 }]}
    >
      {focused ? (
        <View
          pointerEvents="none"
          style={[styles.mobileActiveIndicator, { backgroundColor: colors.brand }]}
        />
      ) : null}
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
}

function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const isGuest = profile?.role === "guest";
  const visibleTabs = TAB_ITEMS.filter((item) => !isGuest || !item.isAction);
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 768;
  const compactNav = width < 1120;
  const compactActions = width < 1320;

  const navigate = (name: string, focused: boolean) => {
    const routeIndex = state.routes.findIndex((route: any) => route.name === name);
    const route = state.routes[routeIndex];
    if (!route) return;
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  // Desktop Web: editorial top bar
  if (isDesktopWeb) {
    return (
      <View
        style={[
          styles.webTopBar,
          {
            backgroundColor: colors.panel,
            borderBottomColor: colors.line,
            ...elevation("sm", colors),
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="LCCB Connect home"
          onPress={() => router.push("/(tabs)/")}
          style={styles.webBrand}
        >
          <View
            style={[
              styles.webLogoIcon,
              { backgroundColor: colors.brandWash, borderColor: colors.brandWashStrong },
            ]}
          >
            <Image
              source={require("../../assets/images/logo-seal.png")}
              style={{ width: 26, height: 26 }}
              resizeMode="contain"
            />
          </View>
          <View>
            <Text style={[styles.webBrandTitle, { color: colors.ink }]}>
              LCCB <Text style={{ color: colors.brand }}>Connect</Text>
            </Text>
            <Text style={[styles.webBrandSub, { color: colors.inkFaint }]}>
              {compactNav ? "Campus" : "Campus network"}
            </Text>
          </View>
        </Pressable>

        <View style={styles.webNavLinks}>
          {visibleTabs.map(({ name, label, Icon, isAction }) => {
            const routeIndex = state.routes.findIndex((route: any) => route.name === name);
            const focused = !isAction && state.index === routeIndex;

            if (isAction) {
              return (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  accessibilityLabel="Create a post"
                  onPress={() => router.push("/create")}
                  style={({ pressed }) => [
                    styles.webCreateButton,
                    {
                      backgroundColor: colors.brandSolid,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <Plus size={16} color={colors.textOnPrimary} strokeWidth={2.5} />
                  {!compactActions ? (
                    <Text style={[styles.webCreateText, { color: colors.textOnPrimary }]}>
                      Create post
                    </Text>
                  ) : null}
                </Pressable>
              );
            }

            return (
              <DesktopTab
                key={name}
                label={label}
                icon={Icon}
                focused={focused}
                onPress={() => navigate(name, focused)}
                colors={colors}
                showLabel={!compactNav}
              />
            );
          })}

          <Pressable
            onPress={() => void toggleTheme()}
            accessibilityRole="button"
            accessibilityLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
            style={({ pressed }) => [
              styles.webIconButton,
              {
                backgroundColor: pressed ? colors.panelInset : "transparent",
              },
            ]}
          >
            {isDark ? (
              <Sun size={18} color={colors.accentText} strokeWidth={2.2} />
            ) : (
              <Moon size={18} color={colors.inkSoft} strokeWidth={2} />
            )}
          </Pressable>

          {isAdminRole(profile?.role) ? (
            <Pressable
              onPress={() => {
                setAdminAppPreview(false);
                router.push("/(admin)");
              }}
              accessibilityRole="button"
              accessibilityLabel="Open the admin console"
              style={({ pressed }) => [
                styles.webAdminButton,
                {
                  borderColor: colors.line,
                  backgroundColor: pressed ? colors.panelInset : "transparent",
                },
              ]}
            >
              <Shield size={16} color={colors.brand} strokeWidth={2.2} />
              {!compactActions ? (
                <Text style={[styles.webAdminLabel, { color: colors.brand }]}>
                  Admin console
                </Text>
              ) : null}
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  // Mobile: thumb-friendly bottom bar
  return (
    <View
      style={[
        styles.mobileBar,
        {
          paddingBottom: Math.max(insets.bottom, 10),
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.line,
          ...elevation("lg", colors),
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
              <Text style={[styles.mobileLabel, { color: colors.brand, fontWeight: "700" }]}>
                {label}
              </Text>
            </Pressable>
          );
        }

        return (
          <MobileTab
            key={name}
            label={label}
            icon={Icon}
            focused={focused}
            onPress={() => navigate(name, focused)}
            colors={colors}
          />
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
  webTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingHorizontal: SPACE.x6,
    height: 68,
    zIndex: 100,
  },
  webBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
    minHeight: 44,
  },
  webLogoIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  webBrandTitle: {
    ...TYPE.title,
    fontSize: 17,
    letterSpacing: -0.5,
  },
  webBrandSub: {
    ...TYPE.micro,
    fontSize: 7.5,
    marginTop: 1,
  },
  webNavLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x1,
  },
  webTab: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x3,
    borderRadius: RADIUS.pill,
    gap: 6,
  },
  webTabCompact: {
    width: 40,
    paddingHorizontal: 0,
    justifyContent: "center",
  },
  webTabLabel: {
    fontSize: 13,
  },
  webIconButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: SPACE.x1,
  },
  webAdminButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.x3,
    marginLeft: SPACE.x1,
  },
  webAdminLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  webCreateButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACE.x4,
    borderRadius: RADIUS.pill,
    marginLeft: SPACE.x2,
  },
  webCreateText: {
    fontSize: 12,
    fontWeight: "700",
  },
  mobileBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderTopWidth: 1,
    paddingTop: 7,
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
