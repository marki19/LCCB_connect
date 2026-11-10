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
import { isAdminRole, isDepartmentAdminRole } from "../../src/lib/roles";
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
}: {
  label: string;
  icon: any;
  focused: boolean;
  onPress: () => void;
  colors: ThemeTokens;
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
          {(hovered || focusVisible) && (
            <Text pointerEvents="none" style={[styles.webTooltip, { backgroundColor: colors.ink, color: colors.surfacePage }]}>
              {label}
            </Text>
          )}
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

function IconAction({
  label,
  icon: Icon,
  iconColor,
  variant,
  onPress,
  colors,
}: {
  label: string;
  icon: any;
  iconColor: string;
  variant: "primary" | "outline";
  onPress: () => void;
  colors: ThemeTokens;
}) {
  const [hovered, setHovered] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocusVisible(true)}
      onBlur={() => setFocusVisible(false)}
      style={({ pressed }) => [
        styles.iconAction,
        { width: 40, paddingHorizontal: 0, justifyContent: "center" },
        variant === "primary"
          ? {
              backgroundColor: colors.brandSolid,
              opacity: pressed ? 0.88 : 1,
            }
          : {
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: pressed ? colors.panelInset : "transparent",
            },
        focusRing(colors, focusVisible),
      ]}
    >
      <Icon size={17} color={iconColor} strokeWidth={2.4} />
      {(hovered || focusVisible) && (
        <Text
          pointerEvents="none"
          style={[styles.webTooltip, { backgroundColor: colors.ink, color: colors.surfacePage }]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function TabBar({ state, descriptors, emitter, navigateToTab }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const isGuest = profile?.role === "guest";
  const adminUser = isAdminRole(profile?.role);
  const departmentAdmin = isDepartmentAdminRole(profile?.role);
  const visibleTabs = TAB_ITEMS.filter((item) => !isGuest || !item.isAction);
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 768;

  // Shared hover/focus state for Create, Admin, and theme-toggle buttons
  const [hovered, setHovered] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);

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
          </View>
        </Pressable>

        <View style={styles.webNavLinks}>
          {visibleTabs.map(({ name, label, Icon, isAction }) => {
            const routeIndex = state.routes.findIndex((route: any) => route.name === name);
            const focused = !isAction && state.index === routeIndex;

            if (isAction) {
              return (
                <IconAction
                  key={name}
                  label="Create a post"
                  icon={Plus}
                  iconColor={colors.textOnBrandSolid}
                  variant="primary"
                  colors={colors}
                  onPress={() => router.push("/create")}
                />
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
              />
            );
          })}

          <Pressable
            onPress={() => void toggleTheme()}
            accessibilityRole="button"
            accessibilityLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
            onHoverIn={() => setHovered(true)}
            onHoverOut={() => setHovered(false)}
            onFocus={() => setFocusVisible(true)}
            onBlur={() => setFocusVisible(false)}
            style={({ pressed }) => [
              styles.webIconButton,
              {
                backgroundColor: pressed ? colors.panelInset : hovered ? colors.panelInset : "transparent",
              },
              focusRing(colors, focusVisible),
            ]}
          >
            {isDark ? (
              <Sun size={18} color={colors.accentText} strokeWidth={2.2} />
            ) : (
              <Moon size={18} color={colors.inkSoft} strokeWidth={2} />
            )}
            {(hovered || focusVisible) && (
              <Text
                pointerEvents="none"
                style={[styles.webTooltip, { backgroundColor: colors.ink, color: colors.surfacePage }]}
              >
                {isDark ? "Switch to light theme" : "Switch to dark theme"}
              </Text>
            )}
          </Pressable>

          {adminUser ? (
            <IconAction
              label="Open the admin console"
              icon={Shield}
              iconColor={colors.brand}
              variant="outline"
              colors={colors}
              onPress={() => {
                setAdminAppPreview(false);
                router.push("/(admin)");
              }}
            />
          ) : departmentAdmin ? (
            <IconAction
              label="Open the moderation console"
              icon={Shield}
              iconColor={colors.action}
              variant="outline"
              colors={colors}
              onPress={() => router.push("/(moderation)" as any)}
            />
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
                <Plus size={22} color={colors.textOnBrandSolid} strokeWidth={2.6} />
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
  webTooltip: {
    position: "absolute",
    top: 46,
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: "600",
    zIndex: 200,
  },
  webIconButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: SPACE.x1,
  },
  iconAction: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.pill,
    marginLeft: SPACE.x2,
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
