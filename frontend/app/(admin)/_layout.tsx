import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
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
  Settings,
  ScrollText,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Sun,
  Moon,
} from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { ThemeTokens } from "../../src/lib/tokens";
import { isAdminRole, isSuperAdminRole } from "../../src/lib/roles";
import { setAdminAppPreview } from "../../src/lib/panelMode";

type NavItemProps = {
  icon: any;
  label: string;
  path: string;
  active: boolean;
  onPress: () => void;
  colors: ThemeTokens;
};

function NavItem({ icon: Icon, label, active, onPress, colors }: NavItemProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      // @ts-ignore web hover events
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        marginBottom: 4,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
        backgroundColor: active
          ? colors.sidebarActiveBg
          : hovered
          ? colors.sidebarItemHover
          : "transparent",
      }}
    >
      <Icon color={active ? colors.sidebarActiveText : colors.sidebarItemText} size={18} />
      <Text
        style={{
          marginLeft: 12,
          fontSize: 13,
          fontWeight: active ? "700" : "600",
          color: active ? colors.sidebarActiveText : colors.sidebarItemText,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { signOut, profile } = useAuth();
  const { colors, isDark, preference, cycleTheme } = useTheme();
  const isDesktop = Platform.OS === "web" && width >= 768;
  const adminUser = isAdminRole(profile?.role);

  if (!isDesktop || !adminUser) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfacePage,
          padding: 24,
        }}
      >
        <ShieldCheck size={36} color={colors.primary} />
        <Text
          style={{
            marginTop: 16,
            fontSize: 20,
            fontWeight: "700",
            color: colors.textPrimary,
          }}
        >
          {isDesktop ? "Admin access required" : "Desktop console"}
        </Text>
        <Text
          style={{
            marginTop: 8,
            maxWidth: 420,
            textAlign: "center",
            fontSize: 14,
            color: colors.textSecondary,
            lineHeight: 20,
          }}
        >
          {isDesktop
            ? "This account does not have access to the administration console."
            : "The admin console is available on desktop web. Use the normal app on this device."}
        </Text>
        <TouchableOpacity
          style={{
            marginTop: 24,
            borderRadius: 9999,
            backgroundColor: colors.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}
          onPress={() => {
            setAdminAppPreview(true);
            router.replace("/(tabs)/");
          }}
        >
          <Text style={{ fontWeight: "700", color: colors.textOnPrimary }}>Go to App</Text>
        </TouchableOpacity>
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
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isActive = (path: string) => {
    const relative = pathname.replace(/^\/\(admin\)/, "") || "/";
    if (path === "/(admin)") return relative === "/";
    const target = path.replace("/(admin)", "");
    return relative === target || relative.startsWith(`${target}/`);
  };

  const nav = [
    { label: "Overview", path: "/(admin)", icon: LayoutDashboard },
    { label: "Users", path: "/(admin)/users", icon: Users },
    { label: "Reports & Content", path: "/(admin)/content", icon: FileText },
    { label: "Announcements", path: "/(admin)/announcements", icon: Megaphone },
    {
      label: "Departments & Courses",
      path: "/(admin)/departments",
      icon: Building2,
    },
    { label: "Settings", path: "/(admin)/settings", icon: Settings },
  ];

  if (isSuperAdminRole(profile.role)) {
    nav.push({ label: "Audit", path: "/(admin)/audit", icon: ScrollText });
  }

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.surfacePage }}>
      <View
        style={{
          height: "100%",
          width: 256,
          borderRightWidth: 1,
          borderRightColor: colors.sidebarBorder,
          backgroundColor: colors.sidebarBg,
        }}
      >
        <ScrollView
          style={{ flex: 1, padding: 16 }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between" }}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <View
              style={{
                marginBottom: 24,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 4,
              }}
            >
              <Image
                source={require("../../assets/images/logo-seal.png")}
                style={{ width: 38, height: 38, marginRight: 12, borderRadius: 19 }}
                resizeMode="contain"
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "800",
                    color: colors.textPrimary,
                    letterSpacing: -0.2,
                  }}
                  numberOfLines={1}
                >
                  LCCB Connect
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    color: colors.primary,
                    marginTop: 1,
                  }}
                >
                  {isSuperAdminRole(profile.role) ? "Superadmin" : "Administrator"}
                </Text>
              </View>
            </View>

            {nav.map((item) => (
              <NavItem
                key={item.path}
                icon={item.icon}
                label={item.label}
                path={item.path}
                active={isActive(item.path)}
                onPress={() => router.push(item.path as any)}
                colors={colors}
              />
            ))}
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 16 }}>
            <View
              style={{
                marginBottom: 12,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 6,
                paddingVertical: 4,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.primarySurface,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontWeight: "700", fontSize: 13, color: colors.primary }}>
                  {(profile.full_name?.[0] || profile.username?.[0] || "A").toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}
                  numberOfLines={1}
                >
                  {profile.full_name || profile.username || "Admin"}
                </Text>
                <Text
                  style={{ fontSize: 11, color: colors.textTertiary, textTransform: "capitalize" }}
                  numberOfLines={1}
                >
                  {profile.role?.replace("_", " ") || "Admin"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => void cycleTheme()}
              style={{
                marginBottom: 4,
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: isDark ? colors.surfaceElevated : colors.surfaceSunken,
              }}
            >
              {isDark ? (
                <Moon size={16} color={colors.warning} />
              ) : (
                <Sun size={16} color={colors.warning} />
              )}
              <Text
                style={{
                  marginLeft: 10,
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.textSecondary,
                  flex: 1,
                }}
              >
                Theme: {preference.charAt(0).toUpperCase() + preference.slice(1)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setAdminAppPreview(true);
                router.push("/(tabs)/");
              }}
              style={{
                marginBottom: 4,
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <ExternalLink size={16} color={colors.textSecondary} />
              <Text
                style={{
                  marginLeft: 10,
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.textSecondary,
                }}
              >
                Back to App
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => void signOut()}
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <LogOut size={16} color={colors.destructiveText} />
              <Text
                style={{
                  marginLeft: 10,
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.destructiveText,
                }}
              >
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      <View style={{ flex: 1, overflow: "hidden", backgroundColor: colors.surfacePage }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.surfacePage },
          }}
        />
      </View>
    </View>
  );
}

