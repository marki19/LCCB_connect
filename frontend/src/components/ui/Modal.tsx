import { useEffect, useRef, useState, useMemo, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Modal as RNModal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
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
  /**
   * On mobile viewports (<640px), dock the modal to the bottom of the screen
   * as a sheet with rounded top corners. Defaults to true. Set false for
   * alert-style confirmation dialogs that should stay centered.
   */
  sheetOnMobile?: boolean;
  /** Accessible label for the dialog. Used by screen readers. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Design-system modal container.
 *
 * Implements the modal rules from docs/UI_UX_DESIGN_SYSTEM.md:
 *   - Centers on tablet / desktop with bounded max-width (default 520).
 *   - Slides up from the bottom as a sheet on small screens by default.
 *   - Surface: surfaceElevated with border + lg elevation.
 *   - Backdrop: surfaceOverlay with subtle blur on web.
 *   - Traps Escape on web and restores previous focus on unmount.
 *   - Built-in Animated without Reanimated warnings on web.
 */
export default function Modal({
  visible,
  onClose,
  children,
  maxWidth = 520,
  dismissOnBackdrop = true,
  sheetOnMobile = true,
  accessibilityLabel = "Dialog",
  style,
}: ModalProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  // Mount while visible, and stay mounted until the exit animation finishes.
  const [shown, setShown] = useState(visible);
  if (visible && !shown) setShown(true);
  const shouldRender = visible || shown;

  const progressAnim = useMemo(() => new Animated.Value(visible ? 1 : 0), []);
  const contentRef = useRef<View>(null);
  const previouslyFocused = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      setShown(true);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: MOTION.base,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return;
    }

    Animated.timing(progressAnim, {
      toValue: 0,
      duration: MOTION.fast,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setShown(false);
    });
  }, [visible, progressAnim]);

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

  const backdropOpacity = progressAnim;
  const contentTranslateY = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [asSheet ? 28 : 10, 0],
  });
  const contentScale = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [asSheet ? 1 : 0.97, 1],
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
            { backgroundColor: colors.surfaceOverlay, opacity: backdropOpacity },
            webBlur,
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
                opacity: progressAnim,
                transform: [
                  { translateY: contentTranslateY },
                  { scale: contentScale },
                ],
              },
              webOutline,
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
