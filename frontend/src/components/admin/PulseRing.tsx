import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../../contexts/ThemeContext";
import { TYPE } from "../../lib/tokens";

type PulseRingProps = {
  /** 0…1 */
  value: number;
  size?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
  onDark?: boolean;
};

/**
 * A single-value activity ring. Uses real ratios only — the overview has no
 * historical series, so this is deliberately not a fake sparkline.
 */
export default function PulseRing({
  value,
  size = 108,
  color,
  trackColor,
  label,
  sublabel,
  onDark = false,
}: PulseRingProps) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const stroke = Math.max(7, Math.round(size * 0.075));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ringColor = color ?? colors.jadeBright;
  const track = trackColor ?? (onDark ? colors.heroLine : colors.panelInset);
  const labelColor = onDark ? colors.heroText : colors.ink;
  const subColor = onDark ? colors.heroTextMuted : colors.inkFaint;

  return (
    <View
      accessible
      accessibilityLabel={
        label ? `${label}${sublabel ? `, ${sublabel}` : ""}` : `${Math.round(clamped * 100)} percent`
      }
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={track}
          strokeWidth={stroke}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={stroke}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
        />
      </Svg>
      <Text style={{ ...TYPE.title, fontSize: 18, color: labelColor }}>
        {label ?? `${Math.round(clamped * 100)}%`}
      </Text>
      {sublabel ? (
        <Text
          style={{
            ...TYPE.micro,
            fontSize: 8,
            letterSpacing: 0.9,
            color: subColor,
            marginTop: 1,
          }}
        >
          {sublabel}
        </Text>
      ) : null}
    </View>
  );
}
