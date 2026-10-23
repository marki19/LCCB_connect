import { Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE, TYPE, type ThemeTokens } from "../../lib/tokens";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

type StatusBadgeProps = {
  label: string;
  tone?: BadgeTone;
  icon?: any;
  size?: "sm" | "md";
};

export function badgeTone(tone: BadgeTone, colors: ThemeTokens) {
  switch (tone) {
    case "brand":
      return { bg: colors.brandWash, fg: colors.brand, dot: colors.brandBright };
    case "success":
      return { bg: colors.jadeWash, fg: colors.jadeText, dot: colors.jade };
    case "warning":
      return { bg: colors.accentWash, fg: colors.accentText, dot: colors.accent };
    case "danger":
      return { bg: colors.coralWash, fg: colors.coralText, dot: colors.coral };
    case "info":
      return { bg: colors.infoSurface, fg: colors.infoText, dot: colors.info };
    case "accent":
      return { bg: colors.accentWash, fg: colors.accentText, dot: colors.accentBright };
    case "neutral":
    default:
      return { bg: colors.surfaceSunken, fg: colors.textSecondary, dot: colors.textTertiary };
  }
}

/**
 * Status is always words + a color, never color alone. Icons are optional;
 * without one, a small semantic dot is rendered so the chip still reads as a
 * status marker rather than a tag.
 */
export default function StatusBadge({
  label,
  tone = "neutral",
  icon: Icon,
  size = "sm",
}: StatusBadgeProps) {
  const { colors } = useTheme();
  const palette = badgeTone(tone, colors);
  const small = size === "sm";

  return (
    <View
      accessibilityLabel={label}
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.x2,
        borderRadius: RADIUS.pill,
        backgroundColor: palette.bg,
        paddingHorizontal: small ? SPACE.x2 : SPACE.x3,
        paddingVertical: small ? 3 : 5,
      }}
    >
      {Icon ? (
        <Icon size={small ? 11 : 13} color={palette.fg} strokeWidth={2.4} />
      ) : (
        <View
          style={{
            width: small ? 5 : 6,
            height: small ? 5 : 6,
            borderRadius: 999,
            backgroundColor: palette.dot,
          }}
        />
      )}
      <Text
        style={{
          ...(small ? TYPE.caption : TYPE.bodyStrong),
          fontSize: small ? 11 : 12,
          lineHeight: small ? 14 : 16,
          fontWeight: "700",
          color: palette.fg,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
