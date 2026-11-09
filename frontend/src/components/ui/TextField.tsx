import { useState, type ReactNode } from "react";
import {
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { focusRing, RADIUS, SPACE } from "../../lib/tokens";

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  multiline?: boolean;
  editable?: boolean;
  right?: ReactNode;
  minHeight?: number;
};

export default function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "none",
  autoComplete,
  multiline = false,
  editable = true,
  right,
  minHeight,
}: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.destructive
    : focused
    ? colors.inputBorderFocus
    : colors.inputBorder;

  return (
    <View style={{ marginBottom: SPACE.x4 }}>
      <Text
        style={{
          fontSize: 13,
          lineHeight: 18,
          fontWeight: "600",
          color: colors.textSecondary,
          marginBottom: SPACE.x2,
        }}
      >
        {label}
      </Text>
      <View
        style={[
          {
            minHeight: minHeight ?? 48,
            flexDirection: "row",
            alignItems: multiline ? "flex-start" : "center",
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor,
            backgroundColor: editable ? colors.inputBg : colors.surfaceSunken,
            paddingHorizontal: SPACE.x3,
          },
          focusRing(colors, focused),
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          multiline={multiline}
          editable={editable}
          textAlignVertical={multiline ? "top" : "center"}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            minHeight: multiline ? minHeight ?? 120 : 46,
            paddingVertical: multiline ? SPACE.x3 : 0,
            paddingHorizontal: 0,
            fontSize: 15,
            lineHeight: 22,
            color: colors.textPrimary,
            outlineStyle: "none",
          } as any}
        />
        {right ? <View style={{ marginLeft: SPACE.x2 }}>{right}</View> : null}
      </View>
      {error ? (
        <Text style={{ fontSize: 12, lineHeight: 17, color: colors.destructiveText, marginTop: SPACE.x2 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textTertiary, marginTop: SPACE.x2 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
