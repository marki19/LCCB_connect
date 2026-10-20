import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

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
  const { colors } = useTheme();
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
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfaceOverlay,
          padding: 24,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 520,
            borderRadius: 16,
            backgroundColor: colors.surfaceElevated,
            padding: 24,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: colors.shadowStrong,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
            elevation: 10,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textPrimary }}>
            {title}
          </Text>
          {description ? (
            <Text
              style={{
                marginTop: 8,
                fontSize: 14,
                lineHeight: 20,
                color: colors.textSecondary,
              }}
            >
              {description}
            </Text>
          ) : null}

          {showUntil ? (
            <View style={{ marginTop: 20 }}>
              <Text
                style={{
                  marginBottom: 6,
                  fontSize: 11,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  color: colors.textTertiary,
                }}
              >
                Suspended until (optional)
              </Text>
              <TextInput
                value={until}
                onChangeText={setUntil}
                placeholder="YYYY-MM-DD — blank means indefinite"
                placeholderTextColor={colors.textMuted}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  backgroundColor: colors.inputBg,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                  color: colors.textPrimary,
                }}
              />
            </View>
          ) : null}

          {showReason ? (
            <View style={{ marginTop: 20 }}>
              <Text
                style={{
                  marginBottom: 6,
                  fontSize: 11,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  color: colors.textTertiary,
                }}
              >
                Reason
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                maxLength={500}
                placeholder="Explain the decision. This is written to the audit log."
                placeholderTextColor={colors.textMuted}
                textAlignVertical="top"
                style={{
                  minHeight: 84,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  backgroundColor: colors.inputBg,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                  color: colors.textPrimary,
                }}
              />
              <Text style={{ marginTop: 4, fontSize: 12, color: colors.textTertiary }}>
                {reason.trim().length}/500 · at least 3 characters
              </Text>
            </View>
          ) : null}

          {confirmationPhrase ? (
            <View style={{ marginTop: 16 }}>
              <Text
                style={{
                  marginBottom: 6,
                  fontSize: 11,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  color: colors.textTertiary,
                }}
              >
                Type{" "}
                <Text style={{ color: colors.primary, fontWeight: "800" }}>
                  {confirmationPhrase}
                </Text>{" "}
                to confirm
              </Text>
              <TextInput
                value={confirmation}
                onChangeText={setConfirmation}
                autoCapitalize="none"
                placeholderTextColor={colors.textMuted}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  backgroundColor: colors.inputBg,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                  color: colors.textPrimary,
                }}
              />
            </View>
          ) : null}

          <View style={{ marginTop: 24, flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
            <TouchableOpacity
              onPress={onCancel}
              disabled={busy}
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                paddingHorizontal: 16,
                paddingVertical: 10,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Text style={{ fontWeight: "700", fontSize: 14, color: colors.textSecondary }}>
                Cancel
              </Text>
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
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 12,
                paddingHorizontal: 18,
                paddingVertical: 10,
                backgroundColor: destructive ? colors.destructive : colors.primary,
                opacity: !canSubmit ? 0.45 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator
                  size="small"
                  color={destructive ? colors.textOnDanger : colors.textOnPrimary}
                  style={{ marginRight: 8 }}
                />
              ) : null}
              <Text
                style={{
                  fontWeight: "700",
                  fontSize: 14,
                  color: destructive ? colors.textOnDanger : colors.textOnPrimary,
                }}
              >
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


