import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, Pressable, useWindowDimensions } from "react-native";
import { useState } from "react";
import { Link, useRouter, useLocalSearchParams } from "expo-router";
import { Eye, EyeOff, AlertCircle, Sun, Moon, Monitor, Globe } from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { signInWithIdentifier, signInWithGoogle, completeMfaChallenge, type MfaChallengeResponse } from "../../src/lib/auth";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { focusRing } from "../../src/lib/tokens";

export default function LoginScreen() {
  const { signInAsGuest, authNotice, clearAuthNotice } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ success?: string }>();
  const successMessage = params.success || "";
  const { colors, isDark, preference, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | "mfa" | null>(null);
  const [hoveredControl, setHoveredControl] = useState<string | null>(null);
  const [focusedControl, setFocusedControl] = useState<string | null>(null);

  // MFA Challenge state
  const [showMfaChallenge, setShowMfaChallenge] = useState(false);
  const [mfaChallengeToken, setMfaChallengeToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaCodeError, setMfaCodeError] = useState("");

  // Validation States
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");

  // A session ended because the account no longer exists (deleted by an
  // administrator). Shown until the user starts another attempt.
  const errorMessage = generalError || authNotice || "";

  const trimmedIdentifier = email.trim();
  // Identifier types: email (@), student ID (regex digits-digits), or username
  const identifierIsEmail = trimmedIdentifier.includes("@");
  const isValidEmailDomain = identifierIsEmail && trimmedIdentifier.toLowerCase().endsWith("@lccbonline.edu.ph");
  const isValidStudentId = !identifierIsEmail && /^\d{4}-\d{4,}$/.test(trimmedIdentifier);
  const isValidUsername = !identifierIsEmail && !isValidStudentId && /^[a-zA-Z0-9_]{3,30}$/.test(trimmedIdentifier);
  const showEmailFormatError = trimmedIdentifier.length > 0 && !isValidEmailDomain && !isValidStudentId && !isValidUsername;

  const themeLabel = preference === "system" ? "System" : preference === "light" ? "Light" : "Dark";
  const nextTheme = preference === "light" ? "dark" : preference === "dark" ? "system" : "light";
  const nextThemeLabel = nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1);
  const ThemeIcon = preference === "system" ? Monitor : preference === "light" ? Sun : Moon;
  const signInHovered = hoveredControl === "signIn" && !loading;
    const guestHovered = hoveredControl === "guest";
    const googleHovered = hoveredControl === "google";
    const createHovered = hoveredControl === "create";

    async function signInWithGoogleHandler() {
        setLoading(true);
        setGeneralError("");
        clearAuthNotice();

        try {
          // Dynamic import to avoid breaking Expo Go (requires dev build)
          const { GoogleSignin } = await import("@react-native-google-signin/google-signin");

          // Check if Google Play services are available
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

          // Configure Google Sign-In (web client ID needed for ID token)
          // This should match the Google Cloud project's web client ID
          GoogleSignin.configure({
            webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
            offlineAccess: true, // Request ID token
          });

          const response = await GoogleSignin.signIn();

          // Check if sign-in was successful
          if (response.type !== "success" || !response.data?.idToken) {
            throw new Error("No ID token received from Google");
          }

          await signInWithGoogle(response.data.idToken);
        } catch (err: any) {
          // User cancelled the sign-in
          if (err.code === "SIGN_IN_CANCELLED") {
            setLoading(false);
            return;
          }
          // Play services not available
          if (err.code === "PLAY_SERVICES_NOT_AVAILABLE") {
            setGeneralError("Google Play Services not available. Please update.");
            return;
          }
          const message = err?.message || "Google sign-in failed. Try again.";
          setGeneralError(message);
        } finally {
          setLoading(false);
        }
      }

    function handleEmailChange(value: string) {
    setEmail(value);
    if (value) setEmailError("");
    setGeneralError("");
    clearAuthNotice();
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (value) setPasswordError("");
    setGeneralError("");
    clearAuthNotice();
  }

  async function signInWithEmail() {
    let hasError = false;
    if (!email.trim()) {
      setEmailError("Email, student ID, or username is required");
      hasError = true;
    } else if (!isValidEmailDomain && !isValidStudentId && !isValidUsername) {
      setEmailError("Must be an @lccbonline.edu.ph address, student ID (e.g. 2023-00123), or username");
      hasError = true;
    }

    if (!password) {
      setPasswordError("Password is required");
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);
    setGeneralError("");
    clearAuthNotice();

    try {
      const result = await signInWithIdentifier(trimmedIdentifier, password);
      // Check if MFA is required (result is MfaChallengeResponse, not void)
      if (result && typeof result === "object" && "mfa_required" in result) {
        // MFA required - show challenge screen
        setMfaChallengeToken(result.challenge_token);
        setShowMfaChallenge(true);
        setFocusedField("mfa");
        setLoading(false);
        return;
      }
      // No MFA required - session already installed
    } catch (err: any) {
      const message = err?.message || "Invalid email, student ID, or password";
      // "Email not confirmed" is a distinct state — tell the user what to do.
      if (/not confirmed|not_confirmed/i.test(message)) {
        setGeneralError("Confirm your email first");
        return;
      }
      setGeneralError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaChallenge() {
    if (!mfaCode.trim()) {
      setMfaCodeError("Enter the 6-digit code from your authenticator app");
      return;
    }
    if (!/^\d{6}$/.test(mfaCode.trim())) {
      setMfaCodeError("Code must be 6 digits");
      return;
    }

    setLoading(true);
    setMfaCodeError("");

    try {
      await completeMfaChallenge(mfaChallengeToken, mfaCode.trim());
      // Success - session installed, navigation will happen via AuthContext
    } catch (err: any) {
      const message = err?.message || "Invalid code";
      setMfaCodeError(message);
    } finally {
      setLoading(false);
    }
  }

  function cancelMfaChallenge() {
    setShowMfaChallenge(false);
    setMfaChallengeToken("");
    setMfaCode("");
    setMfaCodeError("");
    setFocusedField(null);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <LinearGradient 
        colors={isDark ? ["#0B1220", "#0E182A", "#080E18"] : ["#F0F5FF", "#E8EFFF", "#F8FAFF"]} 
        style={{ flex: 1 }}
      >
        {/* Viewport-level theme control, independent of the centered form column */}
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

          <View style={{ width: "100%", maxWidth: isLandscape ? 640 : 470, padding: isLandscape ? 16 : 24 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 28, padding: isLandscape ? 24 : 32, borderWidth: 1, borderColor: colors.border, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 12 }, shadowOpacity: isDark ? 0.45 : 0.08, shadowRadius: 24, elevation: 8 }}>

              {/* Header Official Seal & App Name */}
              <View style={{ alignItems: "center", marginBottom: isLandscape ? 16 : 28 }}>
                <View 
                  style={{ 
                    width: isLandscape ? 64 : 86, 
                    height: isLandscape ? 64 : 86, 
                    backgroundColor: isDark ? "rgba(76, 132, 255, 0.12)" : "#EBF1FF", 
                    borderRadius: isLandscape ? 32 : 43, 
                    alignItems: "center", 
                    justifyContent: "center", 
                    borderWidth: 1.5,
                    borderColor: isDark ? "rgba(76, 132, 255, 0.3)" : "#DBEAFE",
                    shadowColor: colors.primary, 
                    shadowOffset: { width: 0, height: 4 }, 
                    shadowOpacity: 0.2, 
                    shadowRadius: 10, 
                    elevation: 4, 
                    marginBottom: isLandscape ? 10 : 14,
                    padding: isLandscape ? 4 : 8,
                  }}
                >
                  <Image 
                    source={require("../../assets/images/logo-seal.png")} 
                    style={{ width: isLandscape ? 48 : 66, height: isLandscape ? 48 : 66 }} 
                    resizeMode="contain" 
                  />
                </View>

                {/* Academic Institution Tag */}
                <View 
                  style={{ 
                    paddingHorizontal: 12, 
                    paddingVertical: 4, 
                    borderRadius: 12, 
                    backgroundColor: isDark ? "rgba(76, 132, 255, 0.1)" : "#EBF1FF", 
                    borderWidth: 1, 
                    borderColor: isDark ? "rgba(76, 132, 255, 0.2)" : "#DBEAFE",
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary, letterSpacing: 1.2, textTransform: "uppercase" }}>
                    La Consolacion College Bacolod
                  </Text>
                </View>

                <Text style={{ color: colors.textPrimary, fontSize: isLandscape ? 22 : 26, fontWeight: "800", letterSpacing: -0.5 }}>
                  Welcome
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4, textAlign: "center" }}>
                  Sign in to LCCB Connect
                </Text>
              </View>

              {successMessage ? (
                <View style={{ backgroundColor: colors.successSurface, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: colors.successSurfaceAlt }}>
                  <AlertCircle color={colors.success} size={18} />
                  <Text style={{ color: colors.successText, fontWeight: "600", fontSize: 13, marginLeft: 10 }}>{successMessage}</Text>
                </View>
              ) : null}

              {errorMessage ? (
                <View style={{ backgroundColor: colors.destructiveSurface, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: colors.destructiveSurfaceAlt }}>
                  <AlertCircle color={colors.destructive} size={18} />
                  <Text style={{ color: colors.destructiveText, fontWeight: "600", fontSize: 13, marginLeft: 10, flex: 1 }}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Email, Student ID, or Username Input */}
              <View style={{ marginBottom: 18 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginLeft: 4 }}>Email, Student ID, or Username</Text>
                <View 
                  style={{ 
                    backgroundColor: colors.surfaceSunken, 
                    borderRadius: 14, 
                    paddingHorizontal: 16, 
                    height: 52, 
                    flexDirection: "row", 
                    alignItems: "center", 
                    borderWidth: 1.5, 
                    borderColor: (showEmailFormatError || emailError) 
                      ? colors.destructive 
                      : (focusedField === "email" ? colors.primary : colors.border) 
                  }}
                >
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: "500", outlineStyle: "none" } as any}
                    placeholder="student@lccbonline.edu.ph, 2023-00123, or username"
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={handleEmailChange}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    keyboardType={identifierIsEmail ? "email-address" : "default"}
                  />
                </View>
                {(emailError || showEmailFormatError) ? (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginLeft: 4 }}>
                    <AlertCircle color={colors.warning} size={14} />
                    <Text style={{ color: colors.warningText, fontSize: 12, marginLeft: 4, fontWeight: "600" }}>{emailError || "Must be an @lccbonline.edu.ph address or a 4-20 char student ID"}</Text>
                  </View>
                ) : null}
              </View>

              {/* Password Input */}
              <View style={{ marginBottom: 22 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginLeft: 4 }}>Password</Text>
                <View 
                  style={{ 
                    backgroundColor: colors.surfaceSunken, 
                    borderRadius: 14, 
                    paddingHorizontal: 16, 
                    height: 52, 
                    flexDirection: "row", 
                    alignItems: "center", 
                    borderWidth: 1.5, 
                    borderColor: passwordError 
                      ? colors.destructive 
                      : (focusedField === "password" ? colors.primary : colors.border) 
                  }}
                >
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: "500", outlineStyle: "none" } as any}
                    placeholder="••••••••••••"
                    placeholderTextColor={colors.textTertiary}
                    value={password}
                    onChangeText={handlePasswordChange}
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
                {passwordError ? (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginLeft: 4 }}>
                    <AlertCircle color={colors.warning} size={14} />
                    <Text style={{ color: colors.warningText, fontSize: 12, marginLeft: 4, fontWeight: "600" }}>{passwordError}</Text>
                  </View>
                ) : null}
                <TouchableOpacity style={{ alignSelf: "flex-end", marginTop: 10 }} onPress={() => router.push("/(auth)/forgot-password")}>
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12 }}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

            {showMfaChallenge && (
              <View style={{ marginBottom: 22 }}>
                <View style={{ backgroundColor: colors.infoSurface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                    <View style={{ backgroundColor: colors.info, borderRadius: 8, padding: 8, marginRight: 12 }}>
                      <Text style={{ color: colors.textOnPrimary, fontSize: 16 }}>🔐</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 15 }}>Multi-Factor Authentication</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                        Enter the 6-digit code from your authenticator app
                      </Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: 14, paddingHorizontal: 16, height: 52, flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: mfaCodeError ? colors.destructive : (focusedField === "mfa" ? colors.primary : colors.border) }}>
                    <TextInput
                      style={{ flex: 1, color: colors.textPrimary, fontSize: 18, fontWeight: "600", letterSpacing: 8, textAlign: "center", outlineStyle: "none" } as any}
                      placeholder="000000"
                      placeholderTextColor={colors.textTertiary}
                      value={mfaCode}
                      onChangeText={(value) => {
                        setMfaCode(value.replace(/\D/g, "").slice(0, 6));
                        if (value) setMfaCodeError("");
                      }}
                      onFocus={() => setFocusedField("mfa")}
                      onBlur={() => setFocusedField(null)}
                      autoCapitalize="none"
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  {mfaCodeError ? (
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginLeft: 4 }}>
                      <AlertCircle color={colors.warning} size={14} />
                      <Text style={{ color: colors.warningText, fontSize: 12, marginLeft: 4, fontWeight: "600" }}>{mfaCodeError}</Text>
                    </View>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={loading ? "Verifying..." : "Verify code"}
                  accessibilityState={{ disabled: loading, busy: loading }}
                  style={({ pressed }) => [
                    {
                      backgroundColor: loading ? colors.surfaceSunken : colors.primary,
                      height: 52,
                      borderRadius: 14,
                      flexDirection: "row",
                      justifyContent: "center",
                      alignItems: "center",
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: isDark ? 0.35 : 0.22,
                      shadowRadius: 8,
                      elevation: 4,
                      opacity: pressed && !loading ? 0.88 : 1,
                    },
                    focusRing(colors, focusedControl === "mfaVerify"),
                  ]}
                  onPress={handleMfaChallenge}
                  onFocus={() => setFocusedControl("mfaVerify")}
                  onBlur={() => setFocusedControl(null)}
                  disabled={loading}
                >
                  <Text style={{ color: loading ? colors.textSecondary : colors.textOnPrimary, fontWeight: "700", fontSize: 15 }}>
                    {loading ? "Verifying..." : "Verify Code"}
                  </Text>
                </Pressable>
                <TouchableOpacity style={{ alignSelf: "flex-end", marginTop: 10 }} onPress={cancelMfaChallenge}>
                  <Text style={{ color: colors.textTertiary, fontWeight: "600", fontSize: 12 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Sign In Button */}
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={loading ? "Signing in" : "Sign in"}
                accessibilityState={{ disabled: loading, busy: loading }}
                style={({ pressed }) => [
                  {
                    backgroundColor: loading ? colors.surfaceSunken : signInHovered ? colors.primaryHover : colors.primary,
                    height: 52,
                    borderRadius: 14,
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "center",
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: signInHovered ? 6 : 4 },
                    shadowOpacity: signInHovered ? (isDark ? 0.45 : 0.3) : (isDark ? 0.35 : 0.22),
                    shadowRadius: signInHovered ? 12 : 8,
                    elevation: signInHovered ? 6 : 4,
                    transform: [{ translateY: signInHovered ? -1 : 0 }],
                    opacity: pressed && !loading ? 0.88 : 1,
                  },
                  focusRing(colors, focusedControl === "signIn"),
                ]}
                onPress={signInWithEmail}
                onHoverIn={() => setHoveredControl("signIn")}
                onHoverOut={() => setHoveredControl(null)}
                onFocus={() => setFocusedControl("signIn")}
                onBlur={() => setFocusedControl(null)}
                disabled={loading}
              >
                <Text style={{ color: loading ? colors.textSecondary : colors.textOnPrimary, fontWeight: "700", fontSize: 15 }}>
                  {loading ? "Authenticating..." : "Sign In"}
                </Text>
              </Pressable>

              {/* Divider */}
                            <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 20 }}>
                              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                              <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: "700", textTransform: "uppercase", paddingHorizontal: 14 }}>Or</Text>
                              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                            </View>

                            {/* Google Sign-In Button */}
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Sign in with Google"
                              style={({ pressed }) => [
                                {
                                  backgroundColor: googleHovered ? colors.primarySurface : colors.surfaceSunken,
                                  height: 50,
                                  borderRadius: 14,
                                  flexDirection: "row",
                                  justifyContent: "center",
                                  alignItems: "center",
                                  borderWidth: 1,
                                  borderColor: googleHovered ? colors.primary : colors.border,
                                  transform: [{ translateY: googleHovered ? -1 : 0 }],
                                  opacity: pressed ? 0.82 : 1,
                                },
                                focusRing(colors, focusedControl === "google"),
                              ]}
                              onPress={signInWithGoogleHandler}
                              onHoverIn={() => setHoveredControl("google")}
                              onHoverOut={() => setHoveredControl(null)}
                              onFocus={() => setFocusedControl("google")}
                              onBlur={() => setFocusedControl(null)}
                              disabled={loading}
                            >
                              <Globe color={googleHovered ? colors.primary : colors.textSecondary} size={20} style={{ marginRight: 10 }} />
                              <Text style={{ color: googleHovered ? colors.primary : colors.textPrimary, fontWeight: "700", fontSize: 14 }}>Continue with Google</Text>
                            </Pressable>

                            {/* Guest Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Explore as guest"
                style={({ pressed }) => [
                  {
                    backgroundColor: guestHovered ? colors.primarySurface : colors.surfaceSunken,
                    height: 50,
                    borderRadius: 14,
                    justifyContent: "center",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: guestHovered ? colors.primary : colors.border,
                    transform: [{ translateY: guestHovered ? -1 : 0 }],
                    opacity: pressed ? 0.82 : 1,
                  },
                  focusRing(colors, focusedControl === "guest"),
                ]}
                onPress={signInAsGuest}
                onHoverIn={() => setHoveredControl("guest")}
                onHoverOut={() => setHoveredControl(null)}
                onFocus={() => setFocusedControl("guest")}
                onBlur={() => setFocusedControl(null)}
              >
                <Text style={{ color: guestHovered ? colors.primary : colors.textPrimary, fontWeight: "700", fontSize: 14 }}>Explore as Guest</Text>
              </Pressable>

              {/* Footer Link */}
              <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 22 }}>
                <Text style={{ color: colors.textTertiary, fontWeight: "500", fontSize: 13 }}>{"Don't have an account? "}</Text>
                <Link href="/(auth)/register" asChild>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Create an account"
                    onHoverIn={() => setHoveredControl("create")}
                    onHoverOut={() => setHoveredControl(null)}
                    onFocus={() => setFocusedControl("create")}
                    onBlur={() => setFocusedControl(null)}
                    style={({ pressed }) => [
                      { borderRadius: 4, opacity: pressed ? 0.7 : 1 },
                      focusRing(colors, focusedControl === "create"),
                    ]}
                  >
                    <Text style={{
                      color: createHovered ? colors.primaryHover : colors.primary,
                      fontWeight: "700",
                      fontSize: 13,
                      textDecorationLine: createHovered ? "underline" : "none",
                    }}>Create one</Text>
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