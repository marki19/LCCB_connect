import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image, Pressable } from "react-native";
import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useRouter, useLocalSearchParams } from "expo-router";
import { AlertCircle, Sun, Moon, Monitor } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/contexts/ThemeContext";
import { focusRing } from "../../src/lib/tokens";
import { verifySignupCode, resendSignupCode } from "../../src/lib/auth";

/**
 * Signup-only 6-digit code entry (plan §5 Phase 2.2).
 * The code is verified against Supabase; the password-recovery code has its
 * own screen (`reset-password.tsx`) because it is paired with the new password.
 */
export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email: string }>();
  const email = (params.email || "").trim().toLowerCase();
  const { colors, isDark, preference, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  const [code, setCode] = useState<Array<string>>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [focusedControl, setFocusedControl] = useState<string | null>(null);
  const [hoveredControl, setHoveredControl] = useState<string | null>(null);
  const inputRefs = useRef<Array<any>>([]);

  const codeValue = code.join("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const themeLabel = preference === "system" ? "System" : preference === "light" ? "Light" : "Dark";
  const nextTheme = preference === "light" ? "dark" : preference === "dark" ? "system" : "light";
  const nextThemeLabel = nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1);
  const ThemeIcon = preference === "system" ? Monitor : preference === "light" ? Sun : Moon;

  const submit = useCallback(async () => {
    if (codeValue.length !== 6 || loading) return;
    setLoading(true);
    setError("");
    try {
      await verifySignupCode(email, codeValue);
      router.replace("/onboarding");
    } catch (err: any) {
      // Map backend error codes to specific messages
      const code = err?.code || err?.status;
      if (code === "code_expired") {
        setError("The code has expired. Tap 'Resend code' for a new one.");
      } else if (code === "code_used") {
        setError("This code was already used. Tap 'Resend code' for a new one.");
      } else if (code === "code_invalid") {
        setError("That code is incorrect. Double-check the digits.");
      } else if (code === "invalid_code") {
        setError("That code is wrong or expired.");
      } else {
        setError(err?.message || "That code is wrong or expired.");
      }
    } finally {
      setLoading(false);
    }
  }, [codeValue, email, loading, router]);

  const resend = useCallback(async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      const result = await resendSignupCode(email);
      setCooldown(result?.retry_after || 60);
      setCode(["", "", "", "", "", ""]);
      setError("");
    } catch (err: any) {
      const message = err?.message || "Could not resend the code. Try again in a moment.";
      if (err?.status === 429) {
        // Backend rate limited - use Retry-After if available
        const retryAfter = err.response?.headers?.["retry-after"];
        if (retryAfter) setCooldown(parseInt(retryAfter, 10));
      }
      setError(message);
    } finally {
      setResending(false);
    }
  }, [cooldown, email, resending]);

  const handleChange = useCallback((value: string, index: number) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      const newCode = [...code];
      newCode[index] = "";
      setCode(newCode);
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }

    const newCode = [...code];
    const chars = digits.split("");
    let currentIndex = index;

    chars.forEach((char) => {
      if (currentIndex < 6) {
        newCode[currentIndex] = char;
        currentIndex++;
      }
    });

    setCode(newCode);
    if (digits.length > 0 && currentIndex < 6) {
      inputRefs.current[currentIndex]?.focus();
    }

    if (newCode.join("").length === 6) {
      void submit();
    }
  }, [code, submit]);

  const handleKeyPress = useCallback((e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [code]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <LinearGradient
        colors={isDark ? ["#0B1220", "#0E182A", "#080E18"] : ["#F0F5FF", "#E8EFFF", "#F8FAFF"]}
        style={{ flex: 1 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Theme: ${themeLabel}. Switch to ${nextThemeLabel}.`}
          accessibilityHint="Cycles between system, light, and dark themes"
          onPress={() => void cycleTheme()}
          onFocus={() => setFocusedControl("theme")}
          onBlur={() => setFocusedControl(null)}
          onHoverIn={() => setHoveredControl("theme")}
          onHoverOut={() => setHoveredControl(null)}
          style={({ pressed }) => [
            {
              position: "absolute",
              top: insets.top + 16,
              right: insets.right + 16,
              zIndex: 10,
              minWidth: 44,
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 14,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: hoveredControl === "theme" ? colors.surfaceSunken : colors.surface,
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.35 : 0.08,
              shadowRadius: 6,
              elevation: 3,
              opacity: pressed ? 0.75 : 1,
            },
            focusRing(colors, focusedControl === "theme"),
          ]}
        >
          <ThemeIcon size={16} color={colors.primary} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary, marginLeft: 6 }}>
            {themeLabel}
          </Text>
        </Pressable>

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingTop: insets.top + 76,
            paddingBottom: insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: "100%", maxWidth: 470, padding: 24 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 28, padding: 32, borderWidth: 1, borderColor: colors.border, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 12 }, shadowOpacity: isDark ? 0.45 : 0.08, shadowRadius: 24, elevation: 8 }}>
              <View style={{ alignItems: "center", marginBottom: 28 }}>
                <View
                  style={{
                    width: 76,
                    height: 76,
                    backgroundColor: isDark ? "rgba(76, 132, 255, 0.12)" : "#EBF1FF",
                    borderRadius: 38,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1.5,
                    borderColor: isDark ? "rgba(76, 132, 255, 0.3)" : "#DBEAFE",
                    marginBottom: 12,
                    padding: 6,
                  }}
                >
                  <Image
                    source={require("../../assets/images/logo-seal.png")}
                    style={{ width: 56, height: 56 }}
                    resizeMode="contain"
                  />
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 }}>
                  Enter your code
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4, textAlign: "center" }}>
                  We sent a 6-digit code to
                </Text>
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700", marginTop: 2, textAlign: "center" }}>
                  {email}
                </Text>
              </View>

              {error ? (
                <View style={{ backgroundColor: colors.destructiveSurface, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: colors.destructiveSurfaceAlt }}>
                  <AlertCircle color={colors.destructive} size={18} />
                  <Text style={{ color: colors.destructiveText, fontWeight: "600", fontSize: 13, marginLeft: 10, flex: 1 }}>{error}</Text>
                </View>
              ) : null}

              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  {code.map((digit, index) => (
                    <View
                      key={index}
                      style={{
                        backgroundColor: colors.surfaceSunken,
                        borderRadius: 14,
                        width: 52,
                        height: 64,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1.5,
                        borderColor: error ? colors.destructive : colors.primary,
                      }}
                    >
                      <TextInput
                        ref={(el) => {
                          inputRefs.current[index] = el;
                        }}
                        style={{
                          color: colors.textPrimary,
                          fontSize: 28,
                          fontWeight: "700",
                          textAlign: "center",
                          width: 52,
                          outlineStyle: "none",
                        } as any}
                        value={digit}
                        onChangeText={(v) => handleChange(v, index)}
                        onKeyPress={(e) => handleKeyPress(e, index)}
                        keyboardType="number-pad"
                        maxLength={1}
                        autoFocus={index === 0}
                        editable={!loading}
                        returnKeyType="done"
                      />
                    </View>
                  ))}
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={loading ? "Verifying" : "Verify code"}
                accessibilityState={{ disabled: loading || codeValue.length !== 6, busy: loading }}
                style={({ pressed }) => [
                  {
                    backgroundColor: loading || codeValue.length !== 6 ? colors.surfaceSunken : colors.primary,
                    height: 52,
                    borderRadius: 14,
                    justifyContent: "center",
                    alignItems: "center",
                    opacity: pressed && !loading ? 0.88 : 1,
                  },
                  focusRing(colors, focusedControl === "submit"),
                ]}
                onPress={() => void submit()}
                onFocus={() => setFocusedControl("submit")}
                onBlur={() => setFocusedControl(null)}
                onHoverIn={() => setHoveredControl("submit")}
                onHoverOut={() => setHoveredControl(null)}
                disabled={loading || codeValue.length !== 6}
              >
                <Text style={{ color: loading || codeValue.length !== 6 ? colors.textSecondary : colors.textOnPrimary, fontWeight: "700", fontSize: 15 }}>
                  {loading ? "Verifying..." : "Verify"}
                </Text>
              </Pressable>

              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 22 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Resend code"
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: colors.surfaceSunken,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: cooldown > 0 || resending ? 0.45 : pressed ? 0.7 : 1,
                    },
                    focusRing(colors, focusedControl === "resend"),
                  ]}
                  onPress={() => void resend()}
                  onFocus={() => setFocusedControl("resend")}
                  onBlur={() => setFocusedControl(null)}
                  onHoverIn={() => setHoveredControl("resend")}
                  onHoverOut={() => setHoveredControl(null)}
                  disabled={cooldown > 0 || resending}
                >
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                    {resending ? "Resending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </Text>
                </Pressable>

                <Link href="/(auth)/login" asChild>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Use a different email"
                    style={({ pressed }) => [
                      { borderRadius: 4, opacity: pressed ? 0.7 : 1 },
                      focusRing(colors, focusedControl === "login"),
                    ]}
                    onFocus={() => setFocusedControl("login")}
                    onBlur={() => setFocusedControl(null)}
                  >
                    <Text style={{ color: colors.textTertiary, fontWeight: "600", fontSize: 13 }}>
                      Use a different email
                    </Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}
