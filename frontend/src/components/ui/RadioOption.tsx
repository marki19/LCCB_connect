import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { focusRing, RADIUS, SPACE, TYPE } from "../../lib/tokens";

type RadioOptionProps = {
  label: string;
  /** Optional second line explaining what the choice does. */
  description?: string;
  selected: boolean;
  onPress: () => void;
};

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
      aria-checked={selected}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
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
        },
        focusRing(colors, focused),
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...TYPE.bodyStrong, fontWeight: selected ? "700" : "600", color: colors.ink }}>
          {label}
        </Text>
        {description ? (
          <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 2 }}>
            {description}
          </Text>
        ) : null}
      </View>

      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: selected ? colors.primary : colors.borderStrong,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? (
          <View
            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}
