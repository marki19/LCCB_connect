import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Avatar from "../Avatar";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";
import type { PresenceMode } from "../../types";

type FriendPersonCardProps = {
  name: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
  mode?: PresenceMode | null;
  showPresence?: boolean;
  onPress: () => void;
  /** Primary/secondary controls rendered along the bottom of the card. */
  actions: ReactNode;
};

/**
 * Grid card used on desktop. Layout is deliberately compact (220px) so three
 * cards fit the app's centre column without a second sidebar.
 */
export default function FriendPersonCard({
  name,
  subtitle,
  avatarUrl,
  mode = null,
  showPresence = false,
  onPress,
  actions,
}: FriendPersonCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        width: 220,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View ${name}'s profile`}
        style={({ pressed, hovered }: any) => [
          {
            alignItems: "center",
            paddingTop: SPACE.x5,
            paddingBottom: SPACE.x3,
            backgroundColor: pressed || hovered ? colors.surfaceSunken : "transparent",
            cursor: "pointer",
          },
        ]}
      >
        <Avatar name={name} avatarUrl={avatarUrl} size={72} mode={mode} showPresence={showPresence} />
        <Text
          numberOfLines={1}
          style={{
            marginTop: SPACE.x3,
            paddingHorizontal: SPACE.x3,
            fontSize: 16,
            lineHeight: 22,
            fontWeight: "700",
            color: colors.textPrimary,
            textAlign: "center",
          }}
        >
          {name}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            marginTop: 2,
            paddingHorizontal: SPACE.x3,
            fontSize: 12,
            lineHeight: 16,
            color: colors.textTertiary,
            textAlign: "center",
          }}
        >
          {subtitle || "LCCB Student"}
        </Text>
      </Pressable>

      <View
        style={{
          flexDirection: "row",
          gap: SPACE.x2,
          paddingHorizontal: SPACE.x3,
          paddingBottom: SPACE.x3,
        }}
      >
        {actions}
      </View>
    </View>
  );
}
