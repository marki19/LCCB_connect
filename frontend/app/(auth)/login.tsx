import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, useRouter, useLocalSearchParams } from "expo-router";
import { AtSign, Eye, EyeOff, Globe, KeyRound, Lock, ShieldCheck } from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import {
  signInWithIdentifier,
  signInWithGoogle,
  completeMfaChallenge,
} from "../../src/lib/auth";
import AuthScaffold from "../../src/components/auth/AuthScaffold";
import Alert from "../../src/components/ui/Alert";
import Button from "../../src/components/ui/Button";
import TextField from "../../src/components/ui/TextField";
import { RADIUS, SPACE } from "../../src/lib/tokens";

function Divider() {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginVertical: SPACE.x5 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
      <Text
        style={{
          color: colors.textTertiary,
          fontSize: 11,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 0.8,
          paddingHorizontal: SPACE.x3,
        }}
      >
        or
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
    </View>
  );
}

export default function LoginScreen() {
  const { signInAsGuest, authNotice, clearAuthNotice } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ success?: string }>();
  const successMessage = params.success || "";
  const { colors } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
  const identifierIsEmail = trimmedIdentifier.includes("@");
  const isValidEmailDomain =
    identifierIsEmail && trimmedIdentifier.toLowerCase().endsWith("@lccbonline.edu.ph");
  const isValidStudentId = !identifierIsEmail && /^\d{4}-\d{4,}$/.test(trimmedIdentifier);
  const isValidUsername =
    !identifierIsEmail && !isValidStudentId && /^[a-zA-Z0-9_]{3,30}$/.test(trimmedIdentifier);
  const showEmailFormatError =
    trimmedIdentifier.length > 0 && !isValidEmailDomain && !isValidStudentId && !isValidUsername;

  async function signInWithGoogleHandler() {
    setLoading(true);
    setGeneralError("");
    clearAuthNotice();

    try {
      // Dynamic import to avoid breaking Expo Go (requires dev build)
      const { GoogleSignin } = await import("@react-native-google-signin/google-signin");

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        offlineAccess: true,
      });

      const response = await GoogleSignin.signIn();

      if (response.type !== "success" || !response.data?.idToken) {
        throw new Error("No ID token received from Google");
      }

      await signInWithGoogle(response.data.idToken);
    } catch (err: any) {
      if (err.code === "SIGN_IN_CANCELLED") {
        setLoading(false);
        return;
      }
      if (err.code === "PLAY_SERVICES_NOT_AVAILABLE") {
        setGeneralError("Google Play Services not available. Please update.");
        return;
      }
      setGeneralError(err?.message || "Google sign-in failed. Try again.");
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
      setEmailError("Use an @lccbonline.edu.ph address, a student ID, or a username");
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
      if (result && typeof result === "object" && "mfa_required" in result) {
        setMfaChallengeToken(result.challenge_token);
        setShowMfaChallenge(true);
        setLoading(false);
        return;
      }
    } catch (err: any) {
      const message = err?.message || "Invalid email, student ID, or password";
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
    } catch (err: any) {
      setMfaCodeError(err?.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  function cancelMfaChallenge() {
    setShowMfaChallenge(false);
    setMfaChallengeToken("");
    setMfaCode("");
    setMfaCodeError("");
  }

  const footer = (
    <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
      <Text style={{ color: colors.textTertiary, fontWeight: "500", fontSize: 13 }}>
        {"New to LCCB Connect? "}
      </Text>
      <Link href="/(auth)/register" asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="Create an account">
          {({ pressed }) => (
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13, opacity: pressed ? 0.7 : 1 }}>
              Create an account
            </Text>
          )}
        </Pressable>
      </Link>
    </View>
  );

  return (
    <AuthScaffold title="Welcome back" subtitle="Sign in to LCCB Connect" footer={footer}>
      {successMessage ? <Alert tone="success" message={successMessage} /> : null}
      {errorMessage ? <Alert tone="error" message={errorMessage} /> : null}

      {showMfaChallenge ? (
        <View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.infoSurface,
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: colors.border,
              padding: SPACE.x3,
              marginBottom: SPACE.x4,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: RADIUS.sm,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
                marginRight: SPACE.x3,
              }}
            >
              <ShieldCheck size={18} color={colors.info} strokeWidth={2.2} />
            </View>
            <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
              Two-factor authentication is on. Enter the 6-digit code from your authenticator app.
            </Text>
          </View>

          <TextField
            label="Authentication code"
            value={mfaCode}
            onChangeText={(value) => {
              setMfaCode(value.replace(/\D/g, "").slice(0, 6));
              if (value) setMfaCodeError("");
            }}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            leadingIcon={({ size, color }) => <KeyRound size={size} color={color} strokeWidth={2.1} />}
            inputStyle={{ letterSpacing: 8, textAlign: "center", fontWeight: "700", fontSize: 18 }}
            error={mfaCodeError}
            onSubmitEditing={() => void handleMfaChallenge()}
          />

          <Button
            label={loading ? "Verifying..." : "Verify code"}
            onPress={() => void handleMfaChallenge()}
            loading={loading}
            disabled={loading}
            fullWidth
            size="lg"
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel verification"
            onPress={cancelMfaChallenge}
            style={({ pressed }) => ({ alignSelf: "center", marginTop: SPACE.x4, opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ color: colors.textTertiary, fontWeight: "600", fontSize: 13 }}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <TextField
            label="Email, student ID, or username"
            value={email}
            onChangeText={handleEmailChange}
            placeholder="student@lccbonline.edu.ph"
            keyboardType={identifierIsEmail ? "email-address" : "default"}
            autoComplete="username"
            leadingIcon={({ size, color }) => <AtSign size={size} color={color} strokeWidth={2.1} />}
            error={emailError || (showEmailFormatError ? "Must be an @lccbonline.edu.ph address, a student ID, or a username" : "")}
          />

          {/* Academic Institution Tag */}
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 12,
              backgroundColor: colors.primarySurface,
              borderWidth: 1,
              borderColor: colors.primary,
              marginBottom: SPACE.x4,
              alignSelf: "center",
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary, letterSpacing: 1.2, textTransform: "uppercase" }}>
              La Consolacion College Bacolod
            </Text>
          </View>

          <TextField
            label="Password"
            value={password}
            onChangeText={handlePasswordChange}
            placeholder="Enter your password"
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={() => void signInWithEmail()}
            leadingIcon={({ size, color }) => <Lock size={size} color={color} strokeWidth={2.1} />}
            error={passwordError}
            right={
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
            }
          />

          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Forgot password"
            onPress={() => router.push("/(auth)/forgot-password")}
            style={({ pressed }) => ({ alignSelf: "flex-end", marginTop: -SPACE.x2, marginBottom: SPACE.x5, opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Forgot password?</Text>
          </Pressable>

          <Button
            label={loading ? "Signing in..." : "Sign in"}
            onPress={() => void signInWithEmail()}
            loading={loading}
            disabled={loading}
            fullWidth
            size="lg"
          />

          <Divider />

          <Button
            label="Continue with Google"
            variant="secondary"
            icon={Globe}
            onPress={() => void signInWithGoogleHandler()}
            disabled={loading}
            fullWidth
            size="lg"
          />

          <View style={{ height: SPACE.x3 }} />

          <Button
            label="Explore as guest"
            variant="ghost"
            onPress={signInAsGuest}
            disabled={loading}
            fullWidth
            size="lg"
          />
        </View>
      )}
    </AuthScaffold>
  );
}
