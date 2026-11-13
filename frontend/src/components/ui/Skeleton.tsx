import { useEffect, useRef } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
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
  const opacityAnim = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.55,
          duration: 1100,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacityAnim]);

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
          opacity: opacityAnim,
        },
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
