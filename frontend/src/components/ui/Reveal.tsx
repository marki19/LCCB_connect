import { useEffect, type ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { MOTION } from "../../lib/tokens";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  /** Starting vertical offset for the entrance. */
  distance?: number;
};

/**
 * Short, staggered entrance used by the overview and landing surfaces.
 *
 * Uses a shared value rather than a layout animation: Reanimated's web
 * `entering` animations can leave an element at `visibility: hidden` when the
 * layout animation never starts, which hides real content. A timed shared
 * value is deterministic on web, iOS, and Android.
 */
export default function Reveal({ children, delay = 0, style, distance = 10 }: RevealProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }

    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: MOTION.slow, easing: Easing.out(Easing.cubic) })
    );
  }, [delay, progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
