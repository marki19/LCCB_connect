import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { SPACE } from "../../lib/tokens";

type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
};

export default function SectionHeader({ title, description, action, eyebrow }: SectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: SPACE.x4,
        flexWrap: "wrap",
        marginBottom: SPACE.x4,
      }}
    >
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 220 }}>
        {eyebrow ? (
          <Text
            style={{
              fontSize: 11,
              lineHeight: 15,
              fontWeight: "600",
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: colors.textTertiary,
              marginBottom: SPACE.x1,
            }}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text style={{ fontSize: 20, lineHeight: 28, fontWeight: "600", letterSpacing: -0.3, color: colors.textPrimary }}>
          {title}
        </Text>
        {description ? (
          <Text style={{ fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginTop: SPACE.x1, maxWidth: 680 }}>
            {description}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}
