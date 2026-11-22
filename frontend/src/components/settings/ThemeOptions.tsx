import { Text, View, Pressable } from "react-native";
import { Palette } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import {
  colorSchemeLabel,
  type ColorSchemePreference,
  type AccentColorPreference,
} from "../../lib/theme";
import { SPACE, TYPE } from "../../lib/tokens";
import RadioOption from "../ui/RadioOption";

/**
 * Presentation order: the two explicit choices first, the automatic one last —
 * "what will I get?" reads better before "let the device decide".
 */
const OPTION_ORDER: readonly ColorSchemePreference[] = ["light", "dark", "system"];

const OPTION_DESCRIPTION: Record<ColorSchemePreference, string> = {
  light: "Always use the light palette.",
  dark: "Always use the dark palette.",
  system: "Follow your device's appearance.",
};

/** Accent color labels in display order. */
const ACCENT_ORDER: readonly AccentColorPreference[] = [
  "blue",
  "indigo",
  "teal",
  "green",
  "olive",
  "yellow",
  "orange",
  "brown",
  "rose",
  "pink",
  "purple",
  "violet",
];

/**
 * Pick a checkmark color with enough contrast against `hex`.
 * Light accents need a dark dot; dark accents need a light dot.
 */
function contrastingDot(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length < 6) return "#FFFFFF";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  // Perceived luminance (sRGB approximation)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#0B1B33" : "#FFFFFF";
}

export default function ThemeOptions() {
  const {
    colors,
    preference,
    resolved,
    setColorScheme,
    accentPreference,
    setAccent,
    accentColor: resolvedAccentHex,
  } = useTheme();

  const descriptionFor = (value: ColorSchemePreference) =>
    value === "system"
      ? `${OPTION_DESCRIPTION.system} Currently ${resolved}.`
      : OPTION_DESCRIPTION[value];

  const isDark = resolved === "dark";

  // Resolve each swatch's hex from the active palette (light/dark aware).
  const accentPalette = colors.accentColor[isDark ? "dark" : "light"];
  const accentSwatches: Record<AccentColorPreference, string> = {} as Record<
    AccentColorPreference,
    string
  >;
  for (const label of ACCENT_ORDER) {
    accentSwatches[label] = accentPalette[label];
  }

  // Border style for the selected swatch uses the resolved hex, not the label.
  const selectedBorderStyle = accentPreference
    ? {
        borderWidth: 3,
        borderColor: resolvedAccentHex,
        // Push the ring outside so it doesn't inflate the swatch footprint.
        margin: -4,
      }
    : {};

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Theme"
      style={{ paddingHorizontal: SPACE.x2, paddingBottom: SPACE.x3 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: SPACE.x3,
          paddingHorizontal: SPACE.x2,
          paddingVertical: SPACE.x2,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySurface,
          }}
        >
          <Palette size={16} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...TYPE.bodyStrong, fontWeight: "700", color: colors.ink }}>
            Appearance
          </Text>
          <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 2 }}>
            Choose the palette LCCB Connect uses.
          </Text>
        </View>
      </View>

      {OPTION_ORDER.map((value) => (
        <RadioOption
          key={value}
          label={colorSchemeLabel(value)}
          description={descriptionFor(value)}
          selected={preference === value}
          onPress={() => void setColorScheme(value)}
        />
      ))}

      {/* Accent color grid */}
      <View
        style={{
          marginTop: SPACE.x4,
          paddingHorizontal: SPACE.x2,
        }}
      >
        <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginBottom: SPACE.x1 }}>
          Accent Color
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: SPACE.x2,
            marginTop: SPACE.x1,
          }}
        >
          {ACCENT_ORDER.map((label) => {
            const hex = accentSwatches[label];
            const isSelected = accentPreference === label;
            return (
              <Pressable
                key={label}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: hex,
                  alignItems: "center",
                  justifyContent: "center",
                  ...selectedBorderStyle,
                }}
                onPress={() => setAccent(label)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Set ${label} accent color`}
              >
                {/* Checkmark for selected color — contrast-aware dot */}
                {isSelected && (
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: contrastingDot(hex),
                    }}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}