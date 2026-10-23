import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowDownRight, ArrowUpRight } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { formatCount, useCountUp } from "../../hooks/useCountUp";
import {
  elevation,
  focusRing,
  RADIUS,
  SPACE,
  TYPE,
  type ThemeTokens,
} from "../../lib/tokens";

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
 * Supporting metric tile. The hero KPI lives in the overview itself; these are
 * deliberately lighter so the page has one clear focal point.
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
          flex: 1,
          minWidth: 220,
          minHeight: 156,
          backgroundColor: colors.panel,
          borderRadius: RADIUS.xxl,
          borderWidth: 1,
          borderColor: hovered ? colors.lineStrong : colors.line,
          padding: SPACE.x5,
          overflow: "hidden",
          transform: [{ translateY: hovered && onPress ? -1 : 0 }],
          ...elevation("sm", colors),
        },
        focusRing(colors, focused),
      ]}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          left: SPACE.x5,
          right: SPACE.x5,
          height: 3,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
          backgroundColor: palette.solid,
        }}
      />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...TYPE.micro, color: colors.inkFaint, flexShrink: 1 }}>{label}</Text>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: RADIUS.md,
            backgroundColor: palette.wash,
            alignItems: "center",
            justifyContent: "center",
            marginLeft: SPACE.x2,
          }}
        >
          <Icon size={17} color={palette.solid} strokeWidth={2.1} />
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: SPACE.x2,
          marginTop: SPACE.x3,
          flexWrap: "wrap",
        }}
      >
        <Text style={{ ...TYPE.kpi, color: colors.ink }}>{formatCount(displayed)}</Text>
        {delta ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              marginBottom: 6,
              borderRadius: RADIUS.pill,
              backgroundColor: delta.value >= 0 ? colors.jadeWash : colors.coralWash,
              paddingHorizontal: SPACE.x2,
              paddingVertical: 3,
            }}
          >
            {delta.value >= 0 ? (
              <ArrowUpRight size={11} color={colors.jadeText} strokeWidth={2.6} />
            ) : (
              <ArrowDownRight size={11} color={colors.coralText} strokeWidth={2.6} />
            )}
            <Text
              style={{
                ...TYPE.caption,
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
        <Text style={{ ...TYPE.caption, color: colors.inkSoft, marginTop: SPACE.x1 }}>
          {detail}
        </Text>
      ) : null}

      {children ? <View style={{ marginTop: SPACE.x4 }}>{children}</View> : null}
      {footer ? <View style={{ marginTop: SPACE.x3 }}>{footer}</View> : null}
    </Pressable>
  );
}
