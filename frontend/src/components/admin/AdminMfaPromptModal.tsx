import React, { useState } from "react";
import { View, Text, TextInput, ActivityIndicator, Pressable, Platform } from "react-native";
import { ShieldCheck, AlertCircle } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";
import { stepUpAdminMfa } from "../../lib/adminApi";

interface AdminMfaPromptModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminMfaPromptModal({
  visible,
  onClose,
  onSuccess,
}: AdminMfaPromptModalProps) {
  const { colors } = useTheme();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanCode = code.replace(/\D/g, "").slice(0, 6);
  const canSubmit = cleanCode.length === 6 && !busy;

  const handleVerify = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    try {
      const res = await stepUpAdminMfa(cleanCode);
      if (res?.ok) {
        setCode("");
        setError(null);
        onSuccess();
      } else {
        setError(res?.message || "Verification failed. Please try again.");
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Invalid code. Please check your authenticator app.");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    setCode("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      maxWidth={440}
      accessibilityLabel="Admin Authentication Required"
    >
      <View style={{ padding: SPACE.x6 }}>
        {/* Header Icon + Title */}
        <View style={{ alignItems: "center", marginBottom: SPACE.x4 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 20,
              backgroundColor: colors.brandWash,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: SPACE.x3,
            }}
          >
            <ShieldCheck size={28} color={colors.brandSolid} strokeWidth={2.2} />
          </View>
          <Text
            style={{
              ...TYPE.h2,
              color: colors.textPrimary,
              textAlign: "center",
            }}
          >
            Admin Session Expired
          </Text>
          <Text
            style={{
              ...TYPE.body,
              color: colors.inkSoft,
              textAlign: "center",
              marginTop: SPACE.x2,
              lineHeight: 20,
            }}
          >
            For security, admin privileges require 24-hour verification. Enter the 6-digit code from your authenticator app to unlock the console.
          </Text>
        </View>

        {/* Code Input */}
        <View style={{ marginBottom: SPACE.x4 }}>
          <TextInput
            value={cleanCode}
            onChangeText={(txt) => {
              setCode(txt);
              if (error) setError(null);
            }}
            placeholder="000000"
            placeholderTextColor={colors.inkFaint}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus={visible}
            editable={!busy}
            onSubmitEditing={canSubmit ? handleVerify : undefined}
            style={{
              height: 56,
              fontSize: 28,
              fontWeight: "700",
              letterSpacing: 10,
              textAlign: "center",
              borderRadius: RADIUS.lg,
              borderWidth: 1.5,
              borderColor: error ? colors.destructive : colors.border,
              backgroundColor: colors.surfaceSunken,
              color: colors.textPrimary,
              ...Platform.select({
                web: { outlineStyle: "none" } as any,
              }),
            }}
          />

          {error && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginTop: SPACE.x2,
                justifyContent: "center",
              }}
            >
              <AlertCircle size={15} color={colors.destructive} />
              <Text
                style={{
                  ...TYPE.caption,
                  color: colors.destructive,
                  textAlign: "center",
                }}
              >
                {error}
              </Text>
            </View>
          )}
        </View>

        {/* Buttons */}
        <View style={{ gap: SPACE.x2 }}>
          <Button
            variant="primary"
            label={busy ? "Verifying…" : "Unlock Console"}
            disabled={!canSubmit}
            onPress={handleVerify}
          />
          <Button
            variant="ghost"
            label="Cancel and Stay in App"
            disabled={busy}
            onPress={handleClose}
          />
        </View>
      </View>
    </Modal>
  );
}

