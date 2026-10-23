import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowRight } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { badgeTone, type BadgeTone } from "./StatusBadge";
import { focusRing, RADIUS, SPACE, TYPE } from "../../lib/tokens";

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
 * Icon composition instead of a lonely grey glyph. The stacked tiles give the
 * empty state a little personality without shipping illustration assets.
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
  const size = compact ? 78 : 104;
  const [actionFocused, setActionFocused] = useState(false);

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: compact ? SPACE.x6 : SPACE.x10,
        paddingHorizontal: SPACE.x6,
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: SPACE.x5,
        }}
      >
        <View
          style={{
            position: "absolute",
            width: size * 0.74,
            height: size * 0.74,
            borderRadius: 24,
            backgroundColor: palette.bg,
            transform: [{ rotate: "-9deg" }],
          }}
        />
        <View
          style={{
            position: "absolute",
            width: size * 0.56,
            height: size * 0.56,
            borderRadius: 20,
            backgroundColor: colors.panelRaised,
            borderWidth: 1,
            borderColor: colors.line,
            transform: [{ rotate: "8deg" }],
          }}
        />
        <View
          style={{
            width: size * 0.58,
            height: size * 0.58,
            borderRadius: 19,
            backgroundColor: colors.panel,
            borderWidth: 1,
            borderColor: colors.lineStrong,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={compact ? 24 : 30} color={palette.fg} strokeWidth={1.9} />
        </View>
        <View
          style={{
            position: "absolute",
            top: size * 0.08,
            right: size * 0.04,
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: colors.accentBright,
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: size * 0.12,
            left: size * 0.02,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.brandBright,
          }}
        />
      </View>

      <Text
        style={{
          ...TYPE.h2,
          fontSize: compact ? 17 : 20,
          color: colors.ink,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {body ? (
        <Text
          style={{
            ...TYPE.body,
            color: colors.inkSoft,
            textAlign: "center",
            maxWidth: 360,
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
              minHeight: 40,
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.x2,
              borderRadius: RADIUS.pill,
              backgroundColor: colors.brandSolid,
              paddingHorizontal: SPACE.x5,
              paddingVertical: SPACE.x2,
              opacity: pressed ? 0.88 : 1,
            },
            focusRing(colors, actionFocused),
          ]}
        >
          <Text style={{ ...TYPE.bodyStrong, color: colors.textOnPrimary }}>
            {actionLabel}
          </Text>
          <ArrowRight size={15} color={colors.textOnPrimary} />
        </Pressable>
      ) : null}
    </View>
  );
}
