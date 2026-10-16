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
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled || loading}
        onPress={() => setOpen(true)}
        className={`bg-white rounded-2xl px-5 py-4 border flex-row items-center justify-between ${
          error ? "border-red-400" : "border-slate-200"
        } ${disabled ? "opacity-60" : ""}`}
      >
        <Text
          className={`text-base font-medium ${
            selected ? "text-slate-900" : "text-slate-400"
          }`}
          numberOfLines={1}
        >
          {loading ? "Loading…" : selected ? selected.label : placeholder}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color="#94A3B8" />
        ) : (
          <ChevronDown color="#94A3B8" size={18} />
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 items-center justify-center p-6"
          onPress={() => setOpen(false)}
        >
          <View className="bg-white rounded-3xl w-full max-w-md max-h-[70%] overflow-hidden">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-100">
              <Text className="text-base font-bold text-slate-800">{placeholder}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} className="p-1">
                <X color="#64748B" size={20} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {options.length === 0 ? (
                <Text className="text-slate-400 text-sm px-5 py-6">{emptyText}</Text>
              ) : (
                options.map((o) => (
                  <TouchableOpacity
                    key={o.value}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className="flex-row items-center justify-between px-5 py-4 border-b border-slate-50"
                  >
                    <Text
                      className={`text-base ${
                        o.value === value ? "text-[#1D4ED8] font-bold" : "text-slate-700"
                      }`}
                    >
                      {o.label}
                    </Text>
                    {o.value === value ? <Check color="#1D4ED8" size={18} /> : null}
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
