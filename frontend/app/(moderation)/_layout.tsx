import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Stack, usePathname, useRouter } from "expo-router";
import {
  ExternalLink,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { ThemeTokens } from "../../src/lib/tokens";
import {
  isDepartmentAdminRole,
  isModeratorRole,
} from "../../src/lib/roles";
import { setAdminAppPreview } from "../../src/lib/panelMode";

type NavItemProps = {
  active: boolean;
  colors: ThemeTokens;
  label: string;
  onPress: () => void;
};

function NavItem({ active, colors, label, onPress }: NavItemProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
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
      <ShieldCheck
        color={active ? colors.sidebarActiveText : colors.sidebarItemText}
        size={18}
      />
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
    </Pressable>
  );
}

export default function ModerationLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { signOut, profile } = useAuth();
  const { colors, isDark, preference, cycleTheme } = useTheme();
  const isDesktop = Platform.OS === "web" && width >= 768;
  const moderatorUser = isModeratorRole(profile?.role);
  const departmentAdmin = isDepartmentAdminRole(profile?.role);

  if (!isDesktop) {
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
          Desktop console
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
          The moderation console is available on desktop web. Use the normal app on this device.
        </Text>
        <TouchableOpacity
          style={{
            marginTop: 24,
            borderRadius: 9999,
            backgroundColor: colors.brandSolid,
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}
          onPress={() => {
            setAdminAppPreview(true);
            router.replace("/(tabs)/");
          }}
        >
          <Text style={{ fontWeight: "700", color: colors.textOnBrandSolid }}>Go to App</Text>
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
        <ActivityIndicator accessibilityLabel="Loading" size="large" color={colors.primary} />
      </View>
    );
  }

  if (!moderatorUser) {
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
          Moderation access required
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
          This account does not have access to the moderation console.
        </Text>
        <TouchableOpacity
          style={{
            marginTop: 24,
            borderRadius: 9999,
            backgroundColor: colors.brandSolid,
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}
          onPress={() => {
            setAdminAppPreview(true);
            router.replace("/(tabs)/");
          }}
        >
          <Text style={{ fontWeight: "700", color: colors.textOnBrandSolid }}>Go to App</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const relative = pathname.replace(/^\/\(moderation\)/, "") || "/";
  const queueActive = relative === "/" || relative === "/index";

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
                    color: colors.sidebarActiveText,
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
                    color: colors.navAccent,
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  {departmentAdmin ? "Department moderator" : "Moderator"}
                </Text>
              </View>
            </View>

            <NavItem
              active={queueActive}
              colors={colors}
              label="Moderation queue"
              onPress={() => router.push("/(moderation)" as any)}
            />

            {departmentAdmin ? (
              <View
                style={{
                  marginTop: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.sidebarBorder,
                  backgroundColor: colors.sidebarItemHover,
                  padding: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    color: colors.sidebarItemText,
                  }}
                >
                  Department
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    fontWeight: "700",
                    color: colors.sidebarActiveText,
                  }}
                  numberOfLines={2}
                >
                  {profile.department_name || "Not assigned"}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: colors.sidebarBorder, paddingTop: 16 }}>
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
                  backgroundColor: colors.sidebarActiveBg,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 10,
                  borderWidth: 1,
                  borderColor: colors.sidebarBorder,
                }}
              >
                <Text style={{ fontWeight: "700", fontSize: 13, color: colors.sidebarActiveText }}>
                  {(profile.full_name?.[0] || profile.username?.[0] || "M").toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 13, fontWeight: "700", color: colors.sidebarActiveText }}
                  numberOfLines={1}
                >
                  {profile.full_name || profile.username || "Moderator"}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.sidebarItemText,
                    textTransform: "capitalize",
                  }}
                  numberOfLines={1}
                >
                  {profile.role?.replace("_", " ") || "Moderator"}
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
                backgroundColor: colors.sidebarItemHover,
              }}
            >
              {isDark ? (
                <Moon size={16} color={colors.navAccent} />
              ) : (
                <Sun size={16} color={colors.navAccent} />
              )}
              <Text
                style={{
                  marginLeft: 10,
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.sidebarItemText,
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
              <ExternalLink size={16} color={colors.sidebarItemText} />
              <Text
                style={{
                  marginLeft: 10,
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.sidebarItemText,
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
              <LogOut size={16} color={colors.dangerOnDark} />
              <Text
                style={{
                  marginLeft: 10,
                  fontSize: 12,
                  fontWeight: "600",
                  color: colors.dangerOnDark,
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
