import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowDownRight, ArrowUpRight } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { formatCount, useCountUp } from "../../hooks/useCountUp";
import { focusRing, RADIUS, SPACE, type ThemeTokens } from "../../lib/tokens";
import { CONSOLE_TEXT, consoleCard } from "./consoleTheme";

export type KpiTone = "brand" | "accent" | "jade" | "coral";

type KpiCardProps = {
  label: string;
  value: number;
  detail?: string;
  icon: any;
  tone?: KpiTone;
  delta?: { value: number; label: string };
  children?: ReactNode;
  footer?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
};

function tonePalette(tone: KpiTone, colors: ThemeTokens) {
  switch (tone) {
    case "accent":
      return { wash: colors.accentWash, solid: colors.accent, text: colors.accentText };
    case "jade":
      return { wash: colors.jadeWash, solid: colors.jade, text: colors.jadeText };
    case "coral":
      return { wash: colors.coralWash, solid: colors.coral, text: colors.coralText };
    case "brand":
    default:
      return { wash: colors.brandWash, solid: colors.brand, text: colors.brand };
  }
}

/**
 * One number that matters, with a plain-language caption underneath. Tiles are
 * flat and equally weighted so a row of them reads as a summary, not a
 * hierarchy puzzle.
 */
export default function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "brand",
  delta,
  children,
  footer,
  onPress,
  accessibilityLabel,
}: KpiCardProps) {
  const { colors } = useTheme();
  const palette = tonePalette(tone, colors);
  const displayed = useCountUp(value);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={
        accessibilityLabel ?? `${label}: ${formatCount(value)}${detail ? `. ${detail}` : ""}`
      }
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          ...consoleCard(colors),
          flex: 1,
          minWidth: 216,
          minHeight: 148,
          padding: SPACE.x5,
          borderColor: hovered ? colors.lineStrong : colors.line,
          backgroundColor: hovered ? colors.panelRaised : colors.panel,
        },
        focusRing(colors, focused),
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x3 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: RADIUS.sm,
            backgroundColor: palette.wash,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={16} color={palette.solid} strokeWidth={2} />
        </View>
        <Text
          numberOfLines={1}
          style={{ ...CONSOLE_TEXT.strong, fontSize: 13, color: colors.inkSoft, flexShrink: 1 }}
        >
          {label}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: SPACE.x2,
          marginTop: SPACE.x4,
          flexWrap: "wrap",
        }}
      >
        <Text style={{ ...CONSOLE_TEXT.metric, color: colors.ink }}>
          {formatCount(displayed)}
        </Text>
        {delta ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              marginBottom: 5,
              borderRadius: RADIUS.sm,
              backgroundColor: delta.value >= 0 ? colors.jadeWash : colors.coralWash,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            {delta.value >= 0 ? (
              <ArrowUpRight size={11} color={colors.jadeText} strokeWidth={2.6} />
            ) : (
              <ArrowDownRight size={11} color={colors.coralText} strokeWidth={2.6} />
            )}
            <Text
              style={{
                ...CONSOLE_TEXT.caption,
                fontSize: 11,
                fontWeight: "700",
                color: delta.value >= 0 ? colors.jadeText : colors.coralText,
              }}
            >
              {delta.label}
            </Text>
          </View>
        ) : null}
      </View>

      {detail ? (
        <Text
          style={{
            ...CONSOLE_TEXT.caption,
            color: colors.inkSoft,
            marginTop: SPACE.x1,
          }}
        >
          {detail}
        </Text>
      ) : null}

      {children ? <View style={{ marginTop: SPACE.x4 }}>{children}</View> : null}
      {footer ? <View style={{ marginTop: SPACE.x3 }}>{footer}</View> : null}
    </Pressable>
  );
}
