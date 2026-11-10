import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import {
  elevation,
  focusRing,
  RADIUS,
  SPACE,
  TYPE,
  type ThemeTokens,
} from "../../lib/tokens";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: any;
  iconRight?: any;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 48 };

function palette(variant: ButtonVariant, colors: ThemeTokens) {
  switch (variant) {
    case "secondary":
      return {
        bg: colors.surface,
        bgHover: colors.surfaceSunken,
        border: colors.borderStrong,
        text: colors.textPrimary,
        icon: colors.textSecondary,
      };
    case "ghost":
      return {
        bg: "transparent",
        bgHover: colors.surfaceSunken,
        border: "transparent",
        text: colors.textSecondary,
        icon: colors.textSecondary,
      };
    case "danger":
      return {
        bg: colors.destructive,
        bgHover: colors.destructiveHover,
        border: colors.destructive,
        text: colors.textOnDanger,
        icon: colors.textOnDanger,
      };
    case "subtle":
      return {
        bg: colors.primarySurface,
        bgHover: colors.primarySurfaceAlt,
        border: "transparent",
        text: colors.primary,
        icon: colors.primary,
      };
    case "primary":
    default:
      return {
        bg: colors.primary,
        bgHover: colors.primaryHover,
        border: colors.primary,
        text: colors.textOnPrimary,
        icon: colors.textOnPrimary,
      };
  }
}

export default function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const p = palette(variant, colors);
  const inactive = disabled || loading;
  const height = HEIGHT[size];
  const iconSize = size === "sm" ? 15 : size === "lg" ? 18 : 16;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        {
          minHeight: height,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: SPACE.x2,
          borderRadius: RADIUS.md,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: p.border,
          backgroundColor: inactive
            ? colors.surfaceSunken
            : pressed
            ? p.bgHover
            : hovered
            ? p.bgHover
            : p.bg,
          paddingHorizontal: size === "sm" ? SPACE.x3 : SPACE.x4,
          opacity: inactive ? 0.7 : 1,
          ...(variant === "primary" || variant === "danger" ? elevation("sm", colors) : {}),
        },
        focusRing(colors, focused),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading" size="small" color={p.text} />
      ) : Icon ? (
        <Icon size={iconSize} color={inactive ? colors.textDisabled : p.icon} strokeWidth={2.2} />
      ) : null}
      <Text
        style={{
          ...(size === "sm" ? TYPE.caption : TYPE.bodyStrong),
          fontWeight: "600",
          color: inactive ? colors.textDisabled : p.text,
        }}
      >
        {label}
      </Text>
      {IconRight && !loading ? (
        <IconRight size={iconSize} color={inactive ? colors.textDisabled : p.icon} strokeWidth={2.2} />
      ) : null}
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  variant = "ghost",
  size = 40,
  badgeCount = 0,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  variant?: "ghost" | "secondary" | "subtle";
  size?: number;
  badgeCount?: number;
}) {
  const { colors } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const p = palette(variant === "ghost" ? "ghost" : variant === "subtle" ? "subtle" : "secondary", colors);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badgeCount > 0 ? `${label}, ${badgeCount} unread` : label}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          width: size,
          height: size,
          borderRadius: RADIUS.md,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: colors.border,
          backgroundColor: hovered ? p.bgHover : p.bg,
          alignItems: "center",
          justifyContent: "center",
        },
        focusRing(colors, focused),
      ]}
    >
      <Icon size={18} color={p.icon} strokeWidth={2.1} />
      {badgeCount > 0 ? (
        <View
          style={{
            position: "absolute",
            top: 3,
            right: 3,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            paddingHorizontal: 4,
            backgroundColor: colors.destructive,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.textOnDanger, fontSize: 9, fontWeight: "700" }}>
            {badgeCount > 99 ? "99+" : badgeCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
