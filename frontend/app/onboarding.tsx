import { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, SafeAreaView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useToast } from "../src/contexts/ToastContext";
import { apiJson, ApiError } from "../src/lib/api";
import { RADIUS, SPACE, TYPE } from "../src/lib/tokens";
import Button from "../src/components/ui/Button";
import Card from "../src/components/ui/Card";
import Modal from "../src/components/ui/Modal";
import Reveal from "../src/components/ui/Reveal";
import VerificationForm from "../src/components/verification/VerificationForm";
import type { SelectableRole, VerificationRole } from "../src/lib/verification";

type VerificationStatus = "unverified" | "pending" | "approved" | "declined";

interface VerificationRequest {
  id: string;
  user_id: string;
  role: string;
  full_name?: string;
  student_id?: string;
  department_id?: string;
  department_name?: string;
  course_id?: string;
  course_name?: string;
  year_level?: string;
  birthdate?: string;
  status: VerificationStatus;
  note?: string | null;
  submitted_at?: string;
  reviewed_at?: string;
  reviewed_by_name?: string;
}

interface MineResponse {
  request: VerificationRequest | null;
  can_resubmit: boolean;
  /** The role the form renders for, or null while the role is still unchosen. */
  role: VerificationRole | null;
  fields: { department: boolean; course: boolean; yearLevel: boolean } | null;
  /** The roles this account may still pick, or null once one is set. */
  selectable_roles: SelectableRole[] | null;
  school_account: boolean;
}

type Notice = { title: string; message: string };

/** The onboarding choices, in the order the picker shows them. */
const ROLE_CHOICES: { role: SelectableRole; title: string; blurb: string }[] = [
  { role: "student", title: "Student", blurb: "Enrolled in a course at LCCB." },
  { role: "faculty", title: "Faculty", blurb: "Teaching staff of a department." },
  { role: "departmentAdmin", title: "Department admin", blurb: "Runs a department and reviews its requests." },
  { role: "admin", title: "Campus admin", blurb: "Reviews requests across the whole campus." },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { refreshProfile, profile } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [mine, setMine] = useState<MineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  /** The role a not-yet-verified account is previewing, before it commits. */
  const [previewRole, setPreviewRole] = useState<SelectableRole | null>(null);

  const loadMine = useCallback(
    async (role?: SelectableRole | null) => {
      try {
        const query = role ? `?role=${encodeURIComponent(role)}` : "";
        const data = await apiJson<MineResponse>(`/verification/mine${query}`);
        setMine(data);
      } catch (error: any) {
        if (error instanceof ApiError && error.status === 403) {
          // Non-school account or superadmin — the form will handle it
          setMine({
            request: null,
            can_resubmit: true,
            role: null,
            fields: null,
            selectable_roles: null,
            school_account: false,
          });
        } else if (error instanceof ApiError && error.status === 404) {
          setMine({
            request: null,
            can_resubmit: true,
            role: null,
            fields: null,
            selectable_roles: null,
            school_account: profile?.email?.endsWith("@lccbonline.edu.ph") ?? false,
          });
        } else {
          console.error("Failed to load verification:", error);
          setNotice({
            title: "Could not load your status",
            message: "We couldn't check your verification status. Pull to refresh.",
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [profile?.email]
  );

  useEffect(() => {
    if (profile) {
      if (profile.role === "guest" && profile.verification_status === "pending") {
        router.replace("/pending-review" as any);
        return;
      }
      const isOutsider =
        profile.account_kind === "outsider" ||
        (profile.email && !profile.email.endsWith("@lccbonline.edu.ph"));
      if (profile.role === "user" && isOutsider && !profile.guest_declared_at) {
        router.replace("/guest-declaration" as any);
        return;
      }
    }
  }, [profile, router]);

  useEffect(() => {
    loadMine(previewRole);
  }, [loadMine, previewRole]);

  // The server resolves the role: the profile's own once one is granted, or the
  // one being previewed while the account has not chosen yet.
  const role: VerificationRole | null = mine
    ? mine.role
    : ((profile?.role as VerificationRole | undefined) ?? null);
  const isAdmin = role === "superadmin" || role === "admin";
  const isSuperadmin = role === "superadmin";
  const fullNameLocked = !!profile?.full_name;
  const needsRole = !role && !!mine?.selectable_roles?.length;

  // Build initial values from latest request or profile
  const initialValues = mine?.request
    ? {
        full_name: mine.request.full_name ?? "",
        student_id: mine.request.student_id ?? "",
        department_id: mine.request.department_id ?? "",
        course_id: mine.request.course_id ?? "",
        year_level: mine.request.year_level ?? "",
        birthdate: mine.request.birthdate ?? "",
      }
    : {
        full_name: profile?.full_name ?? "",
        student_id: profile?.student_id ?? "",
        department_id: profile?.department_id ?? "",
        course_id: profile?.course_id ?? "",
        year_level: profile?.year_level ?? "",
        birthdate: "",
      };

  const handleSendOtp = useCallback(async () => {
    try {
      await apiJson("/verification/otp", { method: "POST", body: "{}" });
      return { ok: true };
    } catch (error: any) {
      if (error instanceof ApiError) {
        return { ok: false, error: error.message };
      }
      return { ok: false, error: "Could not send code" };
    }
  }, []);

  const handleSubmit = useCallback(
    async (payload: {
      role: SelectableRole;
      full_name: string;
      student_id: string;
      department_id: string | null;
      course_id: string | null;
      year_level: string | null;
      birthdate: string;
      otp_code: string;
    }) => {
      try {
        if (mine?.request?.status === "pending") {
          await apiJson("/verification/mine", {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        } else {
          await apiJson("/verification", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }
        await loadMine(previewRole);
        await refreshProfile();
        showToast({
          message: "Verification submitted successfully.",
          tone: "success",
        });
        return { ok: true };
      } catch (error: any) {
        if (error instanceof ApiError) {
          if (error.status === 400 && error.body?.fields) {
            return { ok: false, fields: error.body.fields };
          }
          return { ok: false, error: error.message };
        }
        return { ok: false, error: "Submission failed" };
      }
    },
    [mine, loadMine, previewRole, refreshProfile, showToast]
  );

  const handleSkip = useCallback(() => {
    // Verification is optional at signup. The feed shows an identity banner
    // that leads back here, and the server keeps posting locked until the
    // profile is verified.
    router.replace("/(tabs)/");
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfacePage,
        }}
      >
        <Reveal style={{ width: "100%", maxWidth: 540, alignSelf: "center" }}>
          <Card style={{ padding: SPACE.x8, alignItems: "center" }}>
            <Text style={{ ...TYPE.h1, color: colors.ink, textAlign: "center", marginBottom: SPACE.x4 }}>
              {isSuperadmin ? "Superadmin access" : "Verify your identity"}
            </Text>
            <Text style={{ ...TYPE.body, color: colors.inkSoft, textAlign: "center" }}>
              Loading your verification status…
            </Text>
          </Card>
        </Reveal>
      </SafeAreaView>
    );
  }

  // Admin & Superadmin — no verification needed
  if (isAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: SPACE.x6 }}>
          <Reveal style={{ width: "100%", maxWidth: 520, alignSelf: "center" }}>
            <Card style={{ padding: SPACE.x8, alignItems: "center" }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: RADIUS.xl,
                  backgroundColor: colors.brandWash,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: SPACE.x5,
                }}
              >
                <Text style={{ fontSize: 28 }}>🛡️</Text>
              </View>
              <Text style={{ ...TYPE.h1, color: colors.ink, textAlign: "center" }}>
                {isSuperadmin ? "Superadmin access" : "Administrator access"}
              </Text>
              <Text style={{ ...TYPE.body, color: colors.inkSoft, textAlign: "center" }}>
                Admin accounts do not require verification. You have full access already.
              </Text>
              <View style={{ marginTop: SPACE.x6, alignSelf: "stretch" }}>
                <Button label="Continue to app" fullWidth size="lg" onPress={() => router.replace("/(tabs)/")} />
              </View>
            </Card>
          </Reveal>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Pending — read-only summary
  const isPending = mine?.request?.status === "pending";
  const isApproved = mine?.request?.status === "approved" || profile?.verification_status === "verified";
  const isDeclined = mine?.request?.status === "declined";
  const requestStatus = profile?.verification_status === "verified" ? "approved" : (mine?.request?.status ?? "unverified");

  if (isPending) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
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
                {[
                  { label: "Full name", value: mine.request?.full_name },
                  { label: "Student ID", value: mine.request?.student_id },
                  { label: "Department", value: mine.request?.department_name },
                  { label: "Course", value: mine.request?.course_name },
                  { label: "Year level", value: mine.request?.year_level },
                  { label: "Birthdate", value: mine.request?.birthdate },
                ].map((row) => (
                  <View
                    key={row.label}
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
                    <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>{row.label}</Text>
                    <Text
                      style={{ ...TYPE.caption, fontWeight: "600", color: colors.ink, flexShrink: 1, textAlign: "right" }}
                      numberOfLines={1}
                    >
                      {row.value || "—"}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: SPACE.x6 }}>
                <Button label="Back to app" variant="secondary" fullWidth onPress={() => router.back()} />
              </View>
            </Card>
          </Reveal>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isApproved) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
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
                <Button label="Continue to app" fullWidth size="lg" onPress={() => router.replace("/(tabs)/")} />
              </View>
            </Card>
          </Reveal>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // No role yet — the account chooses what it is before the form makes sense.
  if (needsRole) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: SPACE.x6 }}>
          <View style={{ width: "100%", maxWidth: 520, alignSelf: "center" }}>
            <Reveal>
              <Text style={{ ...TYPE.h1, color: colors.ink }}>What are you at LCCB?</Text>
              <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2, marginBottom: SPACE.x6 }}>
                This decides who reviews your request.
              </Text>
              <Card style={{ padding: 0, overflow: "hidden" }}>
                {ROLE_CHOICES.map((choice, index) => (
                  <Pressable
                    key={choice.role}
                    onPress={() => setPreviewRole(choice.role)}
                    accessibilityRole="button"
                    accessibilityLabel={choice.title}
                    style={{
                      paddingHorizontal: SPACE.x5,
                      paddingVertical: SPACE.x4,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: colors.line,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: SPACE.x4,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...TYPE.bodyStrong, color: colors.ink }}>{choice.title}</Text>
                        <Text style={{ ...TYPE.caption, color: colors.inkSoft, marginTop: 2 }}>
                          {choice.blurb}
                        </Text>
                      </View>
                      <ChevronRight size={18} color={colors.inkFaint} />
                    </View>
                  </Pressable>
                ))}
              </Card>
            </Reveal>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // No verification path (a superadmin, or a non-school account).
  if (!role) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: SPACE.x6 }}>
          <Reveal style={{ width: "100%", maxWidth: 520, alignSelf: "center" }}>
            <Card style={{ padding: SPACE.x8, alignItems: "center" }}>
              <Text style={{ ...TYPE.h1, color: colors.ink, textAlign: "center" }}>
                This account does not verify
              </Text>
              <Text style={{ ...TYPE.body, color: colors.inkSoft, textAlign: "center", marginTop: SPACE.x2 }}>
                Verification is only available to @lccbonline.edu.ph accounts.
              </Text>
              <View style={{ marginTop: SPACE.x6, alignSelf: "stretch" }}>
                <Button label="Back to app" variant="secondary" fullWidth onPress={() => router.replace("/(tabs)/")} />
              </View>
            </Card>
          </Reveal>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Unverified or declined — show the form
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <VerificationForm
        role={role}
        fields={mine?.fields ?? null}
        schoolAccount={mine?.school_account ?? false}
        initialValues={initialValues}
        fullNameLocked={fullNameLocked}
        requestStatus={requestStatus}
        declineNote={mine?.request?.note ?? null}
        onSendOtp={handleSendOtp}
        onSubmit={handleSubmit}
        onSkip={handleSkip}
      />

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