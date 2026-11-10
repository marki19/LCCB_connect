import { useState, useCallback, useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";
import { verifySignupCode, resendSignupCode } from "../../src/lib/auth";
import { peekPendingSignup, clearPendingSignup } from "../../src/lib/pendingSignup";
import { OtpInput, type OtpInputHandle } from "../../src/components/OtpInput";
import AuthScaffold from "../../src/components/auth/AuthScaffold";
import Alert from "../../src/components/ui/Alert";
import Button from "../../src/components/ui/Button";
import { RADIUS, SPACE } from "../../src/lib/tokens";

/**
 * Signup-only 6-digit code entry (plan §5 Phase 2.2).
 * The code is verified against Supabase; the password-recovery code has its
 * own screen (`reset-password.tsx`) because it is paired with the new password.
 */
export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email: string }>();
  const email = (params.email || "").trim().toLowerCase();
  const { colors } = useTheme();

  const [codeValue, setCodeValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRef = useRef<OtpInputHandle>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const submit = useCallback(
    async (value: string = codeValue) => {
      if (value.length !== 6 || loading) return;

      const password = peekPendingSignup(email);
      if (!password) {
        setError("The signup password is no longer available. Start the signup again.");
        return;
      }

      setLoading(true);
      setError("");
      try {
        await verifySignupCode(email, value, password);
        clearPendingSignup();
        router.replace("/onboarding");
      } catch (err: any) {
        setError(
          err?.code === "code_invalid"
            ? "That code is incorrect or has expired."
            : err?.message || "That code is wrong or expired."
        );
      } finally {
        setLoading(false);
      }
    },
    [codeValue, email, loading, router]
  );

  const resend = useCallback(async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      const result = await resendSignupCode(email);
      setCooldown(result?.retry_after || 60);
      setCodeValue("");
      setError("");
      otpRef.current?.clear();
    } catch (err: any) {
      const message = err?.message || "Could not resend the code. Try again in a moment.";
      if (err?.status === 429) {
        const retryAfter = err.response?.headers?.["retry-after"];
        if (retryAfter) setCooldown(parseInt(retryAfter, 10));
      }
      setError(message);
    } finally {
      setResending(false);
    }
  }, [cooldown, email, resending]);

  const footer = (
    <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
      <Text style={{ color: colors.textTertiary, fontWeight: "500", fontSize: 13 }}>
        {"Wrong email? "}
      </Text>
      <Link href="/(auth)/login" asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="Use a different email">
          {({ pressed }) => (
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13, opacity: pressed ? 0.7 : 1 }}>
              Start over
            </Text>
          )}
        </Pressable>
      </Link>
    </View>
  );

  return (
    <AuthScaffold
      title="Verify your email"
      subtitle={`We sent a 6-digit code to ${email || "your email"}`}
      footer={footer}
      backHref="/(auth)/login"
      backLabel="Back to sign in"
    >
      {error ? <Alert tone="error" message={error} /> : null}

      <View style={{ marginBottom: SPACE.x4 }}>
        <OtpInput
          ref={otpRef}
          autoFocus
          onComplete={(value) => void submit(value)}
          onChange={(value) => {
            setCodeValue(value);
            if (error) setError("");
          }}
          disabled={loading}
          error={Boolean(error) && codeValue.length === 6}
        />
      </View>

      <Button
        label={loading ? "Verifying..." : "Verify"}
        onPress={() => void submit()}
        loading={loading}
        disabled={loading || codeValue.length !== 6}
        fullWidth
        size="lg"
      />

      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          marginTop: SPACE.x5,
          gap: SPACE.x3,
          flexWrap: "wrap",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Resend code"
          onPress={() => void resend()}
          disabled={cooldown > 0 || resending}
          style={({ pressed }) => ({
            paddingHorizontal: SPACE.x3,
            paddingVertical: SPACE.x2,
            borderRadius: RADIUS.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSunken,
            opacity: cooldown > 0 || resending ? 0.45 : pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
            {resending ? "Resending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </Text>
        </Pressable>

        <Link href="/(auth)/login" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use a different email"
            style={({ pressed }) => ({
              paddingHorizontal: SPACE.x3,
              paddingVertical: SPACE.x2,
              borderRadius: RADIUS.sm,
              borderWidth: 1,
              borderColor: colors.primary,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
              Use a different email
            </Text>
          </Pressable>
        </Link>
      </View>
    </AuthScaffold>
  );
}
