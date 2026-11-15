import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from "react-native";
import {
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  CheckCircle2,
  XCircle,
  X,
  Lock,
  Clock,
  KeyRound,
} from "lucide-react-native";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import MfaSetupModal from "../auth/MfaSetupModal";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { listMfaFactors, unenrollMfa, type MfaFactor } from "../../lib/auth";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";

interface SecuritySettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SecuritySettingsModal({
  visible,
  onClose,
}: SecuritySettingsModalProps) {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [unenrollMode, setUnenrollMode] = useState(false);
  const [unenrollCode, setUnenrollCode] = useState("");
  const [unenrollError, setUnenrollError] = useState("");
  const [unenrollBusy, setUnenrollBusy] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const role = profile?.role?.toLowerCase().replace(/[-_]/g, "");
  const isAdmin = role === "admin" || role === "superadmin";

  const loadFactors = async () => {
    setLoading(true);
    try {
      const list = await listMfaFactors();
      setFactors(Array.isArray(list) ? list : []);
    } catch {
      setFactors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      void loadFactors();
      setUnenrollMode(false);
      setUnenrollCode("");
      setUnenrollError("");
      setSuccessMessage("");
    }
  }, [visible]);

  const verifiedFactor = factors.find(
    (f) => (f.type === "totp" || f.factor_type === "totp") && f.status === "verified"
  );
  const hasMfa = Boolean(verifiedFactor);

  const handleUnenroll = async () => {
    if (!verifiedFactor) return;
    const clean = unenrollCode.replace(/\D/g, "").slice(0, 6);
    if (clean.length !== 6) {
      setUnenrollError("Enter the 6-digit code from your authenticator app");
      return;
    }

    setUnenrollBusy(true);
    setUnenrollError("");

    try {
      await unenrollMfa(verifiedFactor.id, clean);
      setUnenrollMode(false);
      setUnenrollCode("");
      setSuccessMessage("Two-factor authentication has been disabled.");
      await loadFactors();
    } catch (err: any) {
      setUnenrollError(err?.message || "Invalid code. Could not disable 2FA.");
    } finally {
      setUnenrollBusy(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible && !setupModalOpen}
        onClose={onClose}
        maxWidth={500}
        accessibilityLabel="Security & Authentication Settings"
      >
        <View style={{ padding: SPACE.x4 }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.x4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
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
                <Lock size={18} color={colors.brand} />
              </View>
              <View>
                <Text style={{ ...TYPE.bodyStrong, fontSize: 16, color: colors.ink }}>
                  Security & Authentication
                </Text>
                <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>
                  Manage your account security and two-factor authentication
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              accessibilityLabel="Close"
              style={{ padding: 6, borderRadius: RADIUS.sm }}
            >
              <X size={18} color={colors.inkFaint} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
            {/* Success notice */}
            {successMessage ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: colors.badgePublicBg,
                  borderRadius: RADIUS.md,
                  padding: SPACE.x3,
                  marginBottom: SPACE.x4,
                }}
              >
                <CheckCircle2 size={16} color={colors.badgePublicText} />
                <Text style={{ ...TYPE.caption, fontWeight: "600", color: colors.badgePublicText, flex: 1 }}>
                  {successMessage}
                </Text>
              </View>
            ) : null}

            {/* Session Policy Card */}
            <View
              style={{
                backgroundColor: colors.surfaceSunken,
                borderRadius: RADIUS.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: SPACE.x3,
                marginBottom: SPACE.x4,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Clock size={15} color={colors.brand} />
                <Text style={{ ...TYPE.bodyStrong, fontSize: 13, color: colors.ink }}>
                  Session Security Policy
                </Text>
              </View>
              <Text style={{ ...TYPE.caption, color: colors.inkSoft, lineHeight: 18 }}>
                {isAdmin
                  ? "Admin sessions automatically expire every 24 hours. You will be prompted to verify your credentials upon expiration."
                  : "Student and faculty sessions remain securely active for up to 7 days on trusted devices."}
              </Text>
            </View>

            {/* Two-Factor Authentication Section */}
            <View
              style={{
                backgroundColor: colors.panel,
                borderRadius: RADIUS.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: SPACE.x4,
                marginBottom: SPACE.x3,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: SPACE.x2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Smartphone size={18} color={hasMfa ? colors.brand : colors.inkFaint} />
                  <Text style={{ ...TYPE.bodyStrong, fontSize: 14, color: colors.ink }}>
                    Authenticator App (TOTP)
                  </Text>
                </View>

                {/* Status Badge */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: RADIUS.pill,
                    backgroundColor: hasMfa ? colors.badgePublicBg : colors.surfaceSunken,
                  }}
                >
                  {hasMfa ? (
                    <>
                      <CheckCircle2 size={12} color={colors.badgePublicText} />
                      <Text style={{ ...TYPE.micro, fontWeight: "700", color: colors.badgePublicText }}>
                        Active
                      </Text>
                    </>
                  ) : (
                    <>
                      <XCircle size={12} color={colors.inkFaint} />
                      <Text style={{ ...TYPE.micro, fontWeight: "600", color: colors.inkFaint }}>
                        Off
                      </Text>
                    </>
                  )}
                </View>
              </View>

              <Text style={{ ...TYPE.caption, color: colors.inkSoft, lineHeight: 18, marginBottom: SPACE.x4 }}>
                {hasMfa
                  ? "Your account is protected. Every time you log in, you will be prompted for a 6-digit one-time code generated by Google Authenticator or Duo Mobile."
                  : "Protect your account with an extra security step. When logging in, you will provide both your password and a 6-digit code from Google Authenticator, Duo Mobile, or Microsoft Authenticator."}
              </Text>

              {loading ? (
                <ActivityIndicator size="small" color={colors.brand} style={{ paddingVertical: SPACE.x2 }} />
              ) : hasMfa ? (
                unenrollMode ? (
                  <View style={{ gap: SPACE.x3, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: SPACE.x3 }}>
                    <Text style={{ ...TYPE.caption, fontWeight: "600", color: colors.ink }}>
                      Confirm Deactivation:
                    </Text>
                    <Text style={{ ...TYPE.micro, color: colors.inkSoft }}>
                      Enter the current 6-digit code from your authenticator app to disable 2FA:
                    </Text>

                    <TextInput
                      value={unenrollCode}
                      onChangeText={(val) => {
                        setUnenrollCode(val.replace(/\D/g, "").slice(0, 6));
                        if (unenrollError) setUnenrollError("");
                      }}
                      placeholder="000000"
                      placeholderTextColor={colors.inkFaint}
                      keyboardType="numeric"
                      maxLength={6}
                      style={{
                        height: 42,
                        backgroundColor: colors.surfaceSunken,
                        borderRadius: RADIUS.md,
                        borderWidth: 1,
                        borderColor: unenrollError ? colors.destructive : colors.border,
                        textAlign: "center",
                        fontSize: 18,
                        fontWeight: "700",
                        letterSpacing: 4,
                        color: colors.ink,
                        outlineStyle: "none",
                      } as any}
                    />

                    {unenrollError ? (
                      <Text style={{ ...TYPE.micro, color: colors.destructive }}>
                        {unenrollError}
                      </Text>
                    ) : null}

                    <View style={{ flexDirection: "row", gap: SPACE.x2 }}>
                      <Button
                        label={unenrollBusy ? "Removing…" : "Confirm Disable"}
                        variant="danger"
                        onPress={() => void handleUnenroll()}
                        disabled={unenrollBusy || unenrollCode.length !== 6}
                        loading={unenrollBusy}
                      />
                      <Button
                        label="Cancel"
                        variant="ghost"
                        onPress={() => setUnenrollMode(false)}
                        disabled={unenrollBusy}
                      />
                    </View>
                  </View>
                ) : (
                  <Button
                    label="Disable Two-Factor Authentication"
                    variant="secondary"
                    onPress={() => setUnenrollMode(true)}
                  />
                )
              ) : (
                <Button
                  label="Enable Two-Factor Authentication"
                  variant="primary"
                  onPress={() => setSetupModalOpen(true)}
                />
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Reusable Setup Modal */}
      <MfaSetupModal
        visible={setupModalOpen}
        onClose={() => setSetupModalOpen(false)}
        onSuccess={() => {
          setSetupModalOpen(false);
          setSuccessMessage("Two-factor authentication has been successfully enabled!");
          void loadFactors();
        }}
      />
    </>
  );
}
