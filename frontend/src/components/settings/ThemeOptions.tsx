import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Palette, Pipette } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import {
  ACCENT_CHOICES,
  colorSchemeLabel,
  type ColorSchemePreference,
  type AccentColorPreference,
} from "../../lib/theme";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";
import RadioOption from "../ui/RadioOption";
import AccentColorPicker from "./AccentColorPicker";

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

/** Human-readable name for an accent swatch. */
function accentLabel(accent: AccentColorPreference): string {
  if (accent === "default") return "Default";
  if (accent === "custom") return "Color picker";
  return accent.charAt(0).toUpperCase() + accent.slice(1);
}

/** Pick a checkmark color with enough contrast against `hex`. */
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

/** Swatch footprint. The cell is larger than the dot so the selection ring
 *  has room and the grid keeps a consistent rhythm. */
const SWATCH_SIZE = 36;
const SWATCH_CELL = 44;

export default function ThemeOptions() {
  const {
    colors,
    preference,
    resolved,
    setColorScheme,
    accentPreference,
    setAccent,
    customAccentHex,
    accentColor: resolvedAccentHex,
  } = useTheme();

  const descriptionFor = (value: ColorSchemePreference) => OPTION_DESCRIPTION[value];

  const isDark = resolved === "dark";

  // Resolve each swatch's hex from the active palette (light/dark aware).
  const accentPalette = colors.accentColor[isDark ? "dark" : "light"];
  const swatchHex = (label: AccentColorPreference): string => {
    if (label === "custom") return customAccentHex || accentPalette.default;
    return accentPalette[label] || accentPalette.default;
  };

  // Hover state drives the floating name label above the swatch grid.
  const [hoveredAccent, setHoveredAccent] = useState<AccentColorPreference | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

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
            padding: SPACE.x2,
          }}
        >
          {ACCENT_CHOICES.map((label) => {
            const hex = swatchHex(label);
            const isSelected = accentPreference === label;
            const isHovered = hoveredAccent === label;
            const isPicker = label === "custom";

            return (
              <View
                key={label}
                style={{
                  width: SWATCH_CELL,
                  height: SWATCH_CELL,
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: isHovered ? 10 : undefined,
                }}
              >
                {/* Floating name label, shown on hover (web/desktop). */}
                {isHovered ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      bottom: "100%",
                      left: 0,
                      right: 0,
                      marginBottom: SPACE.x1,
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: colors.ink,
                        borderRadius: RADIUS.sm,
                        paddingHorizontal: SPACE.x2,
                        paddingVertical: SPACE.x1,
                      }}
                    >
                      <Text
                        style={{
                          ...TYPE.caption,
                          fontWeight: "700",
                          color: colors.surface,
                        }}
                      >
                        {accentLabel(label)}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Selection ring sits outside the dot so the dot itself never
                    changes size when the selection moves. */}
                {isSelected ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: 1,
                      left: 1,
                      width: SWATCH_SIZE + 6,
                      height: SWATCH_SIZE + 6,
                      borderRadius: RADIUS.md + 3,
                      borderWidth: 3,
                      borderColor: resolvedAccentHex,
                    }}
                  />
                ) : null}

                <Pressable
                  onPress={() => (isPicker ? setPickerVisible(true) : setAccent(label))}
                  onKeyDown={(event: any) => {
                    if (event.key === " " || event.key === "Spacebar") {
                      event.preventDefault?.();
                      event.stopPropagation?.();
                      if (isPicker) setPickerVisible(true);
                      else setAccent(label);
                    }
                  }}
                  onHoverIn={() => setHoveredAccent(label)}
                  onHoverOut={() => setHoveredAccent(null)}
                  accessibilityRole={isPicker ? "button" : "radio"}
                  aria-checked={isPicker ? undefined : isSelected}
                  aria-pressed={isPicker ? isSelected : undefined}
                  accessibilityState={{ selected: isSelected, disabled: false }}
                  accessibilityLabel={
                    isPicker ? "Open custom accent color picker" : `${accentLabel(label)} accent color`
                  }
                  accessibilityHint={
                    isSelected ? "Selected" : `Use ${accentLabel(label)} as the app accent`
                  }
                  hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
                  style={{
                    width: SWATCH_SIZE,
                    height: SWATCH_SIZE,
                    borderRadius: RADIUS.md,
                    backgroundColor: hex,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: isHovered ? 0.85 : 1,
                    cursor: "pointer",
                    // Layout-free transition keeps the grid stable on web.
                    transitionProperty: "background-color, opacity, border-color",
                    transitionDuration: "180ms",
                    transitionTimingFunction: "ease",
                  } as any}
                >
                  {isPicker ? (
                    <Pipette size={18} color={contrastingDot(hex)} strokeWidth={2.2} />
                  ) : isSelected ? (
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: contrastingDot(hex),
                      }}
                    />
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>

      <AccentColorPicker visible={pickerVisible} onClose={() => setPickerVisible(false)} />
    </View>
  );
}
