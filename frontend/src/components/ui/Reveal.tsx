import { useEffect, useRef, useMemo, type ReactNode } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";
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
 * Uses built-in Animated so it is deterministic on web, iOS, and Android
 * without triggering Reanimated inline style warnings.
 */
export default function Reveal({ children, delay = 0, style, distance = 10 }: RevealProps) {
  const translateYAnim = useMemo(() => new Animated.Value(distance), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: MOTION.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, distance, translateYAnim]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateY: translateYAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
