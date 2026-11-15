import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react-native";
import { useTheme } from "../../src/contexts/ThemeContext";
import { requestSignup } from "../../src/lib/auth";
import { rememberPendingSignup } from "../../src/lib/pendingSignup";
import AuthScaffold from "../../src/components/auth/AuthScaffold";
import Alert from "../../src/components/ui/Alert";
import Button from "../../src/components/ui/Button";
import TextField from "../../src/components/ui/TextField";
import { SPACE } from "../../src/lib/tokens";

export default function RegisterScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [fullNameError, setFullNameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const isValidEmailDomain = email.trim().toLowerCase().endsWith("@lccbonline.edu.ph");
  const showEmailFormatError = email.length > 0 && !isValidEmailDomain;
  const signUpDisabled = loading || showEmailFormatError || !!emailError;

  function handleEmailChange(value: string) {
    setEmail(value);
    if (value) setEmailError("");
    setGeneralError("");
  }
  function handleFullNameChange(value: string) {
    setFullName(value);
    if (value) setFullNameError("");
    setGeneralError("");
  }
  function handlePasswordChange(value: string) {
    setPassword(value);
    if (value) setPasswordError("");
    setGeneralError("");
  }
  function handleConfirmChange(value: string) {
    setConfirmPassword(value);
    if (value) setConfirmError("");
    setGeneralError("");
  }

  async function signUpWithEmail() {
    let hasError = false;

    if (!email.trim()) {
      setEmailError("Email is required");
      hasError = true;
    } else if (!isValidEmailDomain) {
      setEmailError("Must be an @lccbonline.edu.ph address");
      hasError = true;
    }

    const trimmedFullName = fullName.trim();
    if (!trimmedFullName) {
      setFullNameError("Full name is required");
      hasError = true;
    } else if (trimmedFullName.length < 2) {
      setFullNameError("Full name must be at least 2 characters");
      hasError = true;
    } else if (trimmedFullName.length > 200) {
      setFullNameError("Full name is too long");
      hasError = true;
    }

    if (!password) {
      setPasswordError("Password is required");
      hasError = true;
    } else if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      hasError = true;
    }

    if (!confirmPassword) {
      setConfirmError("Confirm your password");
      hasError = true;
    } else if (confirmPassword !== password) {
      setConfirmError("Passwords do not match");
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);
    setGeneralError("");

    try {
      await requestSignup(email.trim().toLowerCase(), password, trimmedFullName);

      // Only a bcrypt hash is kept server-side, so the verify screen needs the
      // password again. Keep it in memory, never in route params.
      rememberPendingSignup(email, password);

      router.replace({
        pathname: "/(auth)/verify-email",
        params: { email: email.trim().toLowerCase(), flow: "signup" },
      });
    } catch (err: any) {
      setGeneralError(err?.message || "Could not create account. Try again later.");
    } finally {
      setLoading(false);
    }
  }

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
        {"Already have an account? "}
      </Text>
      <Link href="/(auth)/login" asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="Sign in to your account">
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
      title="Create your account"
      subtitle="Join the LCCB Connect campus network"
      footer={footer}
      backHref="/(auth)/login"
      backLabel="Back to sign in"
    >
      {generalError ? <Alert tone="error" message={generalError} /> : null}

      <TextField
        label="Institutional email"
        value={email}
        onChangeText={handleEmailChange}
        placeholder="student@lccbonline.edu.ph"
        keyboardType="email-address"
        autoComplete="email"
        leadingIcon={({ size, color }) => <Mail size={size} color={color} strokeWidth={2.1} />}
        error={emailError || (showEmailFormatError ? "Must use an @lccbonline.edu.ph address" : "")}
      />

      <TextField
        label="Full name"
        value={fullName}
        onChangeText={handleFullNameChange}
        placeholder="Juan Dela Cruz"
        autoCapitalize="words"
        autoComplete="name"
        leadingIcon={({ size, color }) => <User size={size} color={color} strokeWidth={2.1} />}
        error={fullNameError}
      />

      <TextField
        label="Password"
        value={password}
        onChangeText={handlePasswordChange}
        placeholder="At least 8 characters"
        secureTextEntry={!showPassword}
        autoComplete="new-password"
        leadingIcon={({ size, color }) => <Lock size={size} color={color} strokeWidth={2.1} />}
        error={passwordError}
        hint="Use at least 8 characters"
        right={eyeToggle}
      />

      <TextField
        label="Confirm password"
        value={confirmPassword}
        onChangeText={handleConfirmChange}
        placeholder="Re-enter your password"
        secureTextEntry={!showPassword}
        autoComplete="new-password"
        returnKeyType="done"
        onSubmitEditing={() => void signUpWithEmail()}
        leadingIcon={({ size, color }) => <Lock size={size} color={color} strokeWidth={2.1} />}
        error={confirmError}
        right={eyeToggle}
      />

      <Button
        label={loading ? "Creating account..." : "Create account"}
        onPress={() => void signUpWithEmail()}
        loading={loading}
        disabled={signUpDisabled}
        fullWidth
        size="lg"
      />
    </AuthScaffold>
  );
}
