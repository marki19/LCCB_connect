import {
  View,
  Text,
  Pressable,
  Image,
  Platform,
  useWindowDimensions,
} from "react-native";
import { AlignJustify, Search, MessageSquare, Sun, Moon } from "lucide-react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { elevation, RADIUS, SPACE, TYPE } from "../lib/tokens";

type Props = {
  onMenuPress: () => void;
  unreadCount?: number;
};

function IconButton({
  onPress,
  label,
  icon: Icon,
  iconColor,
  backgroundColor,
  badgeCount = 0,
}: {
  onPress: () => void;
  label: string;
  icon: any;
  iconColor: string;
  backgroundColor: string;
  badgeCount?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: RADIUS.md,
        backgroundColor,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Icon size={19} color={iconColor} strokeWidth={2.1} />
      {badgeCount > 0 ? (
        <View
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            minWidth: 17,
            height: 17,
            borderRadius: 9,
            paddingHorizontal: 4,
            backgroundColor: "#DC2626",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "800" }}>
            {badgeCount > 99 ? "99+" : badgeCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function HomeHeader({ onMenuPress, unreadCount = 0 }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDark, toggleTheme } = useTheme();
  const isDesktopWeb = Platform.OS === "web" && width >= 768;
  const compact = width < 380;

  // On desktop web, the top navigation bar is already rendered by _layout.tsx
  if (isDesktopWeb) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        paddingTop: insets.top + 6,
        paddingBottom: SPACE.x2,
        paddingHorizontal: SPACE.x3,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
        ...elevation("sm", colors),
      }}
    >
      {/* Left: menu + seal + wordmark */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2, flexShrink: 1 }}>
        <IconButton
          onPress={onMenuPress}
          label="Open navigation menu"
          icon={AlignJustify}
          iconColor={colors.brand}
          backgroundColor={colors.brandWash}
        />

        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2, minWidth: 0 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: RADIUS.md,
              backgroundColor: colors.panelInset,
              borderWidth: 1,
              borderColor: colors.line,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              source={require("../../assets/images/logo-seal.png")}
              style={{ width: 26, height: 26 }}
              resizeMode="contain"
            />
          </View>
          <View style={{ minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                ...TYPE.title,
                fontSize: compact ? 14 : 16,
                color: colors.ink,
                letterSpacing: -0.5,
              }}
            >
              LCCB <Text style={{ color: colors.brand }}>Connect</Text>
            </Text>
            <Text
              numberOfLines={1}
              style={{ ...TYPE.micro, fontSize: 7.5, color: colors.inkFaint, marginTop: 1 }}
            >
              Campus network
            </Text>
          </View>
        </View>
      </View>

      {/* Right: theme, search, messages */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x1 }}>
        <IconButton
          onPress={() => void toggleTheme()}
          label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          icon={isDark ? Sun : Moon}
          iconColor={colors.inkSoft}
          backgroundColor={colors.panelInset}
        />
        <IconButton
          onPress={() => router.push("/(tabs)/search")}
          label="Search the repository"
          icon={Search}
          iconColor={colors.inkSoft}
          backgroundColor={colors.panelInset}
        />
        <IconButton
          onPress={() => router.push("/messages")}
          label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : "Open messages"}
          icon={MessageSquare}
          iconColor={colors.brand}
          backgroundColor={colors.brandWash}
          badgeCount={unreadCount}
        />
      </View>
    </View>
  );
}
