import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";

type HoverLabelProps = {
  label: string;
  visible: boolean;
  /**
   * Distance in px from the owning control's top edge to the label. Callers
   * pass the gap that puts the chip just below the bar, so the chip sits at the
   * same height regardless of how tall the control itself is.
   */
  top: number;
};

/**
 * The small name chip shown below an icon-only control while it is hovered.
 *
 * Absolutely positioned over whatever is beneath the bar, so showing it never
 * shifts the control, changes the bar's height, or pushes its neighbours
 * around. `pointerEvents: none` is essential: the chip sits outside the
 * control's box, and if it could receive the pointer the control would fire
 * `onHoverOut` as soon as the chip appeared, making it flicker.
 */
export default function HoverLabel({ label, visible, top }: HoverLabelProps) {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <View style={[styles.wrap, { top }]}>
      <View
        style={[styles.chip, { backgroundColor: colors.navBg, borderColor: colors.navBgAlt }]}
      >
        <Text
          numberOfLines={1}
          style={[TYPE.caption, styles.text, { color: colors.navTextActive }]}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1200,
    pointerEvents: "none",
  },
  chip: {
    paddingHorizontal: SPACE.x3,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    maxWidth: 180,
  },
  text: {
    fontWeight: "600",
  },
});
