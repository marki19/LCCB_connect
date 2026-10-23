import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image, Pressable } from "react-native";
import { useState, useEffect } from "react";
import { supabase } from "../../src/lib/supabase";
import { Link, useRouter } from "expo-router";
import { Eye, EyeOff, AlertCircle, Sun, Moon, Monitor } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "../../src/lib/api";
import SelectField from "../../src/components/SelectField";
import { useTheme } from "../../src/contexts/ThemeContext";
import { fetchDepartments, fetchCourses } from "../../src/lib/catalog";
import { focusRing } from "../../src/lib/tokens";
import type { Department, Course } from "../../src/types";

export default function RegisterScreen() {
  const router = useRouter();
  const { colors, isDark, preference, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<"name" | "email" | "password" | null>(null);
  const [hoveredControl, setHoveredControl] = useState<string | null>(null);
  const [focusedControl, setFocusedControl] = useState<string | null>(null);

  // Validation States
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameError, setNameError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [departmentError, setDepartmentError] = useState("");
  const [courseError, setCourseError] = useState("");

  // Admin-managed catalog (loaded live; never hardcoded).
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const isValidEmailDomain = email.trim().toLowerCase().endsWith("@lccb.edu.ph");
  const showEmailFormatError = email.length > 0 && !isValidEmailDomain;

  const themeLabel = preference === "system" ? "System" : preference === "light" ? "Light" : "Dark";
  const nextTheme = preference === "light" ? "dark" : preference === "dark" ? "system" : "light";
  const nextThemeLabel = nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1);
  const ThemeIcon = preference === "system" ? Monitor : preference === "light" ? Sun : Moon;
  const signUpDisabled = loading || showEmailFormatError;
  const signUpHovered = hoveredControl === "signUp" && !signUpDisabled;
  const signInHovered = hoveredControl === "signIn";

  function handleEmailChange(value: string) {
    setEmail(value);
    if (value) setEmailError("");
    setGeneralError("");
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (value) setPasswordError("");
    setGeneralError("");
  }

  function handleNameChange(value: string) {
    setFullName(value);
    if (value) setNameError("");
    setGeneralError("");
  }

  useEffect(() => {
    fetchDepartments()
      .then(setDepartments)
      .catch(() => setDepartments([]))
      .finally(() => setLoadingCatalog(false));
  }, []);

  useEffect(() => {
    if (!departmentId) return;
    let active = true;
    fetchCourses(departmentId)
      .then((list) => {
        if (active) setCourses(list);
      })
      .catch(() => {
        if (active) setCourses([]);
      });
    return () => {
      active = false;
    };
  }, [departmentId]);

  async function signUpWithEmail() {
    let hasError = false;

    if (!fullName.trim()) {
      setNameError("Full Name is required");
      hasError = true;
    }

    if (!email.trim()) {
      setEmailError("Email is required");
      hasError = true;
    } else if (!isValidEmailDomain) {
      setEmailError("Must be an @lccb.edu.ph address");
      hasError = true;
    }
    
    if (!password) {
      setPasswordError("Password is required");
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      hasError = true;
    }

    if (!departmentId) {
      setDepartmentError("Select your department");
      hasError = true;
    }
    if (!courseId) {
      setCourseError("Select your course");
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);
    
    const { error, data } = await supabase.auth.signUp({ 
      email: email.trim().toLowerCase(), 
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        }
      }
    });
    
    if (error) {
      setGeneralError(error.message);
    } else {
      if (data?.user) {
        try {
          const username = email.trim().toLowerCase().split("@")[0] + "_" + Math.floor(Math.random() * 1000);
          await apiFetch(`/users`, {
            method: "POST",
            body: JSON.stringify({
              username,
              full_name: fullName.trim(),
              department_id: departmentId,
              course_id: courseId,
              course: courses.find((c) => c.id === courseId)?.name || null,
            }),
          });
        } catch (backendErr) {
          console.error("Failed to sync profile to SQL backend:", backendErr);
        }
      }
      router.replace("/(auth)/login");
    }
    setLoading(false);
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
            paddingTop: insets.top + 76,
            paddingBottom: insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          
          <View style={{ width: "100%", maxWidth: 470, padding: 24 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 28, padding: 32, borderWidth: 1, borderColor: colors.border, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 12 }, shadowOpacity: isDark ? 0.45 : 0.08, shadowRadius: 24, elevation: 8 }}>
              
              {/* Header Official Seal */}
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
                    shadowColor: colors.primary, 
                    shadowOffset: { width: 0, height: 4 }, 
                    shadowOpacity: 0.2, 
                    shadowRadius: 10, 
                    elevation: 3, 
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

                {/* Academic Institution Tag */}
                <View 
                  style={{ 
                    paddingHorizontal: 12, 
                    paddingVertical: 4, 
                    borderRadius: 12, 
                    backgroundColor: isDark ? "rgba(76, 132, 255, 0.1)" : "#EBF1FF", 
                    borderWidth: 1, 
                    borderColor: isDark ? "rgba(76, 132, 255, 0.2)" : "#DBEAFE",
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary, letterSpacing: 1.2, textTransform: "uppercase" }}>
                    La Consolacion College Bacolod
                  </Text>
                </View>

                <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "800", textAlign: "center", letterSpacing: -0.5 }}>
                  Create Account
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4, textAlign: "center" }}>
                  Join LCCB Connect • Academic Portfolio Network
                </Text>
              </View>

              {generalError ? (
                <View style={{ backgroundColor: colors.destructiveSurface, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: colors.destructiveSurfaceAlt }}>
                  <AlertCircle color={colors.destructive} size={18} />
                  <Text style={{ color: colors.destructiveText, fontWeight: "600", fontSize: 13, marginLeft: 10, flex: 1 }}>{generalError}</Text>
                </View>
              ) : null}

              {/* Name Input */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginLeft: 4 }}>Full Name</Text>
                <View 
                  style={{ 
                    backgroundColor: colors.surfaceSunken, 
                    borderRadius: 14, 
                    paddingHorizontal: 16, 
                    height: 52, 
                    flexDirection: "row", 
                    alignItems: "center", 
                    borderWidth: 1.5, 
                    borderColor: nameError 
                      ? colors.destructive 
                      : (focusedField === "name" ? colors.primary : colors.border) 
                  }}
                >
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: "500", outlineStyle: "none" } as any}
                    placeholder="Juan Dela Cruz"
                    placeholderTextColor={colors.textTertiary}
                    value={fullName}
                    onChangeText={handleNameChange}
                    onFocus={() => setFocusedField("name")}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="words"
                  />
                </View>
                {nameError ? (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginLeft: 4 }}>
                    <AlertCircle color={colors.warning} size={14} />
                    <Text style={{ color: colors.warningText, fontSize: 12, marginLeft: 4, fontWeight: "600" }}>{nameError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Department & Course (admin-managed catalog) */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginLeft: 4 }}>Department</Text>
                <SelectField
                  placeholder={loadingCatalog ? "Loading…" : "Select your department"}
                  value={departmentId}
                  options={departments.map((d) => ({ label: d.name, value: d.id }))}
                  onChange={(v) => {
                    setDepartmentId(v);
                    setCourseId(null);
                    setCourses([]);
                    setDepartmentError("");
                    setCourseError("");
                  }}
                  loading={loadingCatalog}
                  error={!!departmentError}
                />
                {departmentError ? (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginLeft: 4 }}>
                    <AlertCircle color={colors.warning} size={14} />
                    <Text style={{ color: colors.warningText, fontSize: 12, marginLeft: 4, fontWeight: "600" }}>{departmentError}</Text>
                  </View>
                ) : null}
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginLeft: 4 }}>Course</Text>
                <SelectField
                  placeholder={departmentId ? "Select your course" : "Select a department first"}
                  value={courseId}
                  options={courses.map((c) => ({ label: c.name, value: c.id }))}
                  onChange={(v) => {
                    setCourseId(v);
                    setCourseError("");
                  }}
                  disabled={!departmentId || courses.length === 0}
                  error={!!courseError}
                />
                {courseError ? (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginLeft: 4 }}>
                    <AlertCircle color={colors.warning} size={14} />
                    <Text style={{ color: colors.warningText, fontSize: 12, marginLeft: 4, fontWeight: "600" }}>{courseError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Email Input */}
              <View style={{ marginBottom: 16 }}>
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
                    borderColor: (showEmailFormatError || emailError) 
                      ? colors.destructive 
                      : (focusedField === "email" ? colors.primary : colors.border) 
                  }}
                >
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: "500", outlineStyle: "none" } as any}
                    placeholder="student@lccb.edu.ph"
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={handleEmailChange}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                {(emailError || showEmailFormatError) ? (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginLeft: 4 }}>
                    <AlertCircle color={colors.warning} size={14} />
                    <Text style={{ color: colors.warningText, fontSize: 12, marginLeft: 4, fontWeight: "600" }}>{emailError || "Must use an @lccb.edu.ph address"}</Text>
                  </View>
                ) : null}
              </View>

              {/* Password Input */}
              <View style={{ marginBottom: 28 }}>
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
              </View>

              {/* Sign Up Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={loading ? "Creating account" : "Sign up"}
                accessibilityState={{ disabled: signUpDisabled, busy: loading }}
                style={({ pressed }) => [
                  {
                    backgroundColor: signUpDisabled
                      ? colors.surfaceSunken
                      : signUpHovered
                        ? colors.primaryHover
                        : colors.primary,
                    height: 52,
                    borderRadius: 14,
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "center",
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: signUpHovered ? 6 : 4 },
                    shadowOpacity: signUpHovered ? (isDark ? 0.45 : 0.3) : (isDark ? 0.35 : 0.22),
                    shadowRadius: signUpHovered ? 12 : 8,
                    elevation: signUpHovered ? 6 : 4,
                    transform: [{ translateY: signUpHovered ? -1 : 0 }],
                    opacity: pressed && !signUpDisabled ? 0.88 : 1,
                  },
                  focusRing(colors, focusedControl === "signUp"),
                ]}
                onPress={signUpWithEmail}
                onHoverIn={() => setHoveredControl("signUp")}
                onHoverOut={() => setHoveredControl(null)}
                onFocus={() => setFocusedControl("signUp")}
                onBlur={() => setFocusedControl(null)}
                disabled={signUpDisabled}
              >
                <Text
                  style={{
                    color: signUpDisabled ? colors.textSecondary : colors.textOnPrimary,
                    fontWeight: "700",
                    fontSize: 15,
                  }}
                >
                  {loading ? "Creating account..." : "Sign Up"}
                </Text>
              </Pressable>

              {/* Footer Link */}
              <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 22 }}>
                <Text style={{ color: colors.textTertiary, fontWeight: "500", fontSize: 13 }}>Already have an account? </Text>
                <Link href="/(auth)/login" asChild>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Sign in to your account"
                    onHoverIn={() => setHoveredControl("signIn")}
                    onHoverOut={() => setHoveredControl(null)}
                    onFocus={() => setFocusedControl("signIn")}
                    onBlur={() => setFocusedControl(null)}
                    style={({ pressed }) => [
                      { borderRadius: 4, opacity: pressed ? 0.7 : 1 },
                      focusRing(colors, focusedControl === "signIn"),
                    ]}
                  >
                    <Text
                      style={{
                        color: signInHovered ? colors.primaryHover : colors.primary,
                        fontWeight: "700",
                        fontSize: 13,
                        textDecorationLine: signInHovered ? "underline" : "none",
                      }}
                    >
                      Sign in
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