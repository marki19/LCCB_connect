import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { SPACE } from "../../lib/tokens";

type DividerProps = {
  /** Inset from left (and right if not fullWidth). Default 0. */
  inset?: number;
  /** Full width divider (ignores inset). Default false. */
  fullWidth?: boolean;
  /** Vertical margin. Default SPACE.x3. */
  marginVertical?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Consistent hairline divider using theme colors.
 */
export default function Divider({
  inset = 0,
  fullWidth = false,
  marginVertical = SPACE.x3,
  style,
}: DividerProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.divider,
          marginVertical,
          marginLeft: fullWidth ? 0 : inset,
          marginRight: fullWidth ? 0 : inset,
        },
        style,
      ]}
    />
  );
}

