import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { MOTION } from "../../lib/tokens";

type SlideSwitcherProps = {
  /** Zero-based index of the visible panel. */
  index: number;
  /**
   * Width of a single panel. Panels are exactly this wide, so this doubles as
   * the distance one panel travels when the next one slides in. Passed in
   * explicitly because the switcher lives inside a fixed-width popover — it
   * should never have to measure itself to know where its panels sit.
   */
  width: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Horizontal panel switcher for anchored popovers.
 *
 * Panels live side by side on a track; changing `index` slides the track and
 * eases the viewport to the new panel's height, so a sub-page can replace a
 * menu without the card jumping or leaving dead space behind.
 *
 * Uses built-in `Animated` with the JS driver because height is animated and
 * the native driver cannot drive layout properties on any platform.
 */
export default function SlideSwitcher({ index, width, children, style }: SlideSwitcherProps) {
  const panels = Children.toArray(children);
  const [heights, setHeights] = useState<Record<number, number>>({});
  /** False until a panel has been measured; see the fallback below. */
  const [isSized, setIsSized] = useState(false);

  const [translateX] = useState(() => new Animated.Value(0));
  const [height] = useState(() => new Animated.Value(0));
  /** True once the panel on screen has reported its natural height. */
  const hasSizedViewport = useRef(false);

  const recordHeight = (panelIndex: number) => (event: LayoutChangeEvent) => {
    const measured = Math.round(event.nativeEvent.layout.height);
    if (measured <= 0) return;

    // First paint: adopt the height as-is. Animating from zero would make the
    // popover grow out of nothing every time it opens.
    if (panelIndex === index && !hasSizedViewport.current) {
      hasSizedViewport.current = true;
      height.setValue(measured);
      setIsSized(true);
    }

    setHeights((previous) =>
      previous[panelIndex] === measured ? previous : { ...previous, [panelIndex]: measured }
    );
  };

  useEffect(() => {
    const animations: Animated.CompositeAnimation[] = [
      Animated.timing(translateX, {
        toValue: -index * width,
        duration: MOTION.base,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ];

    const targetHeight = heights[index];
    if (hasSizedViewport.current && targetHeight != null) {
      animations.push(
        Animated.timing(height, {
          toValue: targetHeight,
          duration: MOTION.base,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        })
      );
    }

    Animated.parallel(animations).start();
  }, [index, width, heights, height, translateX]);

  return (
    // Before the first measurement the viewport stays auto-height rather than
    // zero, so a slow or unavailable layout observer can never hide the card.
    <Animated.View style={[{ height: isSized ? height : undefined, overflow: "hidden" }, style]}>
      <Animated.View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          width: width * panels.length,
          transform: [{ translateX }],
        }}
      >
        {panels.map((panel, panelIndex) => {
          const isVisible = panelIndex === index;
          return (
            <View
              key={panelIndex}
              collapsable={false}
              // The track is wider than the viewport. On the web, an
              // off-screen panel can still receive pointer events in some
              // browsers even though it is clipped. Explicitly disable hits
              // (and hide it from screen readers) so only the visible panel
              // is interactive and announced.
              pointerEvents={isVisible ? "auto" : "none"}
              accessibilityElementsHidden={!isVisible}
              importantForAccessibility={isVisible ? "auto" : "no-hide-descendants"}
              style={{ width }}
              onLayout={recordHeight(panelIndex)}
            >
              {panel}
            </View>
          );
        })}
      </Animated.View>
    </Animated.View>
  );
}
