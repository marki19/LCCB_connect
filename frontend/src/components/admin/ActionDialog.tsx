import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type ActionDialogProps = {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  showReason?: boolean;
  showUntil?: boolean;
  confirmationPhrase?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (input: {
    reason: string;
    until: string;
    confirmation: string;
  }) => void;
};

/**
 * Desktop-friendly confirmation dialog for audited governance actions.
 * Validation mirrors the server: a reason is 3-500 characters.
 */
export default function ActionDialog({
  visible,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  showReason = true,
  showUntil = false,
  confirmationPhrase,
  busy = false,
  onCancel,
  onConfirm,
}: ActionDialogProps) {
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const reasonOk = !showReason || (reason.trim().length >= 3 && reason.trim().length <= 500);
  const phraseOk =
    !confirmationPhrase ||
    confirmation.trim().toLowerCase() === confirmationPhrase.toLowerCase();
  const canSubmit = reasonOk && phraseOk && !busy;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/40 p-6">
        <View className="w-full max-w-[520px] rounded-2xl bg-white p-6 shadow-2xl">
          <Text className="text-xl font-black text-slate-900">{title}</Text>
          {description ? (
            <Text className="mt-2 text-sm leading-5 text-slate-500">{description}</Text>
          ) : null}

          {showUntil ? (
            <View className="mt-5">
              <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                Suspended until (optional)
              </Text>
              <TextInput
                value={until}
                onChangeText={setUntil}
                placeholder="YYYY-MM-DD — blank means indefinite"
                placeholderTextColor="#94A3B8"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900"
              />
            </View>
          ) : null}

          {showReason ? (
            <View className="mt-5">
              <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                Reason
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                maxLength={500}
                placeholder="Explain the decision. This is written to the audit log."
                placeholderTextColor="#94A3B8"
                className="min-h-[84px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900"
                textAlignVertical="top"
              />
              <Text className="mt-1 text-xs text-slate-400">
                {reason.trim().length}/500 · at least 3 characters
              </Text>
            </View>
          ) : null}

          {confirmationPhrase ? (
            <View className="mt-4">
              <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                Type <Text className="text-slate-900">{confirmationPhrase}</Text> to confirm
              </Text>
              <TextInput
                value={confirmation}
                onChangeText={setConfirmation}
                autoCapitalize="none"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900"
              />
            </View>
          ) : null}

          <View className="mt-6 flex-row justify-end gap-3">
            <TouchableOpacity
              onPress={onCancel}
              disabled={busy}
              className="rounded-xl border border-slate-200 px-4 py-2.5"
            >
              <Text className="font-bold text-slate-600">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                onConfirm({
                  reason: reason.trim(),
                  until: until.trim(),
                  confirmation: confirmation.trim(),
                })
              }
              disabled={!canSubmit}
              className={`flex-row items-center rounded-xl px-4 py-2.5 ${
                destructive ? "bg-red-600" : "bg-[#1D4ED8]"
              } ${!canSubmit ? "opacity-40" : ""}`}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
              ) : null}
              <Text className="font-bold text-white">{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
