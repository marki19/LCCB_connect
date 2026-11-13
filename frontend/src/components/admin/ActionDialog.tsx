import { useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import TextField from "../ui/TextField";
import { SPACE } from "../../lib/tokens";

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
    <Modal visible={visible} onClose={onCancel} maxWidth={520} accessibilityLabel={title}>
      <View style={{ padding: SPACE.x6 }}>
        <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.3, color: colors.textPrimary }}>
          {title}
        </Text>
        {description ? (
          <Text style={{ marginTop: SPACE.x2, fontSize: 14, lineHeight: 21, color: colors.textSecondary }}>
            {description}
          </Text>
        ) : null}

        <View style={{ marginTop: SPACE.x5 }}>
          {showUntil ? (
            <TextField
              label="Suspended until (optional)"
              value={until}
              onChangeText={setUntil}
              placeholder="YYYY-MM-DD (leave blank for indefinite)"
              hint="Leave blank to suspend indefinitely."
            />
          ) : null}

          {showReason ? (
            <TextField
              label="Reason"
              value={reason}
              onChangeText={setReason}
              placeholder="Explain the decision. This is written to the audit log."
              multiline
              maxLength={500}
              minHeight={96}
              hint={`${reason.trim().length}/500 · at least 3 characters`}
            />
          ) : null}

          {confirmationPhrase ? (
            <TextField
              label={`Type "${confirmationPhrase}" to confirm`}
              value={confirmation}
              onChangeText={setConfirmation}
              placeholder={confirmationPhrase}
            />
          ) : null}
        </View>

        <View
          style={{
            marginTop: SPACE.x2,
            flexDirection: "row",
            justifyContent: "flex-end",
            gap: SPACE.x3,
          }}
        >
          <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={busy} />
          <Button
            label={confirmLabel}
            variant={destructive ? "danger" : "primary"}
            onPress={() =>
              onConfirm({
                reason: reason.trim(),
                until: until.trim(),
                confirmation: confirmation.trim(),
              })
            }
            loading={busy}
            disabled={!canSubmit}
          />
        </View>
      </View>
    </Modal>
  );
}
