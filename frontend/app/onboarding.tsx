import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "expo-router";
import { CheckCircle, User, IdCard, Building2, GraduationCap, Calendar } from "lucide-react-native";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { fetchDepartments, fetchCourses } from "../src/lib/catalog";
import SelectField, { SelectOption } from "../src/components/SelectField";
import { apiJson, ApiError } from "../src/lib/api";
import { focusRing } from "../src/lib/tokens";

type VerificationStatus = "unverified" | "pending" | "approved" | "declined";

interface VerificationRequest {
  status: VerificationStatus;
  full_name?: string;
  student_id?: string;
  department_id?: string;
  department_name?: string;
  course_id?: string;
  course_name?: string;
  year_level?: string;
  birthdate?: string;
  note?: string;
  submitted_at?: string;
  decided_at?: string;
  decided_by_name?: string;
}

interface MineResponse {
  request: VerificationRequest | null;
  can_resubmit: boolean;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { refreshProfile, profile } = useAuth();
  const { colors } = useTheme();

  const [verification, setVerification] = useState<VerificationRequest | null>(null);
  const [loadingVerification, setLoadingVerification] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [courses, setCourses] = useState<SelectOption[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    student_id: "",
    department_id: "",
    course_id: "",
    year_level: "",
    birthdate: "",
  });

  const [errors, setErrors] = useState<Partial<typeof form>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof typeof form, boolean>>>({});

  const isPending = verification?.status === "pending";
  const isDeclined = verification?.status === "declined";
  const isApproved = verification?.status === "approved";
  const hasProfileName = !!profile?.full_name;
  const canEditName = !hasProfileName;
  const canEdit = isDeclined || !verification || verification.status === "unverified";

  const loadVerification = useCallback(async () => {
    try {
      setLoadingVerification(true);
      const data = await apiJson<MineResponse>("/verification/mine");
      const request = data.request;
      setVerification(request);
      // Prefill form from latest request (declined or pending)
      if (request) {
        setForm((f) => ({
          ...f,
          full_name: request.full_name ?? f.full_name,
          student_id: request.student_id ?? f.student_id,
          department_id: request.department_id ?? f.department_id,
          course_id: request.course_id ?? f.course_id,
          year_level: request.year_level ?? f.year_level,
          birthdate: request.birthdate ?? f.birthdate,
        }));
      } else if (profile) {
        // Prefill from profile if no request exists
        setForm((f) => ({
          ...f,
          full_name: profile.full_name ?? f.full_name,
          student_id: profile.student_id ?? f.student_id,
          department_id: profile.department_id ?? f.department_id,
          course_id: profile.course_id ?? f.course_id,
          year_level: profile.year_level ?? f.year_level,
        }));
      }
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 404) {
        setVerification({ status: "unverified" });
        if (profile) {
          setForm((f) => ({
            ...f,
            full_name: profile.full_name ?? f.full_name,
            student_id: profile.student_id ?? f.student_id,
            department_id: profile.department_id ?? f.department_id,
            course_id: profile.course_id ?? f.course_id,
            year_level: profile.year_level ?? f.year_level,
          }));
        }
      } else {
        console.error("Failed to load verification:", error);
        Alert.alert("Error", "Failed to load verification status");
      }
    } finally {
      setLoadingVerification(false);
    }
  }, [profile]);

  const loadDepartments = useCallback(async () => {
    try {
      setLoadingDepartments(true);
      const data = await fetchDepartments();
      setDepartments(data.map((d) => ({ label: d.name, value: d.id })));
    } catch (error) {
      console.error("Failed to load departments:", error);
    } finally {
      setLoadingDepartments(false);
    }
  }, []);

  const loadCourses = useCallback(async (departmentId: string) => {
    try {
      setLoadingCourses(true);
      const data = await fetchCourses(departmentId);
      setCourses(data.map((c) => ({ label: c.name, value: c.id })));
    } catch (error) {
      console.error("Failed to load courses:", error);
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  const initializedRef = useRef(false);
  const loadInitialData = useCallback(async () => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    await loadVerification();
    await loadDepartments();
  }, [loadVerification, loadDepartments]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const loadCoursesForDepartment = useCallback(async (departmentId: string) => {
    if (departmentId) {
      await loadCourses(departmentId);
    } else {
      setCourses([]);
      setForm((f) => ({ ...f, course_id: "" }));
    }
  }, [loadCourses]);

  const lastDepartmentIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (form.department_id !== lastDepartmentIdRef.current) {
      lastDepartmentIdRef.current = form.department_id;
      loadCoursesForDepartment(form.department_id);
    }
  }, [form.department_id, loadCoursesForDepartment]);

  const validateField = (name: keyof typeof form, value: string): string | null => {
    const trimmed = value.trim();
    switch (name) {
      case "full_name":
        if (!trimmed) return "Full name is required";
        if (trimmed.length < 2) return "Full name must be at least 2 characters";
        if (trimmed.length > 200) return "Full name is too long";
        break;
      case "student_id":
        if (!trimmed) return "Student ID is required";
        if (trimmed.length < 4) return "Student ID must be at least 4 characters";
        if (trimmed.length > 20) return "Student ID must be at most 20 characters";
        if (!/^[A-Za-z0-9-]+$/.test(trimmed)) return "Student ID may only contain letters, numbers, and hyphens";
        break;
      case "department_id":
        if (!trimmed) return "Department is required";
        break;
      case "course_id":
        if (!trimmed) return "Course is required";
        break;
      case "year_level":
        if (!trimmed) return "Year level is required";
        if (trimmed.length > 50) return "Year level is too long";
        break;
      case "birthdate":
        if (!trimmed) return "Birthdate is required";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "Birthdate must be YYYY-MM-DD";
        const date = new Date(trimmed);
        const today = new Date();
        if (date >= today || date.getFullYear() < 1900) return "Birthdate must be a valid past date";
        break;
    }
    return null;
  };

  const handleChange = (name: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [name]: value }));
    const error = validateField(name, value);
    setErrors((e) => ({ ...e, [name]: error }));
  };

  const handleBlur = (name: keyof typeof form) => {
    setTouched((t) => ({ ...t, [name]: true }));
    const error = validateField(name, form[name]);
    setErrors((e) => ({ ...e, [name]: error }));
  };

  const validateAll = () => {
    const newErrors: Partial<typeof form> = {};
    let valid = true;
    (Object.keys(form) as (keyof typeof form)[]).forEach((key) => {
      const error = validateField(key, form[key]);
      if (error) {
        newErrors[key] = error;
        valid = false;
      }
    });
    setErrors(newErrors);
    setTouched({
      full_name: true,
      student_id: true,
      department_id: true,
      course_id: true,
      year_level: true,
      birthdate: true,
    });
    return valid;
  };

  const handleSubmit = async () => {
    if (!validateAll()) return;

    setSubmitting(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        student_id: form.student_id.trim().toUpperCase(),
        department_id: form.department_id,
        course_id: form.course_id,
        year_level: form.year_level.trim(),
        birthdate: form.birthdate.trim(),
      };

      // Always POST to /verification (creates new or upserts pending)
      await apiJson("/verification", { method: "POST", body: JSON.stringify(payload) });

      await refreshProfile();
      router.replace("/(tabs)/");
    } catch (error: any) {
      if (error instanceof ApiError) {
        if (error.status === 400 && (error as any).response?.data?.issues) {
          const fieldErrors: Partial<typeof form> = {};
          (error as any).response.data.issues.forEach((issue: any) => {
            const path = issue.path?.[0];
            if (path && path in form) {
              fieldErrors[path as keyof typeof form] = issue.message;
            }
          });
          setErrors(fieldErrors);
          setTouched({
            full_name: true,
            student_id: true,
            department_id: true,
            course_id: true,
            year_level: true,
            birthdate: true,
          });
        } else {
          Alert.alert("Error", error.message || "Submission failed");
        }
      } else {
        Alert.alert("Error", "Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderPendingState = () => (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
      <View style={{ backgroundColor: colors.surface, borderRadius: 28, padding: 32, borderWidth: 1, borderColor: colors.border, width: "100%", maxWidth: 500, alignSelf: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <View style={{ backgroundColor: colors.successSurfaceAlt, borderRadius: 24, padding: 12, marginRight: 16 }}>
            <CheckCircle size={28} color={colors.success} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.textPrimary }}>Under Review</Text>
        </View>
        <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: "center", lineHeight: 24, marginBottom: 24 }}>
          Your verification request has been submitted. A department admin will review your details and get back to you soon.
        </Text>
        <View style={{ backgroundColor: colors.surfacePage, borderRadius: 16, padding: 16, marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginBottom: 8 }}>Submitted Details</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>{verification?.full_name || "—"}</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>{verification?.student_id || "—"}</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>{verification?.department_name || "—"}</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>{verification?.course_name || "—"}</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>{verification?.year_level || "—"}</Text>
        </View>
        <TouchableOpacity
          style={{
            backgroundColor: colors.actionSurface,
            borderRadius: 16,
            paddingVertical: 16,
            paddingHorizontal: 24,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.borderStrong,
          }}
          onPress={() => router.back()}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.action }}>Back to App</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  

  const renderApprovedState = () => (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
      <View style={{ backgroundColor: colors.surface, borderRadius: 28, padding: 32, borderWidth: 1, borderColor: colors.border, width: "100%", maxWidth: 500, alignSelf: "center" }}>
        <View style={{ backgroundColor: colors.successSurfaceAlt, borderRadius: 24, padding: 12, marginBottom: 16, alignSelf: "center" }}>
          <CheckCircle size={48} color={colors.success} />
        </View>
        <Text style={{ fontSize: 24, fontWeight: "700", color: colors.textPrimary, textAlign: "center", marginBottom: 8 }}>Verified!</Text>
        <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: "center", lineHeight: 24, marginBottom: 24 }}>
          Your identity has been verified. You now have full access to post, message, and connect.
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: colors.action,
            borderRadius: 16,
            paddingVertical: 16,
            paddingHorizontal: 32,
            alignItems: "center",
          }}
          onPress={() => router.replace("/(tabs)/")}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textOnPrimary }}>Continue to App</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderForm = () => (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <User size={20} color={colors.textTertiary} style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>Full Name</Text>
        </View>
        <TextInput
          value={form.full_name}
          onChangeText={(v) => handleChange("full_name", v)}
          onBlur={() => handleBlur("full_name")}
          editable={canEditName}
          style={{
            backgroundColor: canEditName ? colors.surface : colors.surfacePage,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: colors.textPrimary,
            borderWidth: 1,
            borderColor: touched.full_name && errors.full_name ? colors.destructive : colors.border,
            ...focusRing(colors, true),
          }}
          placeholder="Juan Dela Cruz"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
        />
        {touched.full_name && errors.full_name && (
          <Text style={{ fontSize: 12, color: colors.destructive }}>{errors.full_name}</Text>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <IdCard size={20} color={colors.textTertiary} style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>Student ID</Text>
        </View>
        <TextInput
          value={form.student_id}
          onChangeText={(v) => handleChange("student_id", v)}
          onBlur={() => handleBlur("student_id")}
          editable={canEdit}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: colors.textPrimary,
            borderWidth: 1,
            borderColor: touched.student_id && errors.student_id ? colors.destructive : colors.border,
            ...focusRing(colors, true),
          }}
          placeholder="2023-12345"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
        />
        {touched.student_id && errors.student_id && (
          <Text style={{ fontSize: 12, color: colors.destructive }}>{errors.student_id}</Text>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Building2 size={20} color={colors.textTertiary} style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>Department</Text>
        </View>
        <SelectField
          value={form.department_id || null}
          options={departments}
          onChange={(v) => handleChange("department_id", v)}
          placeholder="Select department"
          disabled={!canEdit || loadingDepartments}
          loading={loadingDepartments}
          error={touched.department_id && !!errors.department_id}
          emptyText="No departments available"
        />
        {touched.department_id && errors.department_id && (
          <Text style={{ fontSize: 12, color: colors.destructive }}>{errors.department_id}</Text>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <GraduationCap size={20} color={colors.textTertiary} style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>Course</Text>
        </View>
        <SelectField
          value={form.course_id || null}
          options={courses}
          onChange={(v) => handleChange("course_id", v)}
          placeholder={form.department_id ? "Select course" : "Select department first"}
          disabled={!canEdit || loadingCourses || !form.department_id}
          loading={loadingCourses}
          error={touched.course_id && !!errors.course_id}
          emptyText="No courses available for this department"
        />
        {touched.course_id && errors.course_id && (
          <Text style={{ fontSize: 12, color: colors.destructive }}>{errors.course_id}</Text>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Calendar size={20} color={colors.textTertiary} style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>Year Level</Text>
        </View>
        <TextInput
          value={form.year_level}
          onChangeText={(v) => handleChange("year_level", v)}
          onBlur={() => handleBlur("year_level")}
          editable={canEdit}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: colors.textPrimary,
            borderWidth: 1,
            borderColor: touched.year_level && errors.year_level ? colors.destructive : colors.border,
            ...focusRing(colors, true),
          }}
          placeholder="1st Year"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
        />
        {touched.year_level && errors.year_level && (
          <Text style={{ fontSize: 12, color: colors.destructive }}>{errors.year_level}</Text>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Calendar size={20} color={colors.textTertiary} style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>Birthdate (YYYY-MM-DD)</Text>
        </View>
        <TextInput
          value={form.birthdate}
          onChangeText={(v) => handleChange("birthdate", v)}
          onBlur={() => handleBlur("birthdate")}
          editable={canEdit}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: colors.textPrimary,
            borderWidth: 1,
            borderColor: touched.birthdate && errors.birthdate ? colors.destructive : colors.border,
            ...focusRing(colors, true),
          }}
          placeholder="2000-01-15"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />
        {touched.birthdate && errors.birthdate && (
          <Text style={{ fontSize: 12, color: colors.destructive }}>{errors.birthdate}</Text>
        )}
      </View>

      <TouchableOpacity
        style={{
          backgroundColor: canEdit ? colors.action : colors.actionSurface,
          borderRadius: 16,
          paddingVertical: 16,
          paddingHorizontal: 24,
          alignItems: "center",
          borderWidth: canEdit ? 0 : 1,
          borderColor: colors.borderStrong,
          opacity: canEdit ? 1 : 0.6,
        }}
        onPress={handleSubmit}
        disabled={!canEdit || submitting}
      >
        {submitting ? (
          <ActivityIndicator size="large" color={colors.textOnPrimary} />
        ) : (
          <Text style={{ fontSize: 16, fontWeight: "600", color: canEdit ? colors.textOnPrimary : colors.textDisabled }}>
            {isDeclined ? "Resubmit" : "Submit for Verification"}
          </Text>
        )}
      </TouchableOpacity>

      {canEdit && !isDeclined && (
        <TouchableOpacity
          style={{
            backgroundColor: "transparent",
            borderRadius: 16,
            paddingVertical: 12,
            paddingHorizontal: 24,
            alignItems: "center",
            marginTop: 12,
          }}
          onPress={() => router.replace("/(tabs)/")}
        >
          <Text style={{ fontSize: 14, fontWeight: "500", color: colors.textTertiary }}>
            Skip for now
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loadingVerification) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.surfacePage }}>
        <ActivityIndicator size="large" color={colors.action} />
      </View>
    );
  }

  if (isPending) {
    return renderPendingState();
  }

  if (isApproved) {
    return renderApprovedState();
  }

  // unverified or declined
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: "100%", maxWidth: 500, alignSelf: "center", padding: 24 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 28, padding: 32, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 28, fontWeight: "800", color: colors.textPrimary, textAlign: "center", marginBottom: 8 }}>
                {isDeclined ? "Resubmit Verification" : "Verify Your Identity"}
              </Text>
              <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: "center", lineHeight: 24, marginBottom: 24 }}>
                {isDeclined
                  ? "Please correct the information below and resubmit."
                  : "Enter your details so a department admin can verify your student identity."}
              </Text>
              {renderForm()}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}