import { useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS } from "../../lib/tokens";

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Warm, low-contrast shimmer. Uses an opacity pulse instead of an animated
 * gradient so it stays cheap on low-end Android devices.
 */
export function Skeleton({ width = "100%", height = 16, radius = RADIUS.md, style }: SkeletonProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    if (reduced) {
      pulse.value = 0.72;
      return;
    }
    pulse.value = 0.55;
    pulse.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
  }, [pulse, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.skeletonBase,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function SkeletonText({ lines = 2, width = "100%" }: { lines?: number; width?: number | `${number}%` }) {
  return (
    <Animated.View style={{ width, gap: 8 }}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={11}
          radius={6}
          width={index === lines - 1 ? "62%" : "100%"}
        />
      ))}
    </Animated.View>
  );
}
