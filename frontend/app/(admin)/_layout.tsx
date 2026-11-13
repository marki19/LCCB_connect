import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Image,
} from "react-native";
import { Stack, useRouter, usePathname } from "expo-router";
import {
  LayoutDashboard,
  Users,
  FileText,
  Megaphone,
  Building2,
  ScrollText,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Sun,
  Moon,
  Monitor,
  UserCheck,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { focusRing, RADIUS, sansFamily, SPACE, type ThemeTokens } from "../../src/lib/tokens";
import { isAdminRole, isSuperAdminRole } from "../../src/lib/roles";
import { setAdminAppPreview } from "../../src/lib/panelMode";
import { CONSOLE_TEXT } from "../../src/components/admin/consoleTheme";

const SIDEBAR_ANIMATION_MS = 220;

type NavEntry = {
  label: string;
  path: string;
  icon: any;
};

type NavItemProps = {
  icon: any;
  label: string;
  active: boolean;
  collapsed: boolean;
  onPress: () => void;
  colors: ThemeTokens;
};

function NavItem({ icon: Icon, label, active, collapsed, onPress, colors }: NavItemProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          position: "relative",
          minHeight: 46,
          marginBottom: 2,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          borderRadius: RADIUS.sm,
          paddingHorizontal: collapsed ? 0 : SPACE.x3,
          backgroundColor: active
            ? colors.navActiveBg
            : hovered || focused
            ? colors.navHoverBg
            : "transparent",
        },
        focusRing(colors, focused),
      ]}
    >
      {active ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 10,
            bottom: 10,
            width: 2,
            borderRadius: 1,
            backgroundColor: colors.navAccent,
          }}
        />
      ) : null}
      <Icon
        size={20}
        color={active ? colors.navTextActive : colors.navText}
        strokeWidth={active ? 2.2 : 1.9}
      />
      {!collapsed ? (
        <Text
          numberOfLines={1}
          style={{
            marginLeft: SPACE.x3,
            fontFamily: sansFamily,
            fontSize: 15.5,
            lineHeight: 20,
            fontWeight: active ? "600" : "500",
            color: active ? colors.navTextActive : colors.navText,
          }}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

function UtilityRow({
  icon: Icon,
  label,
  onPress,
  collapsed,
  colors,
  danger = false,
  iconColor,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  collapsed: boolean;
  colors: ThemeTokens;
  danger?: boolean;
  iconColor?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const tint = danger ? colors.destructiveText : iconColor ?? colors.navText;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          minHeight: 42,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          borderRadius: RADIUS.sm,
          paddingHorizontal: collapsed ? 0 : SPACE.x3,
          backgroundColor: hovered || focused ? colors.navHoverBg : "transparent",
        },
        focusRing(colors, focused),
      ]}
    >
      <Icon size={17} color={tint} strokeWidth={1.9} />
      {!collapsed ? (
        <Text
          numberOfLines={1}
          style={{
            marginLeft: SPACE.x3,
            fontFamily: sansFamily,
            fontSize: 14,
            lineHeight: 19,
            fontWeight: "500",
            color: danger ? colors.destructiveText : colors.navText,
          }}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

function SectionHeading({ label, colors }: { label: string; colors: ThemeTokens }) {
  return (
    <Text
      style={{
        ...CONSOLE_TEXT.eyebrow,
        fontSize: 10.5,
        letterSpacing: 1.1,
        color: colors.navText,
        opacity: 0.8,
        paddingHorizontal: SPACE.x3,
        marginBottom: SPACE.x2,
        marginTop: SPACE.x3,
      }}
    >
      {label}
    </Text>
  );
}

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { signOut, profile } = useAuth();
  const { colors, preference, cycleTheme } = useTheme();
  const isDesktop = Platform.OS === "web" && width >= 768;
  const adminUser = isAdminRole(profile?.role);
  const [collapseOverride, setCollapseOverride] = useState<boolean | null>(null);
  const collapsed = collapseOverride ?? width < 1000;
  const sidebarTargetWidth = collapsed ? 84 : 320;
  const [sidebarWidthAnim] = useState(() => new Animated.Value(sidebarTargetWidth));
  const [contentCollapsed, setContentCollapsed] = useState(collapsed);
  const ThemePreferenceIcon =
    preference === "system" ? Monitor : preference === "light" ? Sun : Moon;

  useEffect(() => {
    const animation = Animated.timing(sidebarWidthAnim, {
      toValue: sidebarTargetWidth,
      duration: SIDEBAR_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) setContentCollapsed(collapsed);
    });
    return () => animation.stop();
  }, [collapsed, sidebarTargetWidth, sidebarWidthAnim]);

  // Keep labels in their expanded layout while the rail slides closed, then
  // swap to the compact icon-only layout once it has landed.
  useEffect(() => {
    if (collapsed) return;
    const frame = requestAnimationFrame(() => setContentCollapsed(false));
    return () => cancelAnimationFrame(frame);
  }, [collapsed]);

  if (!isDesktop) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: SPACE.x6,
          backgroundColor: colors.navBg,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: RADIUS.lg,
            backgroundColor: colors.navHoverBg,
            borderWidth: 1,
            borderColor: colors.navLine,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={require("../../assets/images/logo-seal.png")}
            style={{ width: 44, height: 44 }}
            resizeMode="contain"
          />
        </View>
        <Text
          style={{
            ...CONSOLE_TEXT.eyebrow,
            fontSize: 10,
            color: colors.navAccent,
            marginTop: SPACE.x5,
          }}
        >
          LCCB Connect
        </Text>
        <Text
          style={{
            ...CONSOLE_TEXT.pageTitle,
            fontSize: 24,
            lineHeight: 31,
            color: colors.navTextActive,
            textAlign: "center",
            marginTop: SPACE.x2,
            maxWidth: 380,
          }}
        >
          Open the console on a desktop
        </Text>
        <Text
          style={{
            ...CONSOLE_TEXT.body,
            color: colors.navText,
            textAlign: "center",
            maxWidth: 380,
            marginTop: SPACE.x3,
          }}
        >
          Managing accounts, reports and announcements needs the wider layout. Your regular app is
          still available on this device.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setAdminAppPreview(true);
            router.replace("/(tabs)/");
          }}
          style={({ pressed }) => ({
            marginTop: SPACE.x6,
            minHeight: 42,
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.x2,
            borderRadius: RADIUS.sm,
            backgroundColor: colors.navAccent,
            paddingHorizontal: SPACE.x6,
            paddingVertical: SPACE.x2,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text
            style={{
              ...CONSOLE_TEXT.strong,
              fontSize: 13,
              color: colors.navBg,
            }}
          >
            Back to the app
          </Text>
          <ExternalLink size={14} color={colors.navBg} />
        </Pressable>
      </View>
    );
  }

  if (!profile) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfacePage,
          gap: SPACE.x4,
        }}
      >
        <ActivityIndicator accessibilityLabel="Loading" size="large" color={colors.brandSolid} />
        <Text style={{ ...CONSOLE_TEXT.body, color: colors.inkSoft }}>Loading the console</Text>
      </View>
    );
  }

  if (!adminUser) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfacePage,
          padding: SPACE.x8,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: RADIUS.lg,
            backgroundColor: colors.coralWash,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ShieldCheck size={26} color={colors.coralText} strokeWidth={1.8} />
        </View>
        <Text
          style={{
            ...CONSOLE_TEXT.pageTitle,
            fontSize: 24,
            lineHeight: 31,
            color: colors.ink,
            marginTop: SPACE.x5,
            textAlign: "center",
          }}
        >
          Administrator access required
        </Text>
        <Text
          style={{
            ...CONSOLE_TEXT.body,
            color: colors.inkSoft,
            textAlign: "center",
            maxWidth: 400,
            marginTop: SPACE.x2,
          }}
        >
          This account cannot open the administration console.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setAdminAppPreview(true);
            router.replace("/(tabs)/");
          }}
          style={({ pressed }) => ({
            marginTop: SPACE.x6,
            minHeight: 42,
            borderRadius: RADIUS.sm,
            backgroundColor: colors.brandSolid,
            paddingHorizontal: SPACE.x6,
            paddingVertical: SPACE.x2,
            opacity: pressed ? 0.88 : 1,
          })}
        >
          <Text style={{ ...CONSOLE_TEXT.strong, fontSize: 13, color: colors.textOnBrandSolid }}>
            Back to the app
          </Text>
        </Pressable>
      </View>
    );
  }

  const isActive = (path: string) => {
    const relative = pathname.replace(/^\/\(admin\)/, "") || "/";
    if (path === "/(admin)") return relative === "/";
    const target = path.replace("/(admin)", "");
    return relative === target || relative.startsWith(`${target}/`);
  };

  const governance: NavEntry[] = [
    { label: "Overview", path: "/(admin)", icon: LayoutDashboard },
    { label: "Users", path: "/(admin)/users", icon: Users },
    { label: "Verification", path: "/(admin)/verification", icon: UserCheck },
    { label: "Reports and content", path: "/(admin)/content", icon: FileText },
    { label: "Announcements", path: "/(admin)/announcements", icon: Megaphone },
  ];

  const system: NavEntry[] = [
    { label: "Departments and courses", path: "/(admin)/departments", icon: Building2 },
  ];

  if (isSuperAdminRole(profile.role)) {
    system.unshift({ label: "Audit log", path: "/(admin)/audit", icon: ScrollText });
  }

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.surfacePage }}>
      <Animated.View
        testID="admin-sidebar"
        style={{
          height: "100%",
          width: sidebarWidthAnim,
          borderRightWidth: 1,
          borderRightColor: colors.navLine,
          overflow: "hidden",
          backgroundColor: colors.navBg,
        }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "space-between",
            paddingHorizontal: contentCollapsed ? SPACE.x2 : SPACE.x4,
            paddingTop: SPACE.x4,
            paddingBottom: SPACE.x3,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <View
              style={{
                flexDirection: contentCollapsed ? "column" : "row",
                alignItems: "center",
                justifyContent: contentCollapsed ? "center" : "flex-start",
                gap: SPACE.x3,
                paddingHorizontal: contentCollapsed ? 0 : SPACE.x2,
                marginBottom: SPACE.x6,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: RADIUS.sm,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.navHoverBg,
                  borderWidth: 1,
                  borderColor: colors.navLine,
                }}
              >
                <Image
                  source={require("../../assets/images/logo-seal.png")}
                  style={{ width: 30, height: 30 }}
                  resizeMode="contain"
                />
              </View>
              {!contentCollapsed ? (
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: sansFamily,
                      fontSize: 16,
                      lineHeight: 21,
                      fontWeight: "600",
                      color: colors.navTextActive,
                    }}
                  >
                    LCCB Connect
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: sansFamily,
                      fontSize: 13,
                      lineHeight: 17,
                      color: colors.navText,
                      marginTop: 1,
                    }}
                  >
                    Admin console
                  </Text>
                </View>
              ) : null}
            </View>

            {!contentCollapsed ? <SectionHeading label="Manage" colors={colors} /> : null}
            {governance.map((item) => (
              <NavItem
                key={item.path}
                icon={item.icon}
                label={item.label}
                active={isActive(item.path)}
                collapsed={contentCollapsed}
                onPress={() => router.push(item.path as any)}
                colors={colors}
              />
            ))}

            <View
              style={{
                height: 1,
                backgroundColor: colors.navLine,
                marginVertical: SPACE.x3,
                marginHorizontal: contentCollapsed ? SPACE.x2 : 0,
              }}
            />

            {!contentCollapsed ? <SectionHeading label="System" colors={colors} /> : null}
            {system.map((item) => (
              <NavItem
                key={item.path}
                icon={item.icon}
                label={item.label}
                active={isActive(item.path)}
                collapsed={contentCollapsed}
                onPress={() => router.push(item.path as any)}
                colors={colors}
              />
            ))}
          </View>

          <View style={{ marginTop: SPACE.x6 }}>
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.navLine,
                paddingTop: SPACE.x3,
              }}
            >
              {!contentCollapsed ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.x3,
                    paddingHorizontal: SPACE.x2,
                    paddingBottom: SPACE.x3,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: colors.navActiveBg,
                      borderWidth: 1,
                      borderColor: colors.navLine,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: sansFamily,
                        fontSize: 14,
                        fontWeight: "700",
                        color: colors.navTextActive,
                      }}
                    >
                      {(profile.full_name?.[0] || profile.username?.[0] || "A").toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: sansFamily,
                        fontSize: 14.5,
                        lineHeight: 19,
                        fontWeight: "600",
                        color: colors.navTextActive,
                      }}
                    >
                      {profile.full_name || profile.username || "Admin"}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: sansFamily,
                        fontSize: 12.5,
                        lineHeight: 17,
                        color: colors.navText,
                      }}
                    >
                      {isSuperAdminRole(profile.role) ? "Superadmin" : "Administrator"}
                    </Text>
                  </View>
                </View>
              ) : (
                <View
                  style={{
                    alignItems: "center",
                    paddingBottom: SPACE.x2,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: colors.navActiveBg,
                      borderWidth: 1,
                      borderColor: colors.navLine,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: sansFamily,
                        fontSize: 13,
                        fontWeight: "700",
                        color: colors.navTextActive,
                      }}
                    >
                      {(profile.full_name?.[0] || profile.username?.[0] || "A").toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}

              <UtilityRow
                icon={ThemePreferenceIcon}
                label={`Theme: ${preference.charAt(0).toUpperCase() + preference.slice(1)}`}
                onPress={() => void cycleTheme()}
                collapsed={contentCollapsed}
                colors={colors}
                iconColor={colors.navAccent}
              />
              <UtilityRow
                icon={ExternalLink}
                label="Back to the app"
                onPress={() => {
                  setAdminAppPreview(true);
                  router.push("/(tabs)/");
                }}
                collapsed={contentCollapsed}
                colors={colors}
              />
              <UtilityRow
                icon={LogOut}
                label="Sign out"
                onPress={() => void signOut()}
                collapsed={contentCollapsed}
                colors={colors}
                danger
              />
              <UtilityRow
                icon={collapsed ? PanelLeftOpen : PanelLeftClose}
                label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onPress={() => setCollapseOverride(!collapsed)}
                collapsed={contentCollapsed}
                colors={colors}
              />
            </View>
          </View>
        </ScrollView>
      </Animated.View>

      <View style={{ flex: 1, overflow: "hidden", backgroundColor: colors.surfacePage }}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
            contentStyle: { backgroundColor: colors.surfacePage },
          }}
        />
      </View>
    </View>
  );
}
