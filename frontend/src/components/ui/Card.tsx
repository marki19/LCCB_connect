import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { elevation, RADIUS, SPACE } from "../../lib/tokens";

type CardProps = {
  children: ReactNode;
  padding?: number;
  elevated?: boolean;
  style?: ViewStyle;
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
        ...style,
      }}
    >
      {children}
    </View>
  );
}
