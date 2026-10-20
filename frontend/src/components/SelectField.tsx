import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { ChevronDown, Check, X } from "lucide-react-native";
import { useTheme } from "../contexts/ThemeContext";

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
  const { colors, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled || loading}
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderWidth: 1,
          borderColor: error ? colors.destructive : colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "500",
            color: selected ? colors.textPrimary : colors.textTertiary,
          }}
          numberOfLines={1}
        >
          {loading ? "Loading…" : selected ? selected.label : placeholder}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.textTertiary} />
        ) : (
          <ChevronDown color={colors.textTertiary} size={18} />
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(15,23,42,0.45)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onPress={() => setOpen(false)}
        >
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, width: "100%", maxWidth: 440, maxHeight: "70%", overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>{placeholder}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} style={{ padding: 4 }}>
                <X color={colors.textTertiary} size={20} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {options.length === 0 ? (
                <Text style={{ color: colors.textTertiary, fontSize: 14, paddingHorizontal: 20, paddingVertical: 24 }}>{emptyText}</Text>
              ) : (
                options.map((o) => (
                  <TouchableOpacity
                    key={o.value}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 20,
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      backgroundColor: o.value === value ? colors.actionSurface : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: o.value === value ? colors.action : colors.textPrimary,
                        fontWeight: o.value === value ? "700" : "500",
                      }}
                    >
                      {o.label}
                    </Text>
                    {o.value === value ? <Check color={colors.action} size={18} /> : null}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
