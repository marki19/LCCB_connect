import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Mail } from "lucide-react-native";
import { useTheme } from "../../src/contexts/ThemeContext";
import AuthScaffold from "../../src/components/auth/AuthScaffold";
import Alert from "../../src/components/ui/Alert";
import Button from "../../src/components/ui/Button";
import TextField from "../../src/components/ui/TextField";
import { apiJson, ApiError } from "../../src/lib/api";

/**
 * Option B: backend-owned password reset flow.
 * email field → POST /api/auth/request-password-reset → always navigate to
 * the reset screen with "If that address is registered, a code is on its way."
 * Never branch on the response, so an unknown address is not confirmed.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidEmailDomain = email.trim().toLowerCase().endsWith("@lccbonline.edu.ph");
  const showEmailFormatError = email.length > 0 && !isValidEmailDomain;

  async function requestResetCode() {
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!isValidEmailDomain) {
      setError("Must be an @lccbonline.edu.ph address");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await apiJson<{ message: string }>("/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Could not send the code. Try again in a moment.");
      }
      setLoading(false);
      return;
    }

    router.replace({
      pathname: "/(auth)/reset-password",
      params: {
        email: email.trim().toLowerCase(),
        notice: "If that address is registered, a reset code is on its way.",
      },
    });
    setLoading(false);
  }

  const footer = (
    <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
      <Text style={{ color: colors.textTertiary, fontWeight: "500", fontSize: 13 }}>
        {"Remembered your password? "}
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
      title="Reset your password"
      subtitle="We'll email you a 6-digit code to verify it's you."
      footer={footer}
      backHref="/(auth)/login"
      backLabel="Back to sign in"
    >
      {error ? <Alert tone="error" message={error} /> : null}

      <TextField
        label="Institutional email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (v) setError("");
        }}
        placeholder="student@lccbonline.edu.ph"
        keyboardType="email-address"
        autoComplete="email"
        returnKeyType="done"
        onSubmitEditing={() => void requestResetCode()}
        leadingIcon={({ size, color }) => <Mail size={size} color={color} strokeWidth={2.1} />}
        error={showEmailFormatError ? "Must use an @lccbonline.edu.ph address" : ""}
      />

      <Button
        label={loading ? "Sending code..." : "Send reset code"}
        onPress={() => void requestResetCode()}
        loading={loading}
        disabled={loading}
        fullWidth
        size="lg"
      />
    </AuthScaffold>
  );
}