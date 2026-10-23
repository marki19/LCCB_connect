import { useEffect, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";
import { MOTION } from "../lib/tokens";

/**
 * Count from 0 to `value` with an ease-out curve. Skips the animation when the
 * OS asks for reduced motion, and always lands on the real value.
 */
export function useCountUp(value: number, duration = MOTION.countUp) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduced || !Number.isFinite(value)) {
      return;
    }

    let frame = 0;
    const start = Date.now();

    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    // Background tabs can pause rAF indefinitely. Never leave a metric stuck at
    // zero: settle on the real value once the animation window has passed.
    const settle = setTimeout(() => setDisplay(value), duration + 80);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [value, duration, reduced]);

  return reduced ? value : display;
}

export function formatCount(value: number) {
  return Math.round(value).toLocaleString("en-US");
}
