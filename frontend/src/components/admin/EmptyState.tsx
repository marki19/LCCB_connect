import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowRight } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { badgeTone, type BadgeTone } from "./StatusBadge";
import { focusRing, RADIUS, SPACE } from "../../lib/tokens";
import { CONSOLE_TEXT } from "./consoleTheme";

type EmptyStateProps = {
  title: string;
  body?: string;
  icon: any;
  tone?: BadgeTone;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
};

/**
 * Quiet empty state: a single tinted glyph, one sentence of context, and an
 * optional next step. No decorative clutter, so it reads as "nothing to do
 * here" rather than a missing feature.
 */
export default function EmptyState({
  title,
  body,
  icon: Icon,
  tone = "brand",
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const palette = badgeTone(tone, colors);
  const [actionFocused, setActionFocused] = useState(false);
  const glyph = compact ? 46 : 56;

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: compact ? SPACE.x6 : SPACE.x10,
        paddingHorizontal: SPACE.x5,
      }}
    >
      <View
        style={{
          width: glyph,
          height: glyph,
          borderRadius: glyph / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.bg,
        }}
      >
        <Icon size={compact ? 20 : 24} color={palette.fg} strokeWidth={1.9} />
      </View>

      <Text
        style={{
          ...CONSOLE_TEXT.sectionTitle,
          fontSize: compact ? 15 : 17,
          color: colors.ink,
          textAlign: "center",
          marginTop: SPACE.x4,
        }}
      >
        {title}
      </Text>
      {body ? (
        <Text
          style={{
            ...CONSOLE_TEXT.caption,
            color: colors.inkSoft,
            textAlign: "center",
            maxWidth: 340,
            marginTop: SPACE.x2,
          }}
        >
          {body}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          onFocus={() => setActionFocused(true)}
          onBlur={() => setActionFocused(false)}
          style={({ pressed }) => [
            {
              marginTop: SPACE.x5,
              minHeight: 38,
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.x2,
              borderRadius: RADIUS.sm,
              backgroundColor: colors.brandSolid,
              paddingHorizontal: SPACE.x4,
              paddingVertical: SPACE.x2,
              opacity: pressed ? 0.88 : 1,
            },
            focusRing(colors, actionFocused),
          ]}
        >
          <Text
            style={{ ...CONSOLE_TEXT.strong, fontSize: 13, color: colors.textOnBrandSolid }}
          >
            {actionLabel}
          </Text>
          <ArrowRight size={14} color={colors.textOnBrandSolid} />
        </Pressable>
      ) : null}
    </View>
  );
}
