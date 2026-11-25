import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";

export type TabPillOption = {
  value: string;
  label: string;
  badgeCount?: number;
  icon?: any;
  disabled?: boolean;
};

type TabPillProps = {
  options: TabPillOption[];
  value: string;
  onChange: (value: string) => void;
  style?: StyleProp<ViewStyle>;
  /** Show as pills (default) or underline tabs */
  variant?: "pill" | "underline";
};

export default function TabPill({
  options,
  value,
  onChange,
  style,
  variant = "pill",
}: TabPillProps) {
  const { colors } = useTheme();

  return (
    <View style={[{ flexDirection: "row", gap: SPACE.x2 }, style]}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => !option.disabled && onChange(option.value)}
          disabled={option.disabled}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option.value, disabled: option.disabled }}
          style={({ pressed, hovered }: any) => {
            const isActive = value === option.value;
            if (variant === "underline") {
              return [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.x1,
                  paddingVertical: SPACE.x2,
                  paddingHorizontal: SPACE.x1,
                  borderBottomWidth: isActive ? 2 : 0,
                  borderBottomColor: isActive ? colors.brand : "transparent",
                  backgroundColor: pressed || hovered ? colors.hoverOverlay : "transparent",
                  borderRadius: RADIUS.sm,
                  opacity: option.disabled ? 0.5 : 1,
                } as any,
              ];
            }
            return [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.x1,
                borderRadius: RADIUS.pill,
                borderWidth: isActive ? 0 : 1,
                borderColor: isActive ? colors.brandSolid : colors.line,
                backgroundColor: isActive
                  ? colors.brandSolid
                  : pressed || hovered
                  ? colors.surfaceSunken
                  : colors.panel,
                paddingHorizontal: SPACE.x3,
                paddingVertical: 6,
                transform: [{ scale: pressed && !option.disabled ? 0.95 : 1 }],
                opacity: option.disabled ? 0.5 : 1,
              } as any,
            ];
          }}
        >
          {option.icon && <option.icon size={16} color={value === option.value ? colors.textOnBrandSolid : colors.inkSoft} strokeWidth={2} />}
          <Text
            style={[
              {
                fontSize: 12.5,
                fontWeight: "700",
                color: value === option.value ? colors.textOnBrandSolid : colors.inkSoft,
              },
            ]}
          >
            {option.label}
          </Text>
          {option.badgeCount && option.badgeCount > 0 && value !== option.value && (
            <View
              style={{
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                paddingHorizontal: 4,
                backgroundColor: colors.destructiveSurface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.destructiveText, fontSize: 9, fontWeight: "800" }}>
                {option.badgeCount > 99 ? "99+" : option.badgeCount}
              </Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}