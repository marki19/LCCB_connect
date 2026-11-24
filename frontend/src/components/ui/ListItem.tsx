import React, { useState, type ReactNode } from "react";
import { Pressable, View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { focusRing, RADIUS, SPACE, TYPE } from "../../lib/tokens";

export type ListItemProps = {
  /** Leading element (avatar, icon, etc.) */
  leading?: ReactNode;
  /** Main title text */
  title: string;
  /** Subtitle/description text */
  subtitle?: string;
  /** Trailing element (time, badge, chevron, etc.) */
  trailing?: ReactNode;
  /** Unread indicator */
  unread?: boolean;
  /** Press handler */
  onPress?: () => void;
  /** Long press handler */
  onLongPress?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Selected state (for active items in split views) */
  selected?: boolean;
  /** Additional style */
  style?: StyleProp<ViewStyle>;
  /** Content style (for the inner content area) */
  contentStyle?: StyleProp<ViewStyle>;
  /** Accessibility label */
  accessibilityLabel?: string;
  /** Show bottom divider */
  divider?: boolean;
  /** Divider inset */
  dividerInset?: number;
};

export default function ListItem({
  leading,
  title,
  subtitle,
  trailing,
  unread = false,
  onPress,
  onLongPress,
  disabled = false,
  selected = false,
  style,
  contentStyle,
  accessibilityLabel,
  divider = false,
  dividerInset = 0,
}: ListItemProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handlePress = () => {
    if (!disabled && onPress) onPress();
  };

  const handleLongPress = () => {
    if (!disabled && onLongPress) onLongPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      disabled={disabled}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      delayLongPress={350}
      style={({ pressed }: any) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.x3,
          paddingHorizontal: SPACE.x4,
          paddingVertical: SPACE.x3,
          borderRadius: RADIUS.md,
          backgroundColor: selected
            ? colors.primarySurface
            : pressed || hovered
            ? colors.hoverOverlay
            : "transparent",
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
          opacity: disabled ? 0.6 : 1,
        },
        focusRing(colors, focused),
        style,
      ]}
    >
      {leading}
      <View style={[{ flex: 1, minWidth: 0, gap: 2 }, contentStyle]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2, flexWrap: "wrap" }}>
          <Text
            numberOfLines={1}
            style={[
              TYPE.bodyStrong,
              {
                fontWeight: unread ? "800" : selected ? "700" : "600",
                color: disabled ? colors.textDisabled : unread ? colors.ink : colors.ink,
              },
            ]}
          >
            {title}
          </Text>
          {unread && (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.brand,
              }}
            />
          )}
        </View>
        {subtitle && (
          <Text
            numberOfLines={2}
            style={[
              TYPE.caption,
              {
                color: disabled ? colors.textDisabled : colors.inkSoft,
                lineHeight: 18,
              },
            ]}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
      {divider && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: dividerInset,
            right: dividerInset,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.divider,
          }}
        />
      )}
    </Pressable>
  );
}