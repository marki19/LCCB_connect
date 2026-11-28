import { Text, View } from "react-native";
import { ArrowRight } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";
import Button from "./Button";

type EmptyStateProps = {
  title: string;
  body?: string;
  icon: any;
  tone?: "brand" | "success" | "warning" | "danger" | "info" | "accent" | "neutral";
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
};

/**
 * App-level empty state using design system tokens.
 * A single tinted glyph, one sentence of context, and an optional next step.
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
  
  // Tone palette using theme tokens
  const getPalette = (tone: string) => {
    switch (tone) {
      case "brand":
        return { bg: colors.brandWash, fg: colors.brand };
      case "success":
        return { bg: colors.jadeWash, fg: colors.jade };
      case "warning":
        return { bg: colors.accentWash, fg: colors.accent };
      case "danger":
        return { bg: colors.coralWash, fg: colors.coral };
      case "info":
        return { bg: colors.infoSurface, fg: colors.info };
      case "accent":
        return { bg: colors.accentWash, fg: colors.accent };
      case "neutral":
      default:
        return { bg: colors.surfaceSunken, fg: colors.textSecondary };
    }
  };

  const palette = getPalette(tone);
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
          ...TYPE.bodyStrong,
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
            ...TYPE.caption,
            color: colors.inkSoft,
            textAlign: "center",
            maxWidth: 340,
            marginTop: SPACE.x2,
            lineHeight: 20,
          }}
        >
          {body}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          variant="primary"
          size="sm"
          label={actionLabel}
          iconRight={ArrowRight}
          onPress={onAction}
          style={{ marginTop: SPACE.x5 }}
        />
      ) : null}
    </View>
  );
}