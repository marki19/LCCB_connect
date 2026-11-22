import { useCallback, useState } from "react";
import { Text, TextInput, View, type LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../contexts/ThemeContext";
import { hexToHsl, hslToHex, normalizeHex } from "../../lib/theme";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";
import Button from "../ui/Button";
import Modal from "../ui/Modal";

type AccentColorPickerProps = {
  visible: boolean;
  onClose: () => void;
};

type ColorSliderProps = {
  label: string;
  value: number;
  max: number;
  colors: string[];
  onChange: (value: number) => void;
};

const HUE_STOPS = [
  "#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF", "#FF0000",
];

/** Responsive HSL slider — tap or drag on web, iOS and Android. */
function ColorSlider({ label, value, max, colors, onChange }: ColorSliderProps) {
  const { colors: tokens } = useTheme();
  const [width, setWidth] = useState(0);

  const updateFromX = useCallback(
    (x: number) => {
      if (width <= 0) return;
      onChange(Math.max(0, Math.min(max, Math.round((x / width) * max))));
    },
    [width, max, onChange]
  );

  return (
    <View style={{ marginTop: SPACE.x4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: SPACE.x2 }}>
        <Text style={{ ...TYPE.caption, color: tokens.ink, fontWeight: "700" }}>{label}</Text>
        <Text style={{ ...TYPE.caption, color: tokens.inkFaint }}>{value}</Text>
      </View>

      <View
        accessible
        accessibilityRole="slider"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max, now: value }}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event: any) => updateFromX(event.nativeEvent.locationX)}
        onResponderMove={(event: any) => updateFromX(event.nativeEvent.locationX)}
        onKeyDown={(event: any) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault?.();
            onChange(Math.max(0, value - 1));
          } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault?.();
            onChange(Math.min(max, value + 1));
          }
        }}
        style={{ height: 28, justifyContent: "center", cursor: "pointer" } as any}
      >
        <LinearGradient
          colors={colors as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: 14, borderRadius: 7, borderWidth: 1, borderColor: tokens.border }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: Math.max(0, Math.min(width - 18, (value / max) * width - 9)),
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: tokens.surface,
            borderWidth: 3,
            borderColor: tokens.ink,
          }}
        />
      </View>
    </View>
  );
}

/**
 * Custom accent color picker. Uses only in-repo primitives so it works on web,
 * tablet and mobile without a native module or a development build.
 */
export default function AccentColorPicker({ visible, onClose }: AccentColorPickerProps) {
  const { colors, accentColor, customAccentHex, setCustomAccent } = useTheme();
  const [hex, setHex] = useState(() => normalizeHex(customAccentHex || "") || accentColor);
  const [draft, setDraft] = useState(hex);

  // Re-seed the editor when the picker transitions to visible. Doing this
  // during render (React's recommended pattern) avoids an extra effect pass.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      const initial = normalizeHex(customAccentHex || "") || accentColor;
      setHex(initial);
      setDraft(initial);
    }
  }

  const { h, s, l } = hexToHsl(hex);

  const commitHex = (next: string) => {
    setHex(next);
    setDraft(next);
  };

  const apply = () => {
    const normalized = normalizeHex(draft) || hex;
    setCustomAccent(normalized);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      maxWidth={420}
      accessibilityLabel="Custom accent color"
    >
      <View style={{ padding: SPACE.x6, paddingBottom: SPACE.x5 }}>
        <Text style={{ ...TYPE.h2, color: colors.ink }}>Custom accent</Text>
        <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 4 }}>
          Pick any color for buttons, links and highlights.
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x3, marginTop: SPACE.x5 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: RADIUS.md,
              backgroundColor: hex,
              borderWidth: 2,
              borderColor: colors.borderStrong,
            }}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...TYPE.micro, color: colors.inkFaint, marginBottom: SPACE.x1 }}>
              HEX VALUE
            </Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onBlur={() => {
                const normalized = normalizeHex(draft);
                if (normalized) commitHex(normalized);
                else setDraft(hex);
              }}
              onSubmitEditing={() => {
                const normalized = normalizeHex(draft);
                if (normalized) commitHex(normalized);
              }}
              autoCapitalize="characters"
              accessibilityLabel="Accent color hex value"
              style={{
                borderWidth: 1,
                borderColor: colors.borderStrong,
                borderRadius: RADIUS.sm,
                paddingHorizontal: SPACE.x3,
                paddingVertical: SPACE.x2,
                color: colors.ink,
                backgroundColor: colors.surfaceSunken,
                fontFamily: "monospace",
              }}
            />
          </View>
        </View>

        <ColorSlider
          label="Hue"
          value={h}
          max={360}
          colors={HUE_STOPS}
          onChange={(value) => commitHex(hslToHex(value, s, l))}
        />
        <ColorSlider
          label="Saturation"
          value={s}
          max={100}
          colors={[hslToHex(h, 0, l), hslToHex(h, 100, l)]}
          onChange={(value) => commitHex(hslToHex(h, value, l))}
        />
        <ColorSlider
          label="Lightness"
          value={l}
          max={100}
          colors={["#000000", hslToHex(h, s, 50), "#FFFFFF"]}
          onChange={(value) => commitHex(hslToHex(h, s, value))}
        />

        <View style={{ flexDirection: "row", gap: SPACE.x2, marginTop: SPACE.x6 }}>
          <View style={{ flex: 1 }}>
            <Button label="Cancel" variant="secondary" onPress={onClose} fullWidth />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Apply" variant="primary" onPress={apply} fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
}
