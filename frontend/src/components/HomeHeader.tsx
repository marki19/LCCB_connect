import React from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Search, MessageSquare, UserPlus, Megaphone } from "lucide-react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { canAccessAdminPanel } from "../lib/roles";
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
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed, hovered }: any) => ({
        width: 44,
        height: 44,
        borderRadius: RADIUS.md,
        backgroundColor: hovered ? colors.hoverOverlay : backgroundColor,
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        opacity: pressed ? 0.72 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
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
            backgroundColor: colors.destructiveSurface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.destructiveText, fontSize: 9, fontWeight: "800" }}>
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
  const { colors } = useTheme();
  const { profile } = useAuth();
  const isDesktopWeb = Platform.OS === "web" && width >= 768;
  const compact = width < 380;
  const canOpenAdminPanel = canAccessAdminPanel(profile?.role);

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
      {/* Left: clickable logo & wordmark to open drawer */}
      <Pressable
        onPress={onMenuPress}
        accessibilityRole="button"
        accessibilityLabel="Open sidebar menu"
        style={({ pressed }: any) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.x2,
          minWidth: 0,
          flexShrink: 1,
          cursor: "pointer",
          opacity: pressed ? 0.75 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
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
            style={{ width: 28, height: 28 }}
            resizeMode="contain"
          />
        </View>
        <View style={{ minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              ...TYPE.title,
              fontSize: compact ? 15 : 17,
              color: colors.ink,
              letterSpacing: -0.5,
              fontWeight: "700",
            }}
          >
            LCCB <Text style={{ color: colors.brand }}>Connect</Text>
          </Text>
          <Text
            numberOfLines={1}
            style={{ ...TYPE.micro, fontSize: 8, color: colors.inkFaint, marginTop: 1 }}
          >
            Campus network
          </Text>
        </View>
      </Pressable>

      {/* Right: search, find friends, messages */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x1 }}>
        <IconButton
          onPress={() => router.push("/(tabs)/search")}
          label="Search the repository"
          icon={Search}
          iconColor={colors.inkSoft}
          backgroundColor={colors.panelInset}
        />
        <IconButton
          onPress={() => router.push("/find-friends")}
          label="Find friends"
          icon={UserPlus}
          iconColor={colors.inkSoft}
          backgroundColor={colors.panelInset}
        />
        {canOpenAdminPanel ? (
          <IconButton
            onPress={() => router.push("/(admin)" as any)}
            label="Open admin console"
            icon={Megaphone}
            iconColor={colors.brand}
            backgroundColor={colors.brandWash}
          />
        ) : null}
        <IconButton
          onPress={() => router.push("/(tabs)/messages")}
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
