import { useState } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Pipette } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { ACCENT_CHOICES, type AccentColorPreference } from "../../lib/theme";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";
import AccentColorPicker from "./AccentColorPicker";

/** Human-readable name for an accent swatch. */
export function accentLabel(accent: AccentColorPreference): string {
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
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#0B1B33" : "#FFFFFF";
}

/** Swatch footprint. The cell is larger than the dot so the selection ring
 *  has room and the grid keeps a consistent rhythm. */
const SWATCH_SIZE = 36;
const SWATCH_CELL = 44;

type AccentColorGridProps = {
  /** Container style. */
  style?: StyleProp<ViewStyle>;
  /** Show the "Accent color" caption above the grid. Default true. */
  showLabel?: boolean;
};

/**
 * Reusable accent color swatch grid. Resolves each swatch from the active
 * palette (light/dark aware), shows a selection ring and exposes a custom
 * color picker for the "custom" choice. Used by both the desktop account
 * popover and the mobile Settings → Appearance screen.
 */
export default function AccentColorGrid({ style, showLabel = true }: AccentColorGridProps) {
  const {
    colors,
    resolved,
    accentPreference,
    setAccent,
    customAccentHex,
    accentColor: resolvedAccentHex,
  } = useTheme();

  const isDark = resolved === "dark";
  const accentPalette = colors.accentColor[isDark ? "dark" : "light"];
  const swatchHex = (label: AccentColorPreference): string => {
    if (label === "custom") return customAccentHex || accentPalette.default;
    return accentPalette[label] || accentPalette.default;
  };

  const [hoveredAccent, setHoveredAccent] = useState<AccentColorPreference | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  return (
    <View style={style}>
      {showLabel ? (
        <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginBottom: SPACE.x1 }}>
          Accent color
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: SPACE.x2,
          marginTop: showLabel ? SPACE.x1 : 0,
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

      <AccentColorPicker visible={pickerVisible} onClose={() => setPickerVisible(false)} />
    </View>
  );
}
