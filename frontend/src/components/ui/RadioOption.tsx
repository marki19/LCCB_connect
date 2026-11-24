import { useState } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { focusRing, RADIUS, SPACE, TYPE } from "../../lib/tokens";

type RadioOptionProps = {
  label: string;
  /** Optional second line explaining what the choice does. */
  description?: string;
  selected: boolean;
  onPress: () => void;
};

/** Soft, layout-free transition used on web; harmless on native. */
const transitionStyle = {
  transitionProperty: "background-color, border-color, box-shadow",
  transitionDuration: "180ms",
  transitionTimingFunction: "ease",
} as unknown as ViewStyle;

/**
 * One row of a single-choice list. The whole row is the hit target, not just
 * the dot, so it stays comfortable on touch and easy to scan on desktop.
 */
export default function RadioOption({ label, description, selected, onPress }: RadioOptionProps) {
  const { colors } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const background = selected
    ? colors.primarySurface
    : hovered
      ? colors.hoverOverlay
      : "transparent";

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={description}
      // Pass both forms: this RN Web version does not derive aria-checked from
      // accessibilityState.checked, and screen readers need the ARIA attribute.
      aria-checked={selected}
      accessibilityState={{ checked: selected, disabled: false, selected }}
      onPress={onPress}
      // RN Web maps Enter to onPress for role="radio" but not Space. Handle
      // Space explicitly so the control follows the WAI-ARIA radio pattern.
      onKeyDown={(event: any) => {
        if (event.key === " " || event.key === "Spacebar") {
          event.preventDefault?.();
          event.stopPropagation?.();
          onPress();
        }
      }}
      // Extend the touch target slightly beyond the visible row so a near-miss
      // on mobile still selects the option. It never overlaps a sibling row.
      hitSlop={{ top: 2, bottom: 2, left: 0, right: 0 }}
      focusable
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.x3,
          minHeight: 44,
          marginTop: SPACE.x1,
          paddingHorizontal: SPACE.x3,
          paddingVertical: SPACE.x2,
          borderRadius: RADIUS.md,
          backgroundColor: background,
          opacity: pressed ? 0.8 : 1,
          cursor: "pointer",
        } as ViewStyle,
        transitionStyle,
        focusRing(colors, focused),
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ ...TYPE.bodyStrong, fontWeight: selected ? "700" : "600", color: colors.ink }}
        >
          {label}
        </Text>
        {description ? (
          <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 2 }}>
            {description}
          </Text>
        ) : null}
      </View>

      <View
        pointerEvents="none"
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: selected ? colors.primary : colors.borderStrong,
          alignItems: "center",
          justifyContent: "center",
          ...transitionStyle,
        }}
      >
        {selected ? (
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
        ) : null}
      </View>
    </Pressable>
  );
}
