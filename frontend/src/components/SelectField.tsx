import { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { ChevronDown, Check, X } from "lucide-react-native";
import { useTheme } from "../contexts/ThemeContext";
import Modal from "./ui/Modal";
import { focusRing, RADIUS, SPACE } from "../lib/tokens";

/**
 * A dependency-free modal select. Used for the Department → Course pickers in
 * registration and the profile-completion gate. Deliberately not a third-party
 * picker so it behaves the same on native and web with no extra native module.
 */

export type SelectOption = { label: string; value: string };

type Props = {
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
  emptyText?: string;
};

export default function SelectField({
  value,
  options,
  onChange,
  placeholder = "Select…",
  disabled = false,
  loading = false,
  error = false,
  emptyText = "No options available",
}: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={selected ? selected.label : placeholder}
        accessibilityState={{ expanded: open, disabled: disabled || loading }}
        disabled={disabled || loading}
        onPress={() => setOpen(true)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => [
          {
            backgroundColor: colors.inputBg,
            borderRadius: RADIUS.md,
            paddingHorizontal: SPACE.x3,
            minHeight: 50,
            borderWidth: 1,
            borderColor: error ? colors.destructive : focused ? colors.inputBorderFocus : colors.inputBorder,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
          },
          focusRing(colors, focused),
        ]}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: "500",
            color: selected ? colors.textPrimary : colors.textTertiary,
          }}
          numberOfLines={1}
        >
          {loading ? "Loading…" : selected ? selected.label : placeholder}
        </Text>
        {loading ? (
          <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.textTertiary} />
        ) : (
          <ChevronDown color={colors.textTertiary} size={18} />
        )}
      </Pressable>

      <Modal
        visible={open}
        onClose={() => setOpen(false)}
        maxWidth={440}
        accessibilityLabel={placeholder}
        sheetOnMobile
      >
        <View style={{ flexShrink: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: SPACE.x5,
              paddingVertical: SPACE.x4,
              borderBottomWidth: 1,
              borderBottomColor: colors.divider,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>{placeholder}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => setOpen(false)}
              hitSlop={8}
              style={({ pressed }) => ({ padding: SPACE.x1, opacity: pressed ? 0.6 : 1 })}
            >
              <X color={colors.textTertiary} size={20} />
            </Pressable>
          </View>

          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }}>
            {options.length === 0 ? (
              <Text
                style={{
                  color: colors.textTertiary,
                  fontSize: 14,
                  paddingHorizontal: SPACE.x5,
                  paddingVertical: SPACE.x6,
                }}
              >
                {emptyText}
              </Text>
            ) : (
              options.map((o) => {
                const isSelected = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    accessibilityRole="button"
                    accessibilityLabel={o.label}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: SPACE.x5,
                      paddingVertical: SPACE.x4,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.divider,
                      backgroundColor: isSelected
                        ? colors.primarySurface
                        : pressed
                        ? colors.hoverOverlay
                        : "transparent",
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        color: isSelected ? colors.primary : colors.textPrimary,
                        fontWeight: isSelected ? "700" : "500",
                      }}
                    >
                      {o.label}
                    </Text>
                    {isSelected ? <Check color={colors.primary} size={18} /> : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
