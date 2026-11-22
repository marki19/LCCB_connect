import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Dimensions,
  Platform,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { useTheme } from "../../contexts/ThemeContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Configuration constants for performance tuning
const PARTICLE_COUNT = Platform.OS === "web" ? 40 : 25;
const FLOAT_DURATION = 22000;
const PARALLAX_STRENGTH = 20;

type FloatElementType = "circle" | "square" | "triangle";

interface FloatElement {
  x: number;
  y: number;
  size: number;
  type: FloatElementType;
  opacity: number;
  floatSpeed: number;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  color: string;
}

/**
 * Premium interactive background for auth screens.
 *
 * Layer stack (back → front):
 *   1. Base surface color (theme-aware)
 *   2. Aurora mesh blobs (3, SVG radial gradients = smooth edges)
 *   3. Cursor-reactive ambient glow
 *   4. Cursor spotlight (follows pointer)
 *   5. Floating geometric elements (drifting, parallax)
 *   6. Particle field (drifting dots; hover brightens + scales)
 *   7. Vignette (edge darkening for readability)
 */
export default function InteractiveBackground({
  style,
  intensity = "medium",
}: {
  style?: StyleProp<ViewStyle>;
  intensity?: "low" | "medium" | "high";
}) {
  const { colors, isDark } = useTheme();

  const floatAnim = useMemo(() => new Animated.Value(0), []);
  const glowPulse = useMemo(() => new Animated.Value(0), []);
  const cursorX = useMemo(() => new Animated.Value(0), []);
  const cursorY = useMemo(() => new Animated.Value(0), []);
  const cursorXRef = useRef(0);
  const cursorYRef = useRef(0);
  const lastWorldX = useRef(0);
  const lastWorldY = useRef(0);

  const blobPhases = useMemo<Animated.Value[]>(() => [
    new Animated.Value(0),
    new Animated.Value(0.33),
    new Animated.Value(0.66),
  ], []);

  const glowOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.5],
  });

  const parallaxX = cursorX.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-PARALLAX_STRENGTH, 0, PARALLAX_STRENGTH],
  });

  const parallaxY = cursorY.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-PARALLAX_STRENGTH, 0, PARALLAX_STRENGTH],
  });

  const blob1Phase = blobPhases[0];
  const blob2Phase = blobPhases[1];
  const blob3Phase = blobPhases[2];

  const blob1X = blob1Phase.interpolate({ inputRange: [0, 1], outputRange: [-0.15 * SCREEN_WIDTH, 0.15 * SCREEN_WIDTH] });
  const blob1Y = blob1Phase.interpolate({ inputRange: [0, 1], outputRange: [-0.12 * SCREEN_HEIGHT, 0.12 * SCREEN_HEIGHT] });
  const blob1Scale = blob1Phase.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] });
  const blob1Opacity = blob1Phase.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.55] });

  const blob2X = blob2Phase.interpolate({ inputRange: [0, 1], outputRange: [0.18 * SCREEN_WIDTH, -0.18 * SCREEN_WIDTH] });
  const blob2Y = blob2Phase.interpolate({ inputRange: [0, 1], outputRange: [0.1 * SCREEN_HEIGHT, -0.1 * SCREEN_HEIGHT] });
  const blob2Scale = blob2Phase.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.05] });
  const blob2Opacity = blob2Phase.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.5] });

  const blob3X = blob3Phase.interpolate({ inputRange: [0, 1], outputRange: [-0.12 * SCREEN_WIDTH, 0.12 * SCREEN_WIDTH] });
  const blob3Y = blob3Phase.interpolate({ inputRange: [0, 1], outputRange: [0.16 * SCREEN_HEIGHT, -0.16 * SCREEN_HEIGHT] });
  const blob3Scale = blob3Phase.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] });
  const blob3Opacity = blob3Phase.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.48] });

  const floatScale = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] });

  const blobColors = [colors.brand, colors.accent, colors.jade];
  const vignetteBg = isDark ? "rgba(4, 9, 18, 0.55)" : "rgba(11, 27, 51, 0.12)";
  const glowBg = isDark ? "rgba(110, 155, 255, 0.2)" : "rgba(14, 60, 156, 0.18)";

  // All continuous animations are started once.
  useEffect(() => {
    const timers: ReturnType<typeof Animated.loop>[] = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: 1, duration: FLOAT_DURATION / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(floatAnim, { toValue: 0, duration: FLOAT_DURATION / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
          Animated.timing(glowPulse, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(blob1Phase, { toValue: 1, duration: 8000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(blob1Phase, { toValue: 0, duration: 8000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(blob2Phase, { toValue: 1, duration: 10500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(blob2Phase, { toValue: 0, duration: 10500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(blob3Phase, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(blob3Phase, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])
      ),
    ];
    timers.forEach((t) => t.start());

    return () => {
      timers.forEach((t) => t.stop());
    };
  }, []);

  // ─── Generate Particles ───────────────────────────────────────────────────
  const particles = useMemo<Particle[]>(() => {
    const list: Particle[] = [];
    const count = intensity === "low" ? 12 : intensity === "high" ? PARTICLE_COUNT : Math.min(25, PARTICLE_COUNT);

    for (let i = 0; i < count; i++) {
      const depth = Math.random();
      list.push({
        x: Math.random() * SCREEN_WIDTH,
        y: Math.random() * SCREEN_HEIGHT,
        size: 1.5 + Math.random() * 3.5,
        speed: 0.12 + Math.random() * 0.3,
        opacity: 0.18 + Math.random() * 0.22,
        color:
          depth > 0.7 ? (isDark ? colors.brandBright : colors.brand) : depth > 0.4 ? (isDark ? colors.accentBright : colors.accent) : isDark ? "rgba(147, 197, 253, 0.45)" : "rgba(14, 60, 156, 0.35)",
      });
    }
    return list;
  }, [intensity, isDark]);

  // ─── Particle Animation (seamless ping-pong drift) ────────────────────────
  const particleAnims = useMemo(
    () =>
      particles.map((p) => {
        const y = new Animated.Value(0);
        const travel = (SCREEN_HEIGHT + p.size) * p.speed;
        const duration = 14000 + Math.random() * 8000;
        Animated.loop(
          Animated.sequence([
            Animated.timing(y, { toValue: -travel, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
            Animated.timing(y, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          ])
        ).start();
        return y;
      }),
     
    [particles]
  );

  // ─── Web-only cursor tracking + hover detection ────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    let rafId: number;
    let lastX = 0;
    let lastY = 0;
    const smoothing = 0.12;

    const handleMouseMove = (e: MouseEvent) => {
      lastX = (e.clientX / SCREEN_WIDTH - 0.5) * 2;
      lastY = (e.clientY / SCREEN_HEIGHT - 0.5) * 2;
      lastWorldX.current = e.clientX;
      lastWorldY.current = e.clientY;
    };

    const animateCursor = () => {
      const currentX = cursorXRef.current;
      const currentY = cursorYRef.current;
      const nextX = currentX + (lastX - currentX) * smoothing;
      const nextY = currentY + (lastY - currentY) * smoothing;
      cursorX.setValue(nextX);
      cursorY.setValue(nextY);
      cursorXRef.current = nextX;
      cursorYRef.current = nextY;

      // Keep cursor tracking for ambient glow parallax only.
      rafId = requestAnimationFrame(animateCursor);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    animateCursor();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // ─── Generate Floating Geometric Elements ─────────────────────────────────
  const floatingElements = useMemo<FloatElement[]>(() => {
    const count = intensity === "low" ? 2 : intensity === "high" ? 8 : 5;
    const elements: FloatElement[] = [];
    for (let i = 0; i < count; i++) {
      elements.push({
        x: 0.1 + Math.random() * 0.8,
        y: 0.1 + Math.random() * 0.8,
        size: 40 + Math.random() * 120,
        type: (["circle", "square", "triangle"] as const)[Math.floor(Math.random() * 3)],
        opacity: 0.06 + Math.random() * 0.08,
        floatSpeed: 0.3 + Math.random() * 0.7,
      });
    }
    return elements;
  }, [intensity]);

  const floatElementAnims = useMemo<Animated.Value[]>(() => floatingElements.map(() => new Animated.Value(0)), [floatingElements]);

  useEffect(() => {
    floatElementAnims.forEach((v, i) => {
      const el = floatingElements[i];
      if (!el) return;
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: (FLOAT_DURATION / el.floatSpeed) / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(v, { toValue: 0, duration: (FLOAT_DURATION / el.floatSpeed) / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])
      ).start();
    });
  }, [floatElementAnims, floatingElements]);

  const floatTranslateY = (el: FloatElement, i: number) => floatElementAnims[i]?.interpolate?.({ inputRange: [0, 1], outputRange: [-el.floatSpeed * 16, el.floatSpeed * 16] }) ?? floatAnim;

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      {/* ─── Layer 1: Base Surface ─────────────────────────────────────────── */}
      <View style={[styles.base, { backgroundColor: colors.surfacePage }]} />

      {/* ─── Layer 2: Animated Aurora Blobs (SVG radial gradients) ─────────── */}
      {[
        { x: blob1X, y: blob1Y, scale: blob1Scale, opacity: blob1Opacity, color: blobColors[0], size: SCREEN_WIDTH * 0.55, top: -0.12 * SCREEN_HEIGHT, left: -0.18 * SCREEN_WIDTH },
        { x: blob2X, y: blob2Y, scale: blob2Scale, opacity: blob2Opacity, color: blobColors[1], size: SCREEN_WIDTH * 0.5, top: 0.05 * SCREEN_HEIGHT, left: 0.55 * SCREEN_WIDTH },
        { x: blob3X, y: blob3Y, scale: blob3Scale, opacity: blob3Opacity, color: blobColors[2], size: SCREEN_WIDTH * 0.48, top: 0.28 * SCREEN_HEIGHT, left: -0.12 * SCREEN_WIDTH },
      ].map((b, i) => (
        <Animated.View
          key={i}
          style={[
            {
              position: "absolute",
              top: b.top,
              left: b.left,
              width: b.size,
              height: b.size,
              opacity: b.opacity,
              transform: [{ translateX: b.x }, { translateY: b.y }, { scale: b.scale }],
            },
          ]}
        >
          <Svg width={b.size} height={b.size} viewBox={`0 0 ${b.size} ${b.size}`}>
            <Defs>
              <RadialGradient id={`blob-${i}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={b.color} stopOpacity="1" />
                <Stop offset="60%" stopColor={b.color} stopOpacity="0.5" />
                <Stop offset="100%" stopColor={b.color} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={b.size / 2} cy={b.size / 2} r={b.size / 2} fill={`url(#blob-${i})`} />
          </Svg>
        </Animated.View>
      ))}

      {/* ─── Layer 3: Cursor-reactive ambient glow ─────────────────────────── */}
      <Animated.View
        style={[
          styles.glow,
          {
            backgroundColor: glowBg,
            opacity: glowOpacity,
            transform: [{ translateX: parallaxX }, { translateY: parallaxY }],
          },
        ]}
      />

      {/* ─── Layer 4: Floating geometric elements ──────────────────────────── */}
      {floatingElements.map((el, i) => (
        <Animated.View
          key={i}
          style={[
            styles.floatElement,
            {
              left: `${el.x * 100}%`,
              top: `${el.y * 100}%`,
              width: el.size,
              height: el.size,
              opacity: el.opacity,
              transform: [{ translateY: floatTranslateY(el, i) }, { scale: floatScale }],
            },
          ]}
        >
          {el.type === "circle" && <View style={[styles.floatCircle, { borderColor: isDark ? "rgba(130, 169, 255, 0.35)" : "rgba(14, 60, 156, 0.18)" }]} />}
          {el.type === "square" && <View style={[styles.floatSquare, { borderColor: isDark ? "rgba(242, 178, 27, 0.35)" : "rgba(201, 138, 0, 0.18)" }]} />}
          {el.type === "triangle" && <View style={[styles.floatTriangle, { borderBottomColor: isDark ? "rgba(79, 211, 172, 0.35)" : "rgba(11, 124, 92, 0.18)" }]} />}
        </Animated.View>
      ))}

      {/* ─── Layer 5: Particle field ───────────────────────────────────────── */}
      <View style={styles.particleContainer} pointerEvents="none">
        {particles.map((p, i) => (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                left: p.x,
                top: p.y,
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                backgroundColor: p.color,
                transform: [{ translateY: particleAnims[i] }],
              },
            ]}
          />
        ))}
      </View>

      {/* ─── Layer 6: Vignette ─────────────────────────────────────────────── */}
      <View style={[styles.vignette, { backgroundColor: vignetteBg }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  base: {
    ...StyleSheet.absoluteFill,
  },
  glow: {
    ...StyleSheet.absoluteFill,
  },
  floatElement: {
    position: "absolute",
    borderRadius: 9999,
  },
  floatCircle: {
    position: "absolute",
    borderRadius: 9999,
    borderWidth: 1,
  },
  floatSquare: {
    position: "absolute",
    borderRadius: 8,
    borderWidth: 1,
  },
  floatTriangle: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  particleContainer: {
    ...StyleSheet.absoluteFill,
    pointerEvents: "none",
  },
  particle: {
    position: "absolute",
    borderRadius: 9999,
    pointerEvents: "none",
  },
  vignette: {
    ...StyleSheet.absoluteFill,
    pointerEvents: "none",
  },
});

export { styles as InteractiveBackgroundStyles };
