import React, { createContext, useContext, type ReactNode } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { SPACE, TYPE } from "../../lib/tokens";

export type RadioItemProps = {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

type RadioGroupContextValue = {
  value: string;
  onChange: (value: string) => void;
};

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

function RadioIndicator({ active, disabled, color }: { active: boolean; disabled?: boolean; color?: string }) {
  const { colors } = useTheme();
  const borderColor = disabled ? colors.textDisabled : active ? color ?? colors.brand : colors.borderStrong;
  const bgColor = active ? color ?? colors.brand : "transparent";

  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor,
        backgroundColor: bgColor,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {active && (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.textOnPrimary,
          }}
        />
      )}
    </View>
  );
}

function RadioItemImpl({
  value,
  label,
  hint,
  disabled = false,
}: RadioItemProps) {
  const { colors } = useTheme();
  const context = useContext(RadioGroupContext);
  if (!context) {
    console.warn("RadioItem must be used within RadioGroup");
    return null;
  }
  const { value: groupValue, onChange } = context;
  const isActive = groupValue === value;

  return (
    <Pressable
      onPress={() => !disabled && onChange(value)}
      disabled={disabled}
      accessibilityRole="radio"
      aria-checked={isActive}
      aria-disabled={disabled}
      style={({ pressed, hovered }: any) => ({
        flexDirection: "row",
        alignItems: "flex-start",
        gap: SPACE.x3,
        paddingHorizontal: SPACE.x4,
        paddingVertical: SPACE.x3,
        backgroundColor: pressed || hovered ? colors.surfaceSunken : "transparent",
        opacity: disabled ? 0.6 : 1,
      })}
    >
      <RadioIndicator active={isActive} disabled={disabled} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            ...TYPE.bodyStrong,
            fontWeight: isActive ? "700" : "500",
            color: disabled ? colors.textDisabled : colors.ink,
          }}
        >
          {label}
        </Text>
        {hint && (
          <Text style={{ ...TYPE.caption, color: disabled ? colors.textDisabled : colors.inkFaint, marginTop: 1, lineHeight: 16 }}>
            {hint}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export const RadioItem = RadioItemImpl;

type RadioGroupProps = {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Layout direction */
  direction?: "column" | "row";
};

export default function RadioGroup({
  value,
  onChange,
  children,
  style,
  direction = "column",
}: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onChange }}>
      <View
        style={[
          {
            flexDirection: direction,
            gap: direction === "row" ? SPACE.x4 : 0,
            flexWrap: direction === "row" ? "wrap" : "nowrap",
          },
          style,
        ]}
      >
        {children}
      </View>
    </RadioGroupContext.Provider>
  );
}