import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import {
  ShieldCheck,
  Copy,
  Check,
  Smartphone,
  QrCode,
  KeyRound,
  X,
  AlertCircle,
} from "lucide-react-native";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { useTheme } from "../../contexts/ThemeContext";
import { enrollMfa, verifyMfaEnrollment, type MfaEnrollResult } from "../../lib/auth";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";

interface MfaSetupModalProps {
  visible: boolean;
  onClose?: () => void;
  onSuccess: () => void;
  isMandatory?: boolean;
  tempToken?: string;
}

export default function MfaSetupModal({
  visible,
  onClose,
  onSuccess,
  isMandatory = false,
  tempToken,
}: MfaSetupModalProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [enrollData, setEnrollData] = useState<MfaEnrollResult | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible) {
      setEnrollData(null);
      setCode("");
      setError("");
      setCopied(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    enrollMfa(tempToken)
      .then((data) => {
        if (!cancelled) {
          setEnrollData(data);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.message || "Failed to initiate authenticator setup");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleCopyKey = () => {
    if (!enrollData?.secret) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(enrollData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleVerify = async () => {
    if (!enrollData?.factor_id) return;
    const cleanCode = code.replace(/\D/g, "").slice(0, 6);
    if (cleanCode.length !== 6) {
      setError("Please enter the 6-digit code from your authenticator app");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await verifyMfaEnrollment(enrollData.factor_id, cleanCode, tempToken);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || "Invalid verification code. Please check your authenticator and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={isMandatory && onClose ? onClose : () => onClose?.()}
      maxWidth={480}
      dismissOnBackdrop={!isMandatory}
      accessibilityLabel="Two-Factor Authentication Setup"
    >
      <View style={{ padding: SPACE.x4 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.x3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: RADIUS.md,
                backgroundColor: colors.brandWash,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...TYPE.bodyStrong, fontSize: 16, color: colors.ink }}>
                Set Up Two-Factor Authentication
              </Text>
              <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>
                Google Authenticator, Duo Mobile, or any TOTP app
              </Text>
            </View>
          </View>

          {onClose && (
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close"
              style={{ padding: 6, borderRadius: RADIUS.sm }}
            >
              <X size={18} color={colors.inkFaint} />
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={{ paddingVertical: SPACE.x8, alignItems: "center", gap: SPACE.x3 }}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={{ ...TYPE.body, color: colors.inkSoft }}>
              Generating secure authenticator key…
            </Text>
          </View>
        ) : error && !enrollData ? (
          <View style={{ paddingVertical: SPACE.x6, alignItems: "center", gap: SPACE.x3 }}>
            <AlertCircle size={32} color={colors.destructive} />
            <Text style={{ ...TYPE.body, color: colors.destructive, textAlign: "center" }}>
              {error}
            </Text>
            {onClose && (
              <Button label="Dismiss" variant="secondary" onPress={onClose} />
            )}
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
            {/* Step 1 */}
            <View style={{ marginBottom: SPACE.x4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Smartphone size={16} color={colors.brand} />
                <Text style={{ ...TYPE.bodyStrong, fontSize: 13, color: colors.ink }}>
                  Step 1: Open your Authenticator App
                </Text>
              </View>
              <Text style={{ ...TYPE.caption, color: colors.inkSoft, lineHeight: 18 }}>
                Open <Text style={{ fontWeight: "700" }}>Google Authenticator</Text>, <Text style={{ fontWeight: "700" }}>Duo Mobile</Text>, or Microsoft Authenticator on your phone.
              </Text>
            </View>

            {/* Step 2 */}
            <View style={{ marginBottom: SPACE.x4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <QrCode size={16} color={colors.brand} />
                <Text style={{ ...TYPE.bodyStrong, fontSize: 13, color: colors.ink }}>
                  Step 2: Scan QR Code or Enter Setup Key
                </Text>
              </View>
              <Text style={{ ...TYPE.caption, color: colors.inkSoft, marginBottom: SPACE.x3 }}>
                Scan this barcode with your authenticator camera:
              </Text>

              {/* QR Code Container */}
              {enrollData?.qr_code_url ? (
                <View
                  style={{
                    alignSelf: "center",
                    backgroundColor: "#FFFFFF",
                    padding: 12,
                    borderRadius: RADIUS.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    marginBottom: SPACE.x3,
                  }}
                >
                  <Image
                    source={{ uri: enrollData.qr_code_url }}
                    style={{ width: 180, height: 180 }}
                    resizeMode="contain"
                    accessibilityLabel="Authenticator QR Code"
                  />
                </View>
              ) : null}

              {/* Manual Setup Key for Duo / Manual entry */}
              <View
                style={{
                  backgroundColor: colors.surfaceSunken,
                  borderRadius: RADIUS.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: SPACE.x3,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ ...TYPE.caption, fontWeight: "600", color: colors.inkSoft }}>
                    Can&apos;t scan? Manual Setup Key:
                  </Text>
                  <Pressable
                    onPress={handleCopyKey}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingVertical: 2,
                      paddingHorizontal: 8,
                      borderRadius: RADIUS.sm,
                      backgroundColor: copied ? colors.brandWash : colors.panel,
                    }}
                  >
                    {copied ? (
                      <>
                        <Check size={12} color={colors.brand} />
                        <Text style={{ ...TYPE.micro, fontWeight: "700", color: colors.brand }}>
                          Copied!
                        </Text>
                      </>
                    ) : (
                      <>
                        <Copy size={12} color={colors.inkFaint} />
                        <Text style={{ ...TYPE.micro, fontWeight: "600", color: colors.inkSoft }}>
                          Copy Key
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
                <Text
                  selectable
                  style={{
                    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                    fontSize: 13,
                    fontWeight: "700",
                    color: colors.ink,
                    letterSpacing: 1.5,
                  }}
                >
                  {enrollData?.secret || "—"}
                </Text>
              </View>
            </View>

            {/* Step 3 */}
            <View style={{ marginBottom: SPACE.x4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <KeyRound size={16} color={colors.brand} />
                <Text style={{ ...TYPE.bodyStrong, fontSize: 13, color: colors.ink }}>
                  Step 3: Enter Verification Code
                </Text>
              </View>
              <Text style={{ ...TYPE.caption, color: colors.inkSoft, marginBottom: SPACE.x2 }}>
                Enter the 6-digit rolling code shown in your authenticator app:
              </Text>

              <TextInput
                value={code}
                onChangeText={(val) => {
                  setCode(val.replace(/\D/g, "").slice(0, 6));
                  if (error) setError("");
                }}
                placeholder="000000"
                placeholderTextColor={colors.inkFaint}
                keyboardType="numeric"
                maxLength={6}
                onSubmitEditing={() => void handleVerify()}
                style={{
                  height: 48,
                  backgroundColor: colors.surfaceSunken,
                  borderRadius: RADIUS.md,
                  borderWidth: 1.5,
                  borderColor: error ? colors.destructive : colors.border,
                  textAlign: "center",
                  fontSize: 22,
                  fontWeight: "700",
                  letterSpacing: 6,
                  color: colors.ink,
                  outlineStyle: "none",
                } as any}
                accessibilityLabel="6-digit authenticator verification code"
              />

              {error ? (
                <Text style={{ ...TYPE.caption, color: colors.destructive, marginTop: 6, textAlign: "center" }}>
                  {error}
                </Text>
              ) : null}
            </View>

            {/* Submit button */}
            <View style={{ marginTop: SPACE.x2, gap: SPACE.x2 }}>
              <Button
                label={submitting ? "Verifying…" : "Verify & Activate"}
                variant="primary"
                onPress={() => void handleVerify()}
                disabled={submitting || code.trim().length !== 6}
                loading={submitting}
              />
              {!isMandatory && onClose ? (
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={onClose}
                  disabled={submitting}
                />
              ) : null}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
