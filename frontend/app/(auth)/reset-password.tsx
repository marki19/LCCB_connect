import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image, Pressable } from "react-native";
import { useState } from "react";
import { supabase } from "../../src/lib/supabase";
import { Link, useRouter, useLocalSearchParams } from "expo-router";
import { Eye, EyeOff, AlertCircle, Sun, Moon, Monitor } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/contexts/ThemeContext";
import { focusRing } from "../../src/lib/tokens";

/**
 * Plan §5 Phase 2.4: fields are code, new password, confirm.
 * Submit → verifyOtp({ email, token, type: "recovery" }) → updateUser({ password })
 * → signOut() → login with a one-line success message.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; notice?: string }>();
  const email = (params.email || "").trim().toLowerCase();
  const notice = params.notice || "";
  const { colors, isDark, preference, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<"code" | "password" | "confirm" | null>(null);
  const [hoveredControl, setHoveredControl] = useState<string | null>(null);
  const [focusedControl, setFocusedControl] = useState<string | null>(null);

  const themeLabel = preference === "system" ? "System" : preference === "light" ? "Light" : "Dark";
  const nextTheme = preference === "light" ? "dark" : preference === "dark" ? "system" : "light";
  const nextThemeLabel = nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1);
  const ThemeIcon = preference === "system" ? Monitor : preference === "light" ? Sun : Moon;

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
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "recovery",
      });
      if (verifyError) {
        setError("That code is wrong or expired.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Drop the recovery session; the student signs in with the new password.
      await supabase.auth.signOut();
      router.replace({
        pathname: "/(auth)/login",
        params: { success: "Password updated. Sign in with your new password." },
      });
    } catch {
      setError("Something went wrong. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  }

  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length > 0) setError("");
  };

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
                <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "800", textAlign: "center", letterSpacing: -0.5 }}>
                  New password
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4, textAlign: "center" }}>
                  {notice}
                </Text>
              </View>

              {error ? (
                <View style={{ backgroundColor: colors.destructiveSurface, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: colors.destructiveSurfaceAlt }}>
                  <AlertCircle color={colors.destructive} size={18} />
                  <Text style={{ color: colors.destructiveText, fontWeight: "600", fontSize: 13, marginLeft: 10, flex: 1 }}>{error}</Text>
                </View>
              ) : null}

              {/* Code Input */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginLeft: 4 }}>Code</Text>
                <View
                  style={{
                    backgroundColor: colors.surfaceSunken,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    height: 52,
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1.5,
                    borderColor: focusedField === "code" ? colors.primary : colors.border,
                  }}
                >
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 18, fontWeight: "700", letterSpacing: 6, outlineStyle: "none" } as any}
                    placeholder="000000"
                    placeholderTextColor={colors.textTertiary}
                    value={code}
                    onChangeText={handleCodeChange}
                    onFocus={() => setFocusedField("code")}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                </View>
              </View>

              {/* New Password Input */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginLeft: 4 }}>New Password</Text>
                <View
                  style={{
                    backgroundColor: colors.surfaceSunken,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    height: 52,
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1.5,
                    borderColor: focusedField === "password" ? colors.primary : colors.border,
                  }}
                >
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: "500", outlineStyle: "none" } as any}
                    placeholder="At least 8 characters"
                    placeholderTextColor={colors.textTertiary}
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      if (v) setError("");
                    }}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showPassword}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    onPress={() => setShowPassword(!showPassword)}
                    onHoverIn={() => setHoveredControl("password")}
                    onHoverOut={() => setHoveredControl(null)}
                    onFocus={() => setFocusedControl("password")}
                    onBlur={() => setFocusedControl(null)}
                    style={({ pressed }) => [
                      {
                        width: 44,
                        height: 44,
                        marginRight: -9,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 22,
                        backgroundColor: hoveredControl === "password" ? colors.hoverOverlay : "transparent",
                        opacity: pressed ? 0.6 : 1,
                      },
                      focusRing(colors, focusedControl === "password"),
                    ]}
                  >
                    {showPassword
                      ? <EyeOff color={hoveredControl === "password" ? colors.primary : colors.textTertiary} size={18} />
                      : <Eye color={hoveredControl === "password" ? colors.primary : colors.textTertiary} size={18} />}
                  </Pressable>
                </View>
              </View>

              {/* Confirm Password Input */}
              <View style={{ marginBottom: 28 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginLeft: 4 }}>Confirm Password</Text>
                <View
                  style={{
                    backgroundColor: colors.surfaceSunken,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    height: 52,
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1.5,
                    borderColor: focusedField === "confirm" ? colors.primary : colors.border,
                  }}
                >
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: "500", outlineStyle: "none" } as any}
                    placeholder="••••••••••••"
                    placeholderTextColor={colors.textTertiary}
                    value={confirm}
                    onChangeText={(v) => {
                      setConfirm(v);
                      if (v) setError("");
                    }}
                    onFocus={() => setFocusedField("confirm")}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={() => void submit()}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    onPress={() => setShowPassword(!showPassword)}
                    onHoverIn={() => setHoveredControl("password")}
                    onHoverOut={() => setHoveredControl(null)}
                    onFocus={() => setFocusedControl("password")}
                    onBlur={() => setFocusedControl(null)}
                    style={({ pressed }) => [
                      {
                        width: 44,
                        height: 44,
                        marginRight: -9,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 22,
                        backgroundColor: hoveredControl === "password" ? colors.hoverOverlay : "transparent",
                        opacity: pressed ? 0.6 : 1,
                      },
                      focusRing(colors, focusedControl === "password"),
                    ]}
                  >
                    {showPassword
                      ? <EyeOff color={hoveredControl === "password" ? colors.primary : colors.textTertiary} size={18} />
                      : <Eye color={hoveredControl === "password" ? colors.primary : colors.textTertiary} size={18} />}
                  </Pressable>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={loading ? "Updating password" : "Update password"}
                accessibilityState={{ disabled: loading, busy: loading }}
                style={({ pressed }) => [
                  {
                    backgroundColor: loading ? colors.surfaceSunken : colors.primary,
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
                disabled={loading}
              >
                <Text style={{ color: loading ? colors.textSecondary : colors.textOnPrimary, fontWeight: "700", fontSize: 15 }}>
                  {loading ? "Updating..." : "Update password"}
                </Text>
              </Pressable>

              <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 22 }}>
                <Link href="/(auth)/login" asChild>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Back to sign in"
                    style={({ pressed }) => [{ borderRadius: 4, opacity: pressed ? 0.7 : 1 }]}
                    onFocus={() => setFocusedControl("login")}
                    onBlur={() => setFocusedControl(null)}
                  >
                    <Text style={{ color: colors.textTertiary, fontWeight: "600", fontSize: 13 }}>
                      Back to sign in
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
