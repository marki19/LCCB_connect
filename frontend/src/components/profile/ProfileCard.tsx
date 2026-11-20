import React from "react";
import { View, Text, Pressable, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";

interface ProfileCardProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function ProfileCard({
  title,
  actionLabel,
  onAction,
  children,
  style,
}: ProfileCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.panel,
          borderRadius: RADIUS.lg,
          borderWidth: 1,
          borderColor: colors.line,
          padding: SPACE.x4,
          marginBottom: SPACE.x4,
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: SPACE.x3,
        }}
      >
        <Text style={{ ...TYPE.bodyStrong, color: colors.ink, fontWeight: "800", fontSize: 18 }}>
          {title}
        </Text>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={({ pressed, hovered }: any) => [
              {
                cursor: "pointer",
                opacity: pressed ? 0.75 : hovered ? 0.85 : 1,
              },
            ]}
          >
            <Text style={{ ...TYPE.caption, color: colors.brand, fontWeight: "600" }}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}
