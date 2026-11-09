import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image, Pressable } from "react-native";
import { useState } from "react";
import { supabase } from "../../src/lib/supabase";
import { Link, useRouter } from "expo-router";
import { AlertCircle, Sun, Moon, Monitor } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/contexts/ThemeContext";
import { focusRing } from "../../src/lib/tokens";

/**
 * Plan §5 Phase 2.3: email field → resetPasswordForEmail → always navigate to
 * the reset screen with "If that address exists, a code is on its way."
 * Never branch on the response, so an unknown address is not confirmed.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors, isDark, preference, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | null>(null);
  const [hoveredControl, setHoveredControl] = useState<string | null>(null);
  const [focusedControl, setFocusedControl] = useState<string | null>(null);

  const isValidEmailDomain = email.trim().toLowerCase().endsWith("@lccbonline.edu.ph");
  const showEmailFormatError = email.length > 0 && !isValidEmailDomain;

  const themeLabel = preference === "system" ? "System" : preference === "light" ? "Light" : "Dark";
  const nextTheme = preference === "light" ? "dark" : preference === "dark" ? "system" : "light";
  const nextThemeLabel = nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1);
  const ThemeIcon = preference === "system" ? Monitor : preference === "light" ? Sun : Moon;

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
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: "",
      });
    } catch {
      // Network failure: stay put and say so, but do not reveal account state.
      setError("Could not send the code. Try again in a moment.");
      setLoading(false);
      return;
    }

    // Supabase returns a stub success for unknown addresses too; the next
    // screen makes that explicit instead of confirming anything.
    router.replace({
      pathname: "/(auth)/reset-password",
      params: { email: email.trim().toLowerCase(), notice: "If that address exists, a code is on its way." },
    });
    setLoading(false);
  }

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
                  Reset password
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4, textAlign: "center" }}>
                  We will email you a 6-digit code
                </Text>
              </View>

              {error ? (
                <View style={{ backgroundColor: colors.destructiveSurface, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: colors.destructiveSurfaceAlt }}>
                  <AlertCircle color={colors.destructive} size={18} />
                  <Text style={{ color: colors.destructiveText, fontWeight: "600", fontSize: 13, marginLeft: 10, flex: 1 }}>{error}</Text>
                </View>
              ) : null}

              <View style={{ marginBottom: 28 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginLeft: 4 }}>Institutional Email</Text>
                <View
                  style={{
                    backgroundColor: colors.surfaceSunken,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    height: 52,
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1.5,
                    borderColor: showEmailFormatError ? colors.destructive : (focusedField === "email" ? colors.primary : colors.border)
                  }}
                >
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: "500", outlineStyle: "none" } as any}
                    placeholder="student@lccbonline.edu.ph"
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      if (v) setError("");
                    }}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    returnKeyType="done"
                    onSubmitEditing={requestResetCode}
                  />
                </View>
                {showEmailFormatError ? (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginLeft: 4 }}>
                    <AlertCircle color={colors.warning} size={14} />
                    <Text style={{ color: colors.warningText, fontSize: 12, marginLeft: 4, fontWeight: "600" }}>
                      Must use an @lccbonline.edu.ph address
                    </Text>
                  </View>
                ) : null}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={loading ? "Sending code" : "Send code"}
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
                  focusRing(colors, focusedControl === "send"),
                ]}
                onPress={requestResetCode}
                onFocus={() => setFocusedControl("send")}
                onBlur={() => setFocusedControl(null)}
                onHoverIn={() => setHoveredControl("send")}
                onHoverOut={() => setHoveredControl(null)}
                disabled={loading}
              >
                <Text style={{ color: loading ? colors.textSecondary : colors.textOnPrimary, fontWeight: "700", fontSize: 15 }}>
                  {loading ? "Sending..." : "Send code"}
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
