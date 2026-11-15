import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { elevation, RADIUS, SPACE } from "../../lib/tokens";

type CardProps = {
  children: ReactNode;
  padding?: number;
  elevated?: boolean;
  /**
   * Accepts a style array as well as an object. `VirtualizedList` clones a
   * `ListEmptyComponent` with `StyleSheet.compose(...)`, which returns an
   * array; spreading that array directly would produce numeric style keys and
   * crash React DOM.
   */
  style?: StyleProp<ViewStyle>;
};

export default function Card({ children, padding = SPACE.x5, elevated = false, style }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: RADIUS.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding,
        ...(elevated ? elevation("sm", colors) : {}),
        ...StyleSheet.flatten(style),
      }}
    >
      {children}
    </View>
  );
}
