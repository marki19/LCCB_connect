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
import { LinearGradient } from "expo-linear-gradient";
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
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import {
  focusRing,
  RADIUS,
  SPACE,
  TYPE,
  type ThemeTokens,
} from "../../src/lib/tokens";
import { isAdminRole, isSuperAdminRole } from "../../src/lib/roles";
import { setAdminAppPreview } from "../../src/lib/panelMode";
import StatusBadge from "../../src/components/admin/StatusBadge";

const SIDEBAR_ANIMATION_MS = 240;

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
          minHeight: 42,
          marginBottom: 3,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          borderRadius: RADIUS.md,
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
            top: 11,
            bottom: 11,
            width: 3,
            borderRadius: 2,
            backgroundColor: colors.navAccent,
          }}
        />
      ) : null}
      <Icon
        size={18}
        color={active ? colors.navTextActive : colors.navText}
        strokeWidth={active ? 2.4 : 2}
      />
      {!collapsed ? (
        <Text
          numberOfLines={1}
          style={{
            marginLeft: SPACE.x3,
            ...TYPE.bodyStrong,
            fontSize: 13,
            fontWeight: active ? "700" : "600",
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
          minHeight: 40,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          borderRadius: RADIUS.md,
          paddingHorizontal: collapsed ? 0 : SPACE.x3,
          backgroundColor: hovered || focused ? colors.navHoverBg : "transparent",
        },
        focusRing(colors, focused),
      ]}
    >
      <Icon size={16} color={tint} strokeWidth={2.1} />
      {!collapsed ? (
        <Text
          numberOfLines={1}
          style={{
            marginLeft: SPACE.x3,
            ...TYPE.caption,
            fontWeight: "600",
            color: danger ? colors.destructiveText : colors.navText,
          }}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
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
  const collapsed = collapseOverride ?? width < 1180;
  const sidebarTargetWidth = collapsed ? 84 : 272;
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

  // Keep labels and controls in their expanded layout while the rail slides
  // closed, then swap to the compact icon-only layout once it has landed.
  useEffect(() => {
    if (collapsed) return;
    const frame = requestAnimationFrame(() => setContentCollapsed(false));
    return () => cancelAnimationFrame(frame);
  }, [collapsed]);

  if (!isDesktop) {
    return (
      <LinearGradient
        colors={[colors.navBg, colors.navBgAlt]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: SPACE.x6 }}
      >
        <View
          style={{
            width: 74,
            height: 74,
            borderRadius: 24,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: colors.navLine,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={require("../../assets/images/logo-seal.png")}
            style={{ width: 50, height: 50 }}
            resizeMode="contain"
          />
        </View>
        <Text style={{ ...TYPE.micro, color: colors.navAccent, marginTop: SPACE.x5 }}>
          LCCB Connect
        </Text>
        <Text
          style={{
            ...TYPE.h1,
            color: colors.navTextActive,
            textAlign: "center",
            marginTop: SPACE.x2,
            maxWidth: 430,
          }}
        >
          The console is a desk, not a pocket.
        </Text>
        <Text
          style={{
            ...TYPE.body,
            color: colors.navText,
            textAlign: "center",
            maxWidth: 390,
            marginTop: SPACE.x3,
          }}
        >
          Open the admin console on desktop web. Your student and faculty experience is right
          here on mobile.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setAdminAppPreview(true);
            router.replace("/(tabs)/");
          }}
          style={({ pressed }) => ({
            marginTop: SPACE.x6,
            minHeight: 46,
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.x2,
            borderRadius: RADIUS.pill,
            backgroundColor: colors.navAccent,
            paddingHorizontal: SPACE.x6,
            paddingVertical: SPACE.x3,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ ...TYPE.bodyStrong, color: "#20160A" }}>Go to App</Text>
          <ExternalLink size={15} color="#20160A" />
        </Pressable>
      </LinearGradient>
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
        <ActivityIndicator size="large" color={colors.brandSolid} />
        <Text style={{ ...TYPE.body, color: colors.inkSoft }}>Loading the console…</Text>
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
            width: 92,
            height: 92,
            borderRadius: 28,
            backgroundColor: colors.coralWash,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ rotate: "-6deg" }],
          }}
        >
          <ShieldCheck size={40} color={colors.coralText} strokeWidth={1.8} />
        </View>
        <Text style={{ ...TYPE.h1, color: colors.ink, marginTop: SPACE.x6 }}>
          Admin access required
        </Text>
        <Text
          style={{
            ...TYPE.body,
            color: colors.inkSoft,
            textAlign: "center",
            maxWidth: 420,
            marginTop: SPACE.x2,
          }}
        >
          This account does not have access to the administration console.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setAdminAppPreview(true);
            router.replace("/(tabs)/");
          }}
          style={({ pressed }) => ({
            marginTop: SPACE.x6,
            minHeight: 44,
            borderRadius: RADIUS.pill,
            backgroundColor: colors.brandSolid,
            paddingHorizontal: SPACE.x6,
            paddingVertical: SPACE.x3,
            opacity: pressed ? 0.88 : 1,
          })}
        >
          <Text style={{ ...TYPE.bodyStrong, color: colors.textOnPrimary }}>Go to App</Text>
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
    { label: "Reports & Content", path: "/(admin)/content", icon: FileText },
    { label: "Announcements", path: "/(admin)/announcements", icon: Megaphone },
  ];

  const system: NavEntry[] = [
    { label: "Departments & Courses", path: "/(admin)/departments", icon: Building2 },
  ];

  if (isSuperAdminRole(profile.role)) {
    system.unshift({ label: "Audit", path: "/(admin)/audit", icon: ScrollText });
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
        }}
      >
        <LinearGradient
          colors={[colors.navBg, colors.navBgAlt]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -110,
            right: -90,
            width: 240,
            height: 240,
            borderRadius: 120,
            backgroundColor: colors.heroGlow,
            opacity: 0.10,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 80,
            left: -100,
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: colors.navAccent,
            opacity: 0.05,
          }}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "space-between",
            paddingHorizontal: contentCollapsed ? SPACE.x2 : SPACE.x4,
            paddingTop: SPACE.x5,
            paddingBottom: SPACE.x4,
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
                paddingHorizontal: contentCollapsed ? 0 : SPACE.x1,
                marginBottom: SPACE.x6,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: RADIUS.md,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.06)",
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
                    style={{ ...TYPE.title, fontSize: 15, color: colors.navTextActive }}
                  >
                    LCCB Connect
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ ...TYPE.micro, fontSize: 8.5, color: colors.navAccent, marginTop: 2 }}
                  >
                    Admin Console
                  </Text>
                </View>
              ) : null}
            </View>

            {!contentCollapsed ? (
              <Text
                style={{
                  ...TYPE.micro,
                  fontSize: 8.5,
                  color: "rgba(169, 182, 204, 0.72)",
                  paddingHorizontal: SPACE.x3,
                  marginBottom: SPACE.x2,
                }}
              >
                Governance
              </Text>
            ) : null}
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
            {!contentCollapsed ? (
              <Text
                style={{
                  ...TYPE.micro,
                  fontSize: 8.5,
                  color: "rgba(169, 182, 204, 0.72)",
                  paddingHorizontal: SPACE.x3,
                  marginBottom: SPACE.x2,
                }}
              >
                System
              </Text>
            ) : null}
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
                marginBottom: SPACE.x2,
              }}
            >
              {!contentCollapsed ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.x3,
                    paddingHorizontal: SPACE.x2,
                    paddingVertical: SPACE.x2,
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
                      style={{ ...TYPE.bodyStrong, color: colors.navTextActive, fontSize: 12 }}
                    >
                      {(profile.full_name?.[0] || profile.username?.[0] || "A").toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{ ...TYPE.caption, fontWeight: "700", color: colors.navTextActive }}
                    >
                      {profile.full_name || profile.username || "Admin"}
                    </Text>
                    <View style={{ marginTop: 3 }}>
                      <StatusBadge
                        label={isSuperAdminRole(profile.role) ? "Superadmin" : "Administrator"}
                        tone={isSuperAdminRole(profile.role) ? "warning" : "brand"}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <View
                  style={{
                    alignItems: "center",
                    paddingVertical: SPACE.x2,
                    marginBottom: SPACE.x1,
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
                      style={{ ...TYPE.bodyStrong, color: colors.navTextActive, fontSize: 12 }}
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
                label="Back to App"
                onPress={() => {
                  setAdminAppPreview(true);
                  router.push("/(tabs)/");
                }}
                collapsed={contentCollapsed}
                colors={colors}
              />
              <UtilityRow
                icon={LogOut}
                label="Sign Out"
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
        </LinearGradient>
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
