import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions, ScrollView, Image } from "react-native";
import { useState, useEffect } from "react";
import { supabase } from "../../src/lib/supabase";
import { Link, useRouter } from "expo-router";
import { Eye, EyeOff, AlertCircle, ArrowRight, Sun, Moon } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { apiFetch } from "../../src/lib/api";
import SelectField from "../../src/components/SelectField";
import { useTheme } from "../../src/contexts/ThemeContext";
import { fetchDepartments, fetchCourses } from "../../src/lib/catalog";
import type { Department, Course } from "../../src/types";

export default function RegisterScreen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isWeb, setIsWeb] = useState(false);
  const [focusedField, setFocusedField] = useState<"name" | "email" | "password" | null>(null);

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

  useEffect(() => {
    const handleResize = () => setIsWeb(Dimensions.get("window").width > 768);
    handleResize();
    const subscription = Dimensions.addEventListener("change", handleResize);
    return () => subscription?.remove();
  }, []);

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
        {/* Top bar with Theme Switcher */}
        <View style={{ width: "100%", maxWidth: 470, alignSelf: "center", flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 24, paddingTop: 16 }}>
          <TouchableOpacity
            onPress={() => void toggleTheme()}
            activeOpacity={0.7}
            accessibilityLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surface,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isDark ? 0.3 : 0.05,
              shadowRadius: 3,
              elevation: 2,
            }}
          >
            {isDark ? <Sun size={15} color={colors.primary} /> : <Moon size={15} color={colors.textSecondary} />}
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginLeft: 6 }}>
              {isDark ? "Light Mode" : "Dark Mode"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", paddingVertical: 16 }} showsVerticalScrollIndicator={false}>
          
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
                    onChangeText={(text) => { setFullName(text); if (text) setNameError(""); setGeneralError(""); }}
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
                    onChangeText={(text) => { setEmail(text); if (text) setEmailError(""); setGeneralError(""); }}
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
                    onChangeText={(text) => { setPassword(text); if (text) setPasswordError(""); setGeneralError(""); }}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                    {showPassword ? <EyeOff color={colors.textTertiary} size={18} /> : <Eye color={colors.textTertiary} size={18} />}
                  </TouchableOpacity>
                </View>
                {passwordError ? (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginLeft: 4 }}>
                    <AlertCircle color={colors.warning} size={14} />
                    <Text style={{ color: colors.warningText, fontSize: 12, marginLeft: 4, fontWeight: "600" }}>{passwordError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Sign Up Button */}
              <TouchableOpacity 
                style={{ 
                  backgroundColor: (loading || showEmailFormatError) ? colors.surfaceSunken : colors.primary, 
                  height: 52, 
                  borderRadius: 14, 
                  flexDirection: "row", 
                  justifyContent: "center", 
                  alignItems: "center", 
                  shadowColor: colors.primary, 
                  shadowOffset: { width: 0, height: 4 }, 
                  shadowOpacity: isDark ? 0.35 : 0.22, 
                  shadowRadius: 8, 
                  elevation: 4 
                }}
                onPress={signUpWithEmail}
                disabled={loading || showEmailFormatError}
                activeOpacity={0.85}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginRight: 8 }}>
                  {loading ? "Creating account..." : "Sign Up"}
                </Text>
                {!loading ? <ArrowRight color="#FFFFFF" size={18} /> : null}
              </TouchableOpacity>

              {/* Footer Link */}
              <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 22 }}>
                <Text style={{ color: colors.textTertiary, fontWeight: "500", fontSize: 13 }}>Already have an account? </Text>
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity>
                    <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Sign in</Text>
                  </TouchableOpacity>
                </Link>
              </View>

            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}