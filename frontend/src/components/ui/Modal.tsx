import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Modal as RNModal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import { elevation, MOTION, RADIUS, SPACE } from "../../lib/tokens";

type ModalProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Max content width on tablet/desktop. Default 520. */
  maxWidth?: number;
  /** Close when the backdrop is pressed. Default true. */
  dismissOnBackdrop?: boolean;
  /** Accessible name for the dialog. */
  accessibilityLabel?: string;
  /** Present as a bottom sheet on narrow screens. Default true. */
  sheetOnMobile?: boolean;
  /** Extra styles for the content surface. */
  style?: StyleProp<ViewStyle>;
};

/**
 * One animated, accessible dialog surface for the whole app.
 *
 * - Backdrop fades; the panel fades + lifts (scales slightly on desktop).
 * - Bottom sheet on narrow screens, centered card on tablet/desktop.
 * - Backdrop blur on web, scrim everywhere.
 * - Escape / backdrop / Android back close it; focus returns on web.
 * - Honors reduced motion.
 */
export default function Modal({
  visible,
  onClose,
  children,
  maxWidth = 520,
  dismissOnBackdrop = true,
  accessibilityLabel,
  sheetOnMobile = true,
  style,
}: ModalProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  // Mount while visible, and stay mounted until the exit animation finishes.
  const [shown, setShown] = useState(visible);
  if (visible && !shown) setShown(true);
  if (reduced && !visible && shown) setShown(false);
  const shouldRender = reduced ? visible : shown;

  const progress = useSharedValue(visible ? 1 : 0);
  const contentRef = useRef<View>(null);
  const previouslyFocused = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      if (reduced) {
        progress.value = 1;
        return;
      }
      progress.value = 0;
      progress.value = withTiming(1, { duration: MOTION.base, easing: Easing.out(Easing.cubic) });
      return;
    }

    if (reduced) {
      progress.value = 0;
      return;
    }

    progress.value = withTiming(
      0,
      { duration: MOTION.fast, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setShown)(false);
      }
    );
  }, [visible, reduced, progress]);

  // Escape to close + focus management (web only).
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;
    const doc: any = (globalThis as any).document;
    const win: any = (globalThis as any).window;
    previouslyFocused.current = doc?.activeElement ?? null;

    const onKeyDown = (event: any) => {
      if (event.key === "Escape") onClose();
    };
    win?.addEventListener?.("keydown", onKeyDown);

    // Move focus into the dialog so screen readers announce it.
    const t = setTimeout(() => {
      try {
        (contentRef.current as any)?.focus?.();
      } catch {}
    }, 30);

    return () => {
      win?.removeEventListener?.("keydown", onKeyDown);
      clearTimeout(t);
      try {
        previouslyFocused.current?.focus?.();
      } catch {}
    };
  }, [visible, onClose]);

  const isMobile = width < 640;
  const asSheet = isMobile && sheetOnMobile;

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const contentStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p,
      transform: [
        { translateY: (1 - p) * (asSheet ? 28 : 10) },
        { scale: asSheet ? 1 : 0.97 + p * 0.03 },
      ],
    };
  });

  if (!shouldRender) return null;

  const webBlur =
    Platform.OS === "web"
      ? ({ backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" } as any)
      : null;

  const webA11y =
    Platform.OS === "web"
      ? ({ role: "dialog", "aria-modal": true, "aria-label": accessibilityLabel, tabIndex: -1 } as any)
      : {};

  // The dialog is focused programmatically for screen readers, so the browser's
  // default focus ring (an off-brand amber here) would frame the whole surface.
  const webOutline =
    Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null;

  return (
    <RNModal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.surfaceOverlay },
            webBlur,
            backdropStyle,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close dialog"
            onPress={dismissOnBackdrop ? onClose : undefined}
            style={{ flex: 1 }}
          />
        </Animated.View>

        <View
          pointerEvents="box-none"
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: asSheet ? "flex-end" : "center",
            padding: asSheet ? 0 : SPACE.x6,
          }}
        >
          <Animated.View
            ref={contentRef}
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel}
            {...webA11y}
            style={[
              {
                width: "100%",
                maxWidth: asSheet ? undefined : maxWidth,
                maxHeight: "90%",
                overflow: "hidden",
                backgroundColor: colors.surfaceElevated,
                borderWidth: 1,
                borderColor: colors.border,
                borderTopLeftRadius: asSheet ? RADIUS.xxl : RADIUS.xl,
                borderTopRightRadius: asSheet ? RADIUS.xxl : RADIUS.xl,
                borderBottomLeftRadius: asSheet ? 0 : RADIUS.xl,
                borderBottomRightRadius: asSheet ? 0 : RADIUS.xl,
                ...elevation("lg", colors),
              },
              webOutline,
              contentStyle,
              style,
            ]}
          >
            {children}
          </Animated.View>
        </View>
      </View>
    </RNModal>
  );
}
