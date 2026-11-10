import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  CheckCircle2,
  Clock3,
  ShieldCheck,
  User,
  IdCard,
  Building2,
  GraduationCap,
  Calendar,
  AlertTriangle,
} from "lucide-react-native";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { fetchDepartments, fetchCourses } from "../src/lib/catalog";
import SelectField, { SelectOption } from "../src/components/SelectField";
import { apiJson, ApiError } from "../src/lib/api";
import { RADIUS, SPACE, TYPE } from "../src/lib/tokens";
import Button from "../src/components/ui/Button";
import Card from "../src/components/ui/Card";
import Modal from "../src/components/ui/Modal";
import Reveal from "../src/components/ui/Reveal";
import TextField from "../src/components/ui/TextField";

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

type Notice = { title: string; message: string };

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
  const [notice, setNotice] = useState<Notice | null>(null);

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
        setNotice({
          title: "Could not load your status",
          message: "We couldn't check your verification status. Pull the screen up again in a moment.",
        });
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

  const loadCoursesForDepartment = useCallback(
    async (departmentId: string) => {
      if (departmentId) {
        await loadCourses(departmentId);
      } else {
        setCourses([]);
        setForm((f) => ({ ...f, course_id: "" }));
      }
    },
    [loadCourses]
  );

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
        if (!/^[A-Za-z0-9-]+$/.test(trimmed))
          return "Student ID may only contain letters, numbers, and hyphens";
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
          setNotice({
            title: "Submission failed",
            message: error.message || "We couldn't submit your verification request. Try again.",
          });
        }
      } else {
        setNotice({
          title: "Something went wrong",
          message: "We couldn't submit your verification request. Please try again.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldError = (name: keyof typeof form) =>
    touched[name] && errors[name] ? errors[name] : undefined;

  if (loadingVerification) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfacePage,
        }}
      >
        <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.brand} />
      </SafeAreaView>
    );
  }

  if (isPending) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: SPACE.x6 }}>
          <Reveal style={{ width: "100%", maxWidth: 520, alignSelf: "center" }}>
            <Card style={{ padding: SPACE.x8 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: RADIUS.lg,
                  backgroundColor: colors.accentWash,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: SPACE.x5,
                }}
              >
                <Clock3 size={26} color={colors.accentText} />
              </View>
              <Text style={{ ...TYPE.h1, color: colors.ink }}>Verification under review</Text>
              <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
                Your request has been submitted. A department admin will review your details and
                get back to you soon.
              </Text>

              <View
                style={{
                  marginTop: SPACE.x6,
                  borderRadius: RADIUS.md,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.panelInset,
                  padding: SPACE.x4,
                }}
              >
                <Text style={{ ...TYPE.micro, color: colors.inkFaint, marginBottom: SPACE.x3 }}>
                  Submitted details
                </Text>
                <SubmittedRow label="Full name" value={verification?.full_name} />
                <SubmittedRow label="Student ID" value={verification?.student_id} />
                <SubmittedRow label="Department" value={verification?.department_name} />
                <SubmittedRow label="Course" value={verification?.course_name} />
                <SubmittedRow label="Year level" value={verification?.year_level} last />
              </View>

              <View style={{ marginTop: SPACE.x6 }}>
                <Button
                  label="Back to app"
                  variant="secondary"
                  fullWidth
                  onPress={() => router.back()}
                />
              </View>
            </Card>
          </Reveal>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isApproved) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: SPACE.x6 }}>
          <Reveal style={{ width: "100%", maxWidth: 520, alignSelf: "center" }}>
            <Card style={{ padding: SPACE.x8, alignItems: "center" }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: RADIUS.xl,
                  backgroundColor: colors.jadeWash,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: SPACE.x5,
                }}
              >
                <CheckCircle2 size={32} color={colors.jadeText} />
              </View>
              <Text style={{ ...TYPE.h1, color: colors.ink, textAlign: "center" }}>
                {"You're verified"}
              </Text>
              <Text
                style={{
                  ...TYPE.body,
                  color: colors.inkSoft,
                  textAlign: "center",
                  marginTop: SPACE.x2,
                  maxWidth: 380,
                }}
              >
                Your identity has been verified. You now have full access to post, message, and
                connect.
              </Text>
              <View style={{ marginTop: SPACE.x6, alignSelf: "stretch" }}>
                <Button
                  label="Continue to app"
                  fullWidth
                  size="lg"
                  onPress={() => router.replace("/(tabs)/")}
                />
              </View>
            </Card>
          </Reveal>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // unverified or declined
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: SPACE.x8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              width: "100%",
              maxWidth: 540,
              alignSelf: "center",
              paddingHorizontal: SPACE.x4,
            }}
          >
            <Reveal>
              <View style={{ alignItems: "center", marginBottom: SPACE.x6 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: RADIUS.lg,
                    backgroundColor: colors.brandWash,
                    borderWidth: 1,
                    borderColor: colors.line,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: SPACE.x4,
                  }}
                >
                  <ShieldCheck size={26} color={colors.brand} />
                </View>
                <Text style={{ ...TYPE.h1, color: colors.ink, textAlign: "center" }}>
                  {isDeclined ? "Resubmit verification" : "Verify your identity"}
                </Text>
                <Text
                  style={{
                    ...TYPE.body,
                    color: colors.inkSoft,
                    textAlign: "center",
                    marginTop: SPACE.x2,
                    maxWidth: 400,
                  }}
                >
                  {isDeclined
                    ? "Correct the information below and resubmit for review."
                    : "Enter your student details so a department admin can verify your identity."}
                </Text>
              </View>

              <Card style={{ padding: SPACE.x6 }}>
                {isDeclined && verification?.note ? (
                  <View
                    style={{
                      flexDirection: "row",
                      gap: SPACE.x3,
                      padding: SPACE.x3,
                      borderRadius: RADIUS.md,
                      borderWidth: 1,
                      borderColor: colors.accent,
                      backgroundColor: colors.accentWash,
                      marginBottom: SPACE.x5,
                    }}
                  >
                    <AlertTriangle size={16} color={colors.accentText} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...TYPE.micro, color: colors.accentText, marginBottom: 2 }}>
                        Reviewer note
                      </Text>
                      <Text style={{ ...TYPE.caption, color: colors.ink, lineHeight: 18 }}>
                        {verification.note}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <TextField
                  label="Full name"
                  value={form.full_name}
                  onChangeText={(v) => handleChange("full_name", v)}
                  onBlur={() => handleBlur("full_name")}
                  placeholder="Juan Dela Cruz"
                  autoCapitalize="words"
                  editable={canEditName}
                  error={fieldError("full_name")}
                  hint={!canEditName ? "Locked to the name on your student record." : undefined}
                  leadingIcon={(props) => <User {...props} />}
                />

                <TextField
                  label="Student ID"
                  value={form.student_id}
                  onChangeText={(v) => handleChange("student_id", v)}
                  onBlur={() => handleBlur("student_id")}
                  placeholder="2023-12345"
                  autoCapitalize="characters"
                  editable={canEdit}
                  error={fieldError("student_id")}
                  leadingIcon={(props) => <IdCard {...props} />}
                />

                <View style={{ marginBottom: SPACE.x4 }}>
                  <FieldLabel icon={Building2} label="Department" />
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
                  {fieldError("department_id") ? (
                    <Text
                      style={{
                        ...TYPE.caption,
                        color: colors.destructiveText,
                        marginTop: SPACE.x2,
                      }}
                    >
                      {fieldError("department_id")}
                    </Text>
                  ) : null}
                </View>

                <View style={{ marginBottom: SPACE.x4 }}>
                  <FieldLabel icon={GraduationCap} label="Course" />
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
                  {fieldError("course_id") ? (
                    <Text
                      style={{
                        ...TYPE.caption,
                        color: colors.destructiveText,
                        marginTop: SPACE.x2,
                      }}
                    >
                      {fieldError("course_id")}
                    </Text>
                  ) : null}
                </View>

                <TextField
                  label="Year level"
                  value={form.year_level}
                  onChangeText={(v) => handleChange("year_level", v)}
                  onBlur={() => handleBlur("year_level")}
                  placeholder="1st Year"
                  autoCapitalize="words"
                  editable={canEdit}
                  error={fieldError("year_level")}
                  leadingIcon={(props) => <Calendar {...props} />}
                />

                <TextField
                  label="Birthdate"
                  value={form.birthdate}
                  onChangeText={(v) => handleChange("birthdate", v)}
                  onBlur={() => handleBlur("birthdate")}
                  placeholder="2000-01-15"
                  keyboardType="numbers-and-punctuation"
                  editable={canEdit}
                  error={fieldError("birthdate")}
                  hint="Format: YYYY-MM-DD"
                  leadingIcon={(props) => <Calendar {...props} />}
                />

                <View style={{ marginTop: SPACE.x2 }}>
                  <Button
                    label={isDeclined ? "Resubmit for verification" : "Submit for verification"}
                    size="lg"
                    fullWidth
                    loading={submitting}
                    disabled={!canEdit || submitting}
                    onPress={() => void handleSubmit()}
                  />
                </View>
              </Card>
            </Reveal>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={!!notice}
        onClose={() => setNotice(null)}
        maxWidth={440}
        accessibilityLabel={notice?.title ?? "Notice"}
      >
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>{notice?.title}</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
            {notice?.message}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: SPACE.x5 }}>
            <Button label="Got it" onPress={() => setNotice(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FieldLabel({ icon: Icon, label }: { icon: any; label: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.x2,
        marginBottom: SPACE.x2,
      }}
    >
      <Icon size={14} color={colors.textTertiary} />
      <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: "600", color: colors.textSecondary }}>
        {label}
      </Text>
    </View>
  );
}

function SubmittedRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value?: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACE.x4,
        paddingVertical: SPACE.x2,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.line,
      }}
    >
      <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>{label}</Text>
      <Text
        style={{ ...TYPE.caption, fontWeight: "600", color: colors.ink, flexShrink: 1, textAlign: "right" }}
        numberOfLines={1}
      >
        {value || "—"}
      </Text>
    </View>
  );
}
