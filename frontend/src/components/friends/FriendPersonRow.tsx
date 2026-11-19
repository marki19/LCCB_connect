import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Avatar from "../Avatar";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";
import type { PresenceMode } from "../../types";

type FriendPersonRowProps = {
  name: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
  mode?: PresenceMode | null;
  showPresence?: boolean;
  onPress: () => void;
  /** Icon-only or compact controls rendered at the end of the row. */
  actions: ReactNode;
};

/** Single-line person row used below the tablet breakpoint. */
export default function FriendPersonRow({
  name,
  subtitle,
  avatarUrl,
  mode = null,
  showPresence = false,
  onPress,
  actions,
}: FriendPersonRowProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.x3,
        padding: SPACE.x3,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View ${name}'s profile`}
        style={{ cursor: "pointer" }}
      >
        <Avatar name={name} avatarUrl={avatarUrl} size={48} mode={mode} showPresence={showPresence} />
      </Pressable>

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View ${name}'s profile`}
        style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
      >
        <Text
          numberOfLines={1}
          style={{ fontSize: 15, lineHeight: 20, fontWeight: "700", color: colors.textPrimary }}
        >
          {name}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: 12, lineHeight: 16, marginTop: 2, color: colors.textTertiary }}
        >
          {subtitle || "LCCB Student"}
        </Text>
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2 }}>{actions}</View>
    </View>
  );
}
