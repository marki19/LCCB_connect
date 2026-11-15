import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, useRouter, useLocalSearchParams } from "expo-router";
import { Eye, EyeOff, KeyRound, Lock } from "lucide-react-native";
import { useTheme } from "../../src/contexts/ThemeContext";
import AuthScaffold from "../../src/components/auth/AuthScaffold";
import Alert from "../../src/components/ui/Alert";
import Button from "../../src/components/ui/Button";
import TextField from "../../src/components/ui/TextField";
import { SPACE } from "../../src/lib/tokens";
import { apiJson, ApiError } from "../../src/lib/api";

/**
 * Option B: backend-owned password reset flow.
 * fields: 6-digit code, new password, confirm.
 * Submit → POST /api/auth/verify-password-reset → login with success message.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; notice?: string }>();
  const email = (params.email || "").trim().toLowerCase();
  const notice = params.notice || "";
  const { colors } = useTheme();

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    let hasError = false;

    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email");
      hasError = true;
    }
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters");
      hasError = true;
    }
    if (confirm !== password) {
      setError("Passwords do not match");
      hasError = true;
    }
    if (hasError || loading) return;

    setLoading(true);
    setError("");

    try {
      const res = await apiJson<{ message: string }>("/auth/verify-password-reset", {
        method: "POST",
        body: JSON.stringify({
          email,
          token: code,
          password,
        }),
      });

      router.replace({
        pathname: "/(auth)/login",
        params: { success: res.message || "Password updated. Sign in with your new password." },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Check the code and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length > 0) setError("");
  };

  const eyeToggle = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
      onPress={() => setShowPassword((v) => !v)}
      hitSlop={8}
      style={({ pressed }) => ({ padding: SPACE.x1, opacity: pressed ? 0.6 : 1 })}
    >
      {showPassword ? (
        <EyeOff size={18} color={colors.textTertiary} strokeWidth={2.1} />
      ) : (
        <Eye size={18} color={colors.textTertiary} strokeWidth={2.1} />
      )}
    </Pressable>
  );

  const footer = (
    <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
      <Text style={{ color: colors.textTertiary, fontWeight: "500", fontSize: 13 }}>
        {"Remembered it? "}
      </Text>
      <Link href="/(auth)/login" asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="Back to sign in">
          {({ pressed }) => (
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13, opacity: pressed ? 0.7 : 1 }}>
              Sign in
            </Text>
          )}
        </Pressable>
      </Link>
    </View>
  );

  return (
    <AuthScaffold
      title="Set a new password"
      subtitle={notice || "Enter the code we emailed you and choose a new password."}
      footer={footer}
      backHref="/(auth)/login"
      backLabel="Back to sign in"
    >
      {error ? <Alert tone="error" message={error} /> : null}

      <TextField
        label="Verification code"
        value={code}
        onChangeText={handleCodeChange}
        placeholder="000000"
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        leadingIcon={({ size, color }) => <KeyRound size={size} color={color} strokeWidth={2.1} />}
        inputStyle={{ letterSpacing: 8, textAlign: "center", fontWeight: "700", fontSize: 18 }}
      />

      <TextField
        label="New password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (v) setError("");
        }}
        placeholder="At least 8 characters"
        secureTextEntry={!showPassword}
        autoComplete="new-password"
        leadingIcon={({ size, color }) => <Lock size={size} color={color} strokeWidth={2.1} />}
        hint="Use at least 8 characters"
        right={eyeToggle}
      />

      <TextField
        label="Confirm new password"
        value={confirm}
        onChangeText={(v) => {
          setConfirm(v);
          if (v) setError("");
        }}
        placeholder="Re-enter your new password"
        secureTextEntry={!showPassword}
        autoComplete="new-password"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        leadingIcon={({ size, color }) => <Lock size={size} color={color} strokeWidth={2.1} />}
        right={eyeToggle}
      />

      <Button
        label={loading ? "Updating..." : "Update password"}
        onPress={() => void submit()}
        loading={loading}
        disabled={loading}
        fullWidth
        size="lg"
      />
    </AuthScaffold>
  );
}
