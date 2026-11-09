import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Image, Pressable, useWindowDimensions } from "react-native";
import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useRouter, useLocalSearchParams } from "expo-router";
import { AlertCircle, Sun, Moon, Monitor } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/contexts/ThemeContext";
import { focusRing } from "../../src/lib/tokens";
import { verifySignupCode, resendSignupCode } from "../../src/lib/auth";
import { peekPendingSignup, clearPendingSignup } from "../../src/lib/pendingSignup";
import { OtpInput, type OtpInputHandle } from "../../src/components/OtpInput";

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
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isMobile = width < 480;

  const [codeValue, setCodeValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [focusedControl, setFocusedControl] = useState<string | null>(null);
  const [hoveredControl, setHoveredControl] = useState<string | null>(null);
  const otpRef = useRef<OtpInputHandle>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const themeLabel = preference === "system" ? "System" : preference === "light" ? "Light" : "Dark";
  const nextTheme = preference === "light" ? "dark" : preference === "dark" ? "system" : "light";
  const nextThemeLabel = nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1);
  const ThemeIcon = preference === "system" ? Monitor : preference === "light" ? Sun : Moon;

  const submit = useCallback(async (value: string = codeValue) => {
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
  }, [codeValue, email, loading, router]);

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
        // Backend rate limited - use Retry-After if available
        const retryAfter = err.response?.headers?.["retry-after"];
        if (retryAfter) setCooldown(parseInt(retryAfter, 10));
      }
      setError(message);
    } finally {
      setResending(false);
    }
  }, [cooldown, email, resending]);

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
            paddingTop: isLandscape ? insets.top + 32 : insets.top + 76,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: isLandscape ? 32 : 0,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: "100%", maxWidth: isLandscape ? 520 : 420, padding: isLandscape ? 16 : 24 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 28, padding: isLandscape ? 24 : 32, borderWidth: 1, borderColor: colors.border, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 12 }, shadowOpacity: isDark ? 0.45 : 0.08, shadowRadius: 24, elevation: 8 }}>
              <View style={{ alignItems: "center", marginBottom: isLandscape ? 16 : 28 }}>
                <View
                  style={{
                    width: isLandscape ? 60 : 76,
                    height: isLandscape ? 60 : 76,
                    backgroundColor: isDark ? "rgba(76, 132, 255, 0.12)" : "#EBF1FF",
                    borderRadius: isLandscape ? 30 : 38,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1.5,
                    borderColor: isDark ? "rgba(76, 132, 255, 0.3)" : "#DBEAFE",
                    marginBottom: isLandscape ? 8 : 12,
                    padding: isLandscape ? 4 : 6,
                  }}
                >
                  <Image
                    source={require("../../assets/images/logo-seal.png")}
                    style={{ width: isLandscape ? 44 : 56, height: isLandscape ? 44 : 56 }}
                    resizeMode="contain"
                  />
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: isLandscape ? 20 : 24, fontWeight: "800", letterSpacing: -0.5 }}>
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

                                                  <Pressable
                accessibilityRole="button"
                accessibilityLabel={loading ? "Verifying" : "Verify code"}
                accessibilityState={{ disabled: loading || codeValue.length !== 6, busy: loading }}
                style={({ pressed }) => [
                  {
                    backgroundColor: loading || codeValue.length !== 6 ? colors.surfaceSunken : colors.primary,
                    height: isMobile ? 48 : 52,
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
                <Text style={{ color: loading || codeValue.length !== 6 ? colors.textSecondary : colors.textOnPrimary, fontWeight: "700", fontSize: isMobile ? 14 : 15 }}>
                  {loading ? "Verifying..." : "Verify"}
                </Text>
              </Pressable>

              <View style={{ flexDirection: "row", justifyContent: "center", marginTop: isMobile ? 18 : 22, gap: 12, flexWrap: "wrap" }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Resend code"
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: colors.surfaceSunken,
                      paddingHorizontal: isMobile ? 12 : 14,
                      paddingVertical: isMobile ? 8 : 10,
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
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: isMobile ? 12 : 13 }}>
                    {resending ? "Resending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </Text>
                </Pressable>

                <Link href="/(auth)/login" asChild>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Use a different email"
                    style={({ pressed }) => [
                      {
                        backgroundColor: "transparent",
                        paddingHorizontal: isMobile ? 12 : 14,
                        paddingVertical: isMobile ? 8 : 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.primary,
                        opacity: pressed ? 0.7 : 1,
                      },
                      focusRing(colors, focusedControl === "login"),
                    ]}
                    onFocus={() => setFocusedControl("login")}
                    onBlur={() => setFocusedControl(null)}
                    onHoverIn={() => setHoveredControl("login")}
                    onHoverOut={() => setHoveredControl(null)}
                  >
                    <Text style={{ color: colors.primary, fontWeight: "700", fontSize: isMobile ? 12 : 13 }}>
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
