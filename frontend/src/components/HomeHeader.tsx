import { View, Text, TouchableOpacity, Platform, useWindowDimensions } from "react-native";
import { AlignJustify, Search, MessageSquare, Sun, Moon } from "lucide-react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";

type Props = {
  onMenuPress: () => void;
  unreadCount?: number;
};

export default function HomeHeader({ onMenuPress, unreadCount = 0 }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDark, toggleTheme } = useTheme();
  const isDesktopWeb = Platform.OS === "web" && width >= 768;

  // On desktop web, the top navigation bar is already rendered by _layout.tsx
  if (isDesktopWeb) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.05,
        shadowRadius: 6,
        elevation: 4,
      }}
    >
      {/* Left: Hamburger button (predictable: button on left -> sidebar opens from left) */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TouchableOpacity
          onPress={onMenuPress}
          activeOpacity={0.7}
          accessibilityLabel="Open navigation menu"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: colors.actionSurface,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <AlignJustify size={20} color={colors.action} strokeWidth={2.2} />
        </TouchableOpacity>

        {/* Wordmark Logo */}
        <View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.4 }}>
            LCCB <Text style={{ color: colors.action }}>Connect</Text>
          </Text>
          <Text style={{ fontSize: 10, color: colors.textTertiary, fontWeight: "600" }}>
            Academic Network
          </Text>
        </View>
      </View>

      {/* Right: Search, Theme Toggle & Messages actions */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <TouchableOpacity
          onPress={() => void toggleTheme()}
          activeOpacity={0.7}
          accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: colors.surfaceSunken,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isDark ? (
            <Sun size={18} color={colors.action} strokeWidth={2} />
          ) : (
            <Moon size={18} color={colors.textSecondary} strokeWidth={2} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/search")}
          activeOpacity={0.7}
          accessibilityLabel="Search"
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: colors.surfaceSunken,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Search size={18} color={colors.textTertiary} strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/messages")}
          activeOpacity={0.7}
          accessibilityLabel={unreadCount > 0 ? `Messages, ${unreadCount} unread` : "Messages"}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: colors.actionSurface,
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <MessageSquare size={18} color={colors.action} strokeWidth={2} />
          {unreadCount > 0 && (
            <View style={{ position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "800" }}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
