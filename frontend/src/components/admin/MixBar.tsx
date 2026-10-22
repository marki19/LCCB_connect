import { View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

export type MixSegment = {
  label: string;
  value: number;
  color: string;
};

type MixBarProps = {
  segments: MixSegment[];
  height?: number;
  trackColor?: string;
};

/** Honest distribution rail — no invented time series. */
export default function MixBar({ segments, height = 8, trackColor }: MixBarProps) {
  const { colors } = useTheme();
  const visible = segments.filter((segment) => segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total || 1, now: total }}
      style={{
        height,
        width: "100%",
        borderRadius: height / 2,
        backgroundColor: trackColor ?? colors.panelInset,
        overflow: "hidden",
        flexDirection: "row",
        gap: 2,
      }}
    >
      {total > 0
        ? visible.map((segment) => (
            <View
              key={segment.label}
              style={{
                flex: segment.value,
                minWidth: 3,
                height,
                borderRadius: height / 2,
                backgroundColor: segment.color,
              }}
            />
          ))
        : null}
    </View>
  );
}
