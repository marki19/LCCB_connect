import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions, ScrollView, Image } from "react-native";
import { useState, useEffect } from "react";
import { supabase } from "../../src/lib/supabase";
import { Link, useRouter } from "expo-router";
import { Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { apiFetch } from "../../src/lib/api";
import SelectField from "../../src/components/SelectField";
import { useTheme } from "../../src/contexts/ThemeContext";
import { fetchDepartments, fetchCourses } from "../../src/lib/catalog";
import type { Department, Course } from "../../src/types";

export default function RegisterScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isWeb, setIsWeb] = useState(false);

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
      <LinearGradient colors={isDark ? ["hsl(215, 30%, 10%)", "hsl(215, 28%, 13%)", "hsl(215, 25%, 9%)"] : ["#EEF2FF", "#E0E7FF", "#FFFFFF"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }} showsVerticalScrollIndicator={false}>
          
          <View style={{ width: '100%', maxWidth: 450, padding: 24 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 32, padding: 32, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: isDark ? 0.3 : 0.08, shadowRadius: 20, elevation: 5 }}>
              
              {/* Header */}
              <View style={{ alignItems: 'center', marginBottom: 32 }}>
                <View style={{ width: 64, height: 64, backgroundColor: colors.actionSurfaceAlt, borderRadius: 32, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 3, marginBottom: 16 }}>
                  <Image source={require("../../assets/images/logo.jpg")} style={{ width: 44, height: 44, borderRadius: 22 }} resizeMode="cover" />
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '800', textAlign: 'center' }}>Create account</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 8, textAlign: 'center' }}>Join LCCB Connect and showcase your academic portfolio.</Text>
              </View>

              {generalError ? (
                <View style={{ backgroundColor: isDark ? 'hsl(0, 30%, 15%)' : '#FEF2F2', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <AlertCircle color="#EF4444" size={20} />
                  <Text style={{ color: isDark ? 'hsl(0, 80%, 80%)' : '#DC2626', fontWeight: '600', marginLeft: 12, flex: 1 }}>{generalError}</Text>
                </View>
              ) : null}

              {/* Name Input */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Full Name</Text>
                <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: 16, paddingHorizontal: 16, height: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: nameError ? '#F87171' : colors.border }}>
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: '500', outlineStyle: 'none' } as any}
                    placeholder="Juan Dela Cruz"
                    placeholderTextColor={colors.textTertiary}
                    value={fullName}
                    onChangeText={(text) => { setFullName(text); if (text) setNameError(""); setGeneralError(""); }}
                    autoCapitalize="words"
                  />
                </View>
                {nameError ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 4 }}>
                    <AlertCircle color="#F97316" size={14} />
                    <Text style={{ color: '#F97316', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>{nameError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Department & Course (admin-managed catalog) */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Department</Text>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 4 }}>
                    <AlertCircle color="#F97316" size={14} />
                    <Text style={{ color: '#F97316', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>{departmentError}</Text>
                  </View>
                ) : null}
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Course</Text>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 4 }}>
                    <AlertCircle color="#F97316" size={14} />
                    <Text style={{ color: '#F97316', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>{courseError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Email Input */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Institutional Email</Text>
                <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: 16, paddingHorizontal: 16, height: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: (showEmailFormatError || emailError) ? '#F87171' : colors.border }}>
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: '500', outlineStyle: 'none' } as any}
                    placeholder="student@lccb.edu.ph"
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={(text) => { setEmail(text); if (text) setEmailError(""); setGeneralError(""); }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                {(emailError || showEmailFormatError) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 4 }}>
                    <AlertCircle color="#F97316" size={14} />
                    <Text style={{ color: '#F97316', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>{emailError || "Must use an @lccb.edu.ph address"}</Text>
                  </View>
                ) : null}
              </View>

              {/* Password Input */}
              <View style={{ marginBottom: 32 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Password</Text>
                <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: 16, paddingHorizontal: 16, height: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: passwordError ? '#F87171' : colors.border }}>
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: '500', outlineStyle: 'none' } as any}
                    placeholder="••••••••••••"
                    placeholderTextColor={colors.textTertiary}
                    value={password}
                    onChangeText={(text) => { setPassword(text); if (text) setPasswordError(""); setGeneralError(""); }}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                    {showPassword ? <EyeOff color={colors.textTertiary} size={20} /> : <Eye color={colors.textTertiary} size={20} />}
                  </TouchableOpacity>
                </View>
                {passwordError ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 4 }}>
                    <AlertCircle color="#F97316" size={14} />
                    <Text style={{ color: '#F97316', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>{passwordError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Sign Up Button */}
              <TouchableOpacity 
                style={{ backgroundColor: (loading || showEmailFormatError) ? colors.surfaceSunken : colors.action, height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: colors.action, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                onPress={signUpWithEmail}
                disabled={loading || showEmailFormatError}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, marginRight: 8 }}>
                  {loading ? "Creating account..." : "Sign Up"}
                </Text>
                {!loading ? <ArrowRight color="#FFFFFF" size={20} /> : null}
              </TouchableOpacity>

              {/* Footer Link */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 }}>
                <Text style={{ color: colors.textTertiary, fontWeight: '500', fontSize: 14 }}>Already have an account? </Text>
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity>
                    <Text style={{ color: colors.action, fontWeight: '700', fontSize: 14 }}>Sign in</Text>
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