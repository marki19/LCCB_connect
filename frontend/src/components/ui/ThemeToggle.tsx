import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Monitor, Moon, Sun } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { focusRing, RADIUS, SPACE } from "../../lib/tokens";

type ThemeToggleProps = {
  /** Compact shows only the icon (mobile headers). */
  compact?: boolean;
};

/**
 * Cycles system → light → dark. One control for the whole app so every screen
 * behaves identically.
 */
export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { colors, preference, cycleTheme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const label = preference === "system" ? "System" : preference === "light" ? "Light" : "Dark";
  const next = preference === "light" ? "dark" : preference === "dark" ? "system" : "light";
  const nextLabel = next.charAt(0).toUpperCase() + next.slice(1);
  const Icon = preference === "system" ? Monitor : preference === "light" ? Sun : Moon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Theme: ${label}. Switch to ${nextLabel}.`}
      accessibilityHint="Cycles between system, light, and dark themes"
      onPress={() => void cycleTheme()}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        {
          minWidth: 40,
          minHeight: 40,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: compact ? SPACE.x2 : SPACE.x3,
          borderRadius: RADIUS.pill,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: hovered ? colors.surfaceSunken : colors.surface,
          opacity: pressed ? 0.75 : 1,
        },
        focusRing(colors, focused),
      ]}
    >
      <Icon size={16} color={colors.primary} strokeWidth={2.2} />
      {!compact ? (
        <View style={{ marginLeft: SPACE.x2 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary }}>{label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
