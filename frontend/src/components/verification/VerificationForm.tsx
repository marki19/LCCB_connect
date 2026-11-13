import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertCircle } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { fetchDepartments, fetchCourses } from "../../lib/catalog";
import { buildFieldDefs, validateAll } from "../../lib/verification";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";
import type { Department, Course } from "../../types";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Modal from "../ui/Modal";
import Reveal from "../ui/Reveal";
import SelectField, { SelectOption } from "../SelectField";
import TextField from "../ui/TextField";
import DatePickerField from "../ui/DatePickerField";

type Props = {
  /** The caller's role from the server — determines which fields render. */
  role: string;
  /** Field shape from GET /verification/mine (the authoritative `fields` object). */
  fields: { department: boolean; course: boolean; yearLevel: boolean } | null;
  /** Whether the caller's email ends with @lccbonline.edu.ph. */
  schoolAccount: boolean;
  /** Prefilled values from the latest request or profile. */
  initialValues: Partial<{
    full_name: string;
    student_id: string;
    department_id: string;
    course_id: string;
    year_level: string;
    birthdate: string;
  }>;
  /** Whether full_name is locked (already set on profile from a previous attempt). */
  fullNameLocked: boolean;
  /** Current request status — controls button label and editability. */
  requestStatus: "unverified" | "pending" | "approved" | "declined" | null;
  /** Reviewer note when declined. */
  declineNote?: string | null;
  /** Called when the user taps "Send code" — should POST /verification/otp. */
  onSendOtp: () => Promise<{ ok: boolean; expires_at?: string; error?: string }>;
  /** Called when the user submits — should POST /verification or PUT /verification/mine. */
  onSubmit: (payload: {
    full_name: string;
    student_id: string;
    department_id: string | null;
    course_id: string | null;
    year_level: string | null;
    birthdate: string;
    otp_code: string;
  }) => Promise<{ ok: boolean; error?: string; fields?: Record<string, string> }>;
};

/** Academic levels used when the server doesn't return them. */
export const DEFAULT_ACADEMIC_LEVELS: SelectOption[] = [
  { value: "1st Year", label: "1st Year" },
  { value: "2nd Year", label: "2nd Year" },
  { value: "3rd Year", label: "3rd Year" },
  { value: "4th Year", label: "4th Year" },
  { value: "5th Year", label: "5th Year" },
  { value: "IBED", label: "IBED" },
  { value: "Integrated Studies", label: "Integrated Studies" },
];

export default function VerificationForm({
  role,
  fields,
  schoolAccount,
  initialValues,
  fullNameLocked,
  requestStatus,
  declineNote,
  onSendOtp,
  onSubmit,
}: Props) {
  const { colors } = useTheme();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [academicLevels] = useState<SelectOption[]>(DEFAULT_ACADEMIC_LEVELS);
  const [loadingCatalog, setLoadingCatalog] = useState({ departments: false, courses: false, levels: false });

  const [form, setForm] = useState<Record<string, string>>({
    full_name: initialValues.full_name ?? "",
    student_id: initialValues.student_id ?? "",
    department_id: initialValues.department_id ?? "",
    course_id: initialValues.course_id ?? "",
    year_level: initialValues.year_level ?? "",
    birthdate: initialValues.birthdate ?? "",
    otp_code: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  const isSuperadmin = role === "superadmin";

  const fieldDefs = useMemo(
    () =>
      buildFieldDefs(fields, role as any, departments, courses, academicLevels.map((l) => l.value), fullNameLocked),
    [fields, role, departments, courses, academicLevels, fullNameLocked]
  );

  const canEdit = requestStatus === "declined" || requestStatus === "unverified" || requestStatus === null;
  const isPending = requestStatus === "pending";
  const isApproved = requestStatus === "approved";

  // Load catalog on mount
  const loadCatalog = useCallback(async () => {
    setLoadingCatalog((l) => ({ ...l, departments: true }));
    try {
      const data = await fetchDepartments();
      setDepartments(data);
    } finally {
      setLoadingCatalog((l) => ({ ...l, departments: false }));
    }
  }, []);

  const loadCoursesForDept = useCallback(
    async (deptId: string) => {
      if (!deptId) {
        setCourses([]);
        return;
      }
      setLoadingCatalog((l) => ({ ...l, courses: true }));
      try {
        const data = await fetchCourses(deptId);
        setCourses(data);
      } finally {
        setLoadingCatalog((l) => ({ ...l, courses: false }));
      }
    },
    []
  );

  const loadLevels = useCallback(async () => {
    setLoadingCatalog((l) => ({ ...l, levels: true }));
    try {
      // No server endpoint for academic levels yet; keep defaults
      await fetchCourses(""); // fetchCourses without department_id won't work, so we skip
    } finally {
      setLoadingCatalog((l) => ({ ...l, levels: false }));
    }
  }, []);

  // Initial catalog load
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCatalog();
    loadLevels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload courses when department changes
  const lastDeptRef = useRef<string | null>(null);
  useEffect(() => {
    if (form.department_id !== lastDeptRef.current) {
      lastDeptRef.current = form.department_id;
      loadCoursesForDept(form.department_id);
    }
  }, [form.department_id, loadCoursesForDept]);

  const validate = useCallback(
    (key: keyof typeof form, value: string) => {
      const def = fieldDefs.find((d) => d.key === key);
      if (!def) return null;
      return validateAll([def], { [key]: value })[key] || null;
    },
    [fieldDefs]
  );

  const handleChange = (key: keyof typeof form, value: string) => {
    let cleanVal = value;
    if (key === "student_id") {
      cleanVal = value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    } else if (key === "otp_code") {
      cleanVal = value.replace(/\D/g, "").slice(0, 6);
    } else if (key === "full_name") {
      cleanVal = value.replace(/[^\w\s.-]/gi, "");
    }
    setForm((f) => ({ ...f, [key]: cleanVal }));
    const err = validate(key, cleanVal);
    setErrors((e) => ({ ...e, [key]: err ?? "" }));
  };

  const handleBlur = (key: keyof typeof form) => {
    setTouched((t) => ({ ...t, [key]: true }));
    const err = validate(key, form[key] ?? "");
    setErrors((e) => ({ ...e, [key]: err ?? "" }));
  };

  const runValidation = () => {
    const vals: Record<string, string> = {};
    for (const def of fieldDefs) {
      vals[def.key] = form[def.key] ?? "";
    }
    const errs = validateAll(fieldDefs, vals);
    setErrors(errs);
    setTouched(
      Object.fromEntries(fieldDefs.map((d) => [d.key, true]))
    );
    return Object.keys(errs).length === 0;
  };

  const handleSendOtp = async () => {
    if (!schoolAccount) {
      setNotice({
        title: "School account required",
        message: "Verification is only available to @lccbonline.edu.ph accounts.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await onSendOtp();
      if (res.ok) {
        setOtpSent(true);
        setOtpExpiresAt(res.expires_at ?? null);
      } else {
        setNotice({ title: "Could not send code", message: res.error ?? "Try again in a moment." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!runValidation()) return;

    // OTP code validation
    const otp = form.otp_code?.trim() ?? "";
    if (!otp) {
      setErrors((e) => ({ ...e, otp_code: "Enter the 6-digit code" }));
      setTouched((t) => ({ ...t, otp_code: true }));
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setErrors((e) => ({ ...e, otp_code: "Code must be 6 digits" }));
      setTouched((t) => ({ ...t, otp_code: true }));
      return;
    }

    setSubmitting(true);
    try {
      const rawBirthdate = form.birthdate?.trim() ?? "";
      let birthdateFormatted = rawBirthdate;
      const mdy = rawBirthdate.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
      if (mdy) {
        birthdateFormatted = `${mdy[3]}-${mdy[1]}-${mdy[2]}`;
      }

      const payload = {
        full_name: form.full_name?.trim() ?? "",
        student_id: form.student_id?.trim().toUpperCase() ?? "",
        department_id: form.department_id || null,
        course_id: form.course_id || null,
        year_level: form.year_level?.trim() ?? "",
        birthdate: birthdateFormatted,
        otp_code: otp,
      };

      const res = await onSubmit(payload);
      if (res.ok) {
        setNotice({
          title: "Submitted",
          message: "Your verification request has been sent for review.",
        });
        // The parent will refresh and navigate
      } else if (res.fields) {
        // Server validation errors with field paths
        setErrors(res.fields);
        setTouched(
          Object.fromEntries(Object.keys(res.fields).map((k) => [k, true]))
        );
      } else {
        setNotice({ title: "Submission failed", message: res.error ?? "Try again." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldError = (key: string) => (touched[key] && errors[key] ? errors[key] : undefined);

  // Superadmin never verifies — show a notice instead of the form
  if (isSuperadmin) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.surfacePage, alignItems: "center", justifyContent: "center" }}
      >
        <Card style={{ padding: SPACE.x8, maxWidth: 400, width: "100%" }}>
          <View style={{ alignItems: "center", gap: SPACE.x4 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: RADIUS.xl,
                backgroundColor: colors.brandWash,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 28 }}>🛡️</Text>
            </View>
            <Text style={{ ...TYPE.h1, color: colors.ink, textAlign: "center" }}>Superadmin access</Text>
            <Text style={{ ...TYPE.body, color: colors.inkSoft, textAlign: "center" }}>
              Superadmin accounts do not require verification. You have full access already.
            </Text>
          </View>
        </Card>
      </SafeAreaView>
    );
  }

  // Pending state — read-only summary
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
                  alignSelf: "center",
                }}
              >
                <Text style={{ fontSize: 24 }}>⏳</Text>
              </View>
              <Text style={{ ...TYPE.h1, color: colors.ink, textAlign: "center" }}>Verification under review</Text>
              <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2, textAlign: "center" }}>
                Your request has been submitted. A reviewer will check your details and get back to you soon.
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
                <Text style={{ ...TYPE.micro, color: colors.inkFaint, marginBottom: SPACE.x3 }}>Submitted details</Text>
                {fieldDefs.map((def) => (
                  <View
                    key={def.key}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: SPACE.x4,
                      paddingVertical: SPACE.x2,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.line,
                    }}
                  >
                    <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>{def.label}</Text>
                    <Text
                      style={{ ...TYPE.caption, fontWeight: "600", color: colors.ink, flexShrink: 1, textAlign: "right" }}
                      numberOfLines={1}
                    >
                      {form[def.key] ?? "—"}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: SPACE.x6 }}>
                <Button
                  label="Back to app"
                  variant="secondary"
                  fullWidth
                  onPress={() => {}}
                />
              </View>
            </Card>
          </Reveal>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Approved state
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
                <Text style={{ fontSize: 28 }}>✅</Text>
              </View>
              <Text style={{ ...TYPE.h1, color: colors.ink, textAlign: "center" }}>You&apos;re verified</Text>
              <Text
                style={{
                  ...TYPE.body,
                  color: colors.inkSoft,
                  textAlign: "center",
                  marginTop: SPACE.x2,
                  maxWidth: 380,
                }}
              >
                Your identity has been verified. You now have full access to post, message, and connect.
              </Text>
              <View style={{ marginTop: SPACE.x6, alignSelf: "stretch" }}>
                <Button label="Continue to app" fullWidth size="lg" onPress={() => {}} />
              </View>
            </Card>
          </Reveal>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Unverified or declined — editable form
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
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
                  <Text style={{ fontSize: 24 }}>🛡️</Text>
                </View>
                <Text style={{ ...TYPE.h1, color: colors.ink, textAlign: "center" }}>
                  {requestStatus === "declined" ? "Resubmit verification" : "Verify your identity"}
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
                  {requestStatus === "declined"
                    ? "Correct the information below and resubmit for review."
                    : "Enter your details so a reviewer can verify your identity."}
                </Text>
              </View>

              <Card style={{ padding: SPACE.x6 }}>
                {requestStatus === "declined" && declineNote ? (
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
                    <AlertCircle size={16} color={colors.accentText} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...TYPE.micro, color: colors.accentText, marginBottom: 2 }}>Reviewer note</Text>
                      <Text style={{ ...TYPE.caption, color: colors.ink, lineHeight: 18 }}>{declineNote}</Text>
                    </View>
                  </View>
                ) : null}

                {fieldDefs.map((def) => {
                  const isSelect = !!def.options && def.options.length > 0;
                  const disabled = !canEdit || loadingCatalog.departments || loadingCatalog.courses || loadingCatalog.levels;

                  if (isSelect) {
                    return (
                      <View key={def.key} style={{ marginBottom: SPACE.x4 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: SPACE.x2,
                            marginBottom: SPACE.x2,
                          }}
                        >
                          <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: "600", color: colors.textSecondary }}>
                            {def.label}
                          </Text>
                        </View>
                        <SelectField
                          value={form[def.key] as string || null}
                          options={def.options || []}
                          onChange={(v) => handleChange(def.key, v)}
                          placeholder={def.placeholder}
                          disabled={disabled}
                          loading={loadingCatalog.departments || loadingCatalog.courses || loadingCatalog.levels}
                          error={!!fieldError(def.key)}
                          emptyText={def.options?.length ? undefined : "No options available"}
                        />
                        {fieldError(def.key) ? (
                          <Text
                            style={{
                              ...TYPE.caption,
                              color: colors.destructiveText,
                              marginTop: SPACE.x2,
                            }}
                          >
                            {fieldError(def.key)}
                          </Text>
                        ) : null}
                      </View>
                    );
                  }

                  if (def.key === "birthdate") {
                    return (
                      <DatePickerField
                        key={def.key}
                        label={def.label}
                        value={form.birthdate || ""}
                        onChange={(v) => handleChange("birthdate", v)}
                        placeholder="YYYY-MM-DD"
                        hint={def.locked ? def.lockHint : "Pick from calendar or type numbers (auto-formatted)"}
                        error={fieldError("birthdate")}
                        maxDate={new Date()}
                        editable={canEdit && !def.locked}
                      />
                    );
                  }

                  return (
                    <TextField
                      key={def.key}
                      label={def.label}
                      value={form[def.key] ?? ""}
                      onChangeText={(v) => handleChange(def.key, v)}
                      onBlur={() => handleBlur(def.key)}
                      placeholder={def.placeholder}
                      secureTextEntry={def.key === "otp_code"}
                      keyboardType={def.keyboardType}
                      autoCapitalize={def.autoCapitalize}
                      editable={canEdit && !def.locked}
                      error={fieldError(def.key)}
                      hint={def.locked ? def.lockHint : def.patternHint}
                      right={
                        def.key === "otp_code" && !otpSent ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            label="Send code"
                            onPress={handleSendOtp}
                            loading={submitting}
                          />
                        ) : null
                      }
                    />
                  );
                })}

                <View style={{ marginTop: SPACE.x2 }}>
                  <Button
                    label={
                      requestStatus === "declined"
                        ? "Resubmit for verification"
                        : "Submit for verification"
                    }
                    size="lg"
                    fullWidth
                    loading={submitting}
                    disabled={!canEdit || submitting || !otpSent}
                    onPress={handleSubmit}
                  />
                </View>

                {!otpSent && canEdit && (
                  <Text
                    style={{
                      ...TYPE.caption,
                      color: colors.inkFaint,
                      textAlign: "center",
                      marginTop: SPACE.x3,
                    }}
                  >
                    Tap Send code to receive a 6-digit code at your school email.
                  </Text>
                )}
              </Card>
            </Reveal>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!notice} onClose={() => setNotice(null)} maxWidth={440} accessibilityLabel={notice?.title ?? "Notice"}>
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>{notice?.title}</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>{notice?.message}</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: SPACE.x5 }}>
            <Button label="Got it" onPress={() => setNotice(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}