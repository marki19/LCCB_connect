import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Building2, Calendar, CheckCircle2, Megaphone, Send, ShieldCheck, Users, GraduationCap, Pin, Bell } from "lucide-react-native";
import {
  getAudienceCount,
  listAnnouncements,
  sendAnnouncement,
  type Announcement,
  type AnnouncementAudience,
  updateAnnouncement,
  deleteAnnouncement,
} from "../../src/lib/adminApi";
import { fetchDepartments, fetchCourses } from "../../src/lib/catalog";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useToast } from "../../src/contexts/ToastContext";
import { ThemeTokens } from "../../src/lib/tokens";
import type { Department } from "../../src/types";
import ActionDialog from "../../src/components/admin/ActionDialog";
import PageHeader from "../../src/components/admin/PageHeader";
import DatePickerField from "../../src/components/ui/DatePickerField";

type AudienceType = "all" | "role" | "department" | "course" | "year_level";

const ROLE_OPTIONS = [
  { value: "student", label: "Students" },
  { value: "faculty", label: "Faculty" },
  { value: "departmentAdmin", label: "Dept. admins" },
  { value: "admin", label: "Admins" },
  { value: "superadmin", label: "Superadmins" },
] as const;

const ACADEMIC_LEVELS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
  "IBED",
  "Integrated Studies",
] as const;

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Chip({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ThemeTokens;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        marginBottom: 8,
        marginRight: 8,
        borderRadius: 9999,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primarySurface : colors.surface,
        paddingHorizontal: 14,
        paddingVertical: 7,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          color: active ? colors.primary : colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SectionLabel({ children, colors }: { children: React.ReactNode; colors: ThemeTokens }) {
  return (
    <Text style={{ marginBottom: 6, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
      {children}
    </Text>
  );
}

export default function AdminAnnouncementsScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { profile } = useAuth();
  const isCampusAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const myDeptId = profile?.department_id;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [role, setRole] = useState("student");
  const [departmentId, setDepartmentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [pinned, setPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string; department_id: string }[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<{ id: string; name: string; department_id: string }[]>([]);

  const [count, setCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [history, setHistory] = useState<Announcement[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyMore, setHistoryMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editPinned, setEditPinned] = useState(false);
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load departments on mount
  useEffect(() => {
    let cancelled = false;
    fetchDepartments()
      .then((rows) => {
        if (cancelled) return;
        setDepartments(rows);
        if (rows[0]?.id && !isCampusAdmin) setDepartmentId(rows[0].id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isCampusAdmin]);

  // Load courses when department changes
  useEffect(() => {
    if (!departmentId) {
      setCourses([]);
      setFilteredCourses([]);
      setCourseId("");
      return;
    }
    let cancelled = false;
    fetchCourses(departmentId)
      .then((rows) => {
        if (cancelled) return;
        setCourses(rows);
        setFilteredCourses(rows);
        if (rows[0]?.id) setCourseId(rows[0].id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [departmentId]);

  // Build audience object for API
  const audience = useMemo((): AnnouncementAudience => {
    switch (audienceType) {
      case "role":
        return { type: "role", role: role as any };
      case "department":
        return { type: "department", department_id: departmentId };
      case "course":
        return { type: "course", course_id: courseId };
      case "year_level":
        return { type: "year_level", year_level: yearLevel };
      default:
        return { type: "all" };
    }
  }, [audienceType, role, departmentId, courseId, yearLevel]);

  const audienceLabel = useMemo(() => {
    switch (audience.type) {
      case "all":
        return "Everyone";
      case "role":
        return ROLE_OPTIONS.find((option) => option.value === audience.role)?.label || audience.role;
      case "department":
        return departments.find((d) => d.id === audience.department_id)?.name || "Selected department";
      case "course": {
        const c = courses.find((c) => c.id === audience.course_id);
        return c?.name || "Selected course";
      }
      case "year_level":
        return `Year: ${audience.year_level}`;
      default:
        return "Unknown";
    }
  }, [audience, departments, courses]);

  // Audience count
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (audienceType === "department" && !departmentId) {
        setCount(null);
        return;
      }
      if (audienceType === "course" && !courseId) {
        setCount(null);
        return;
      }
      if (audienceType === "year_level" && !yearLevel) {
        setCount(null);
        return;
      }
      setCountLoading(true);
      try {
        const result = await getAudienceCount(audience);
        if (!cancelled) setCount(result.count);
      } catch {
        if (!cancelled) setCount(null);
      } finally {
        if (!cancelled) setCountLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [audience, audienceType, departmentId, courseId, yearLevel]);

  // Load history
  const loadHistory = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (append) setHistoryMore(true);
      else {
        setHistoryLoading(true);
        setHistory([]);
      }
      setError("");
      try {
        const page = await listAnnouncements({ limit: 20, cursor });
        setHistory((current) => (append ? [...current, ...page.items] : page.items));
        setHistoryTotal(page.total);
        setHistoryCursor(page.next_cursor);
      } catch (e: any) {
        setError(e?.message || "Could not load announcement history.");
      } finally {
        setHistoryLoading(false);
        setHistoryMore(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadHistory(null, false), 0);
    return () => clearTimeout(timer);
  }, [loadHistory]);

  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (audienceType !== "department" || !!departmentId) &&
    (audienceType !== "course" || !!courseId) &&
    (audienceType !== "year_level" || !!yearLevel) &&
    (count ?? 0) > 0;

  const send = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await sendAnnouncement({
        title: title.trim(),
        body: body.trim(),
        audience,
        pinned,
        expires_at: expiresAt || null,
      });
      setConfirming(false);
      setTitle("");
      setBody("");
      setPinned(false);
      setExpiresAt("");
      const successMsg = `Announcement sent to ${result.recipients} recipient${result.recipients === 1 ? "" : "s"}.`;
      setNotice(successMsg);
      showToast({ message: successMsg, tone: "success" });
      await loadHistory(null, false);
    } catch (e: any) {
      setError(e?.message || "Could not send the announcement.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (item: Announcement) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditBody(item.body);
    setEditPinned(item.pinned ?? false);
    setEditExpiresAt(item.expires_at ? new Date(item.expires_at).toISOString().slice(0, 16) : "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setBusy(true);
    try {
      await updateAnnouncement(editingId, {
        title: editTitle.trim() || undefined,
        body: editBody.trim() || undefined,
        pinned: editPinned,
        expires_at: editExpiresAt || null,
      });
      setEditingId(null);
      setNotice("Announcement updated.");
      showToast({ message: "Announcement updated.", tone: "success" });
      await loadHistory(null, false);
    } catch (e: any) {
      setError(e?.message || "Could not update announcement.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (id: string) => setDeletingId(id);

  const doDelete = async () => {
    if (!deletingId) return;
    setBusy(true);
    try {
      await deleteAnnouncement(deletingId);
      setDeletingId(null);
      setNotice("Announcement deleted.");
      showToast({ message: "Announcement deleted.", tone: "info" });
      await loadHistory(null, false);
    } catch (e: any) {
      setError(e?.message || "Could not delete announcement.");
      setDeletingId(null);
    } finally {
      setBusy(false);
    }
  };

  // Available audience types based on role
  const allowedAudienceTypes = useMemo((): AudienceType[] => {
    if (isCampusAdmin) return ["all", "role", "department", "course", "year_level"];
    // Department admins: department, course, year_level
    return ["department", "course", "year_level"];
  }, [isCampusAdmin]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        eyebrow="Governance / broadcast"
        title="Announcements"
        description="Send one message to a counted audience. Delivery is in-app."
        onRefresh={() => void loadHistory(null, false)}
        refreshing={historyLoading}
      />

      {error ? (
        <View
          style={{
            marginBottom: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.destructive,
            backgroundColor: colors.destructiveSurface,
            padding: 16,
          }}
        >
          <Text style={{ fontWeight: "600", color: colors.destructiveText }}>{error}</Text>
        </View>
      ) : null}
      {notice ? (
        <View
          style={{
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.success,
            backgroundColor: colors.successSurface,
            padding: 16,
          }}
        >
          <CheckCircle2 size={18} color={colors.success} />
          <Text style={{ marginLeft: 8, flex: 1, fontWeight: "600", color: colors.successText }}>{notice}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 24 }}>
        {/* Compose panel */}
        <View
          style={{
            minWidth: 420,
            flex: 1.3,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 24,
          }}
        >
          <View style={{ marginBottom: 20, flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                marginRight: 12,
                height: 40,
                width: 40,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                backgroundColor: colors.primarySurface,
              }}
            >
              <Megaphone size={19} color={colors.primary} />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary }}>New announcement</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>Title and body are required.</Text>
            </View>
          </View>

          <SectionLabel colors={colors}>Title</SectionLabel>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder="e.g. Enrollment opens Monday"
            placeholderTextColor={colors.textMuted}
            style={{
              marginBottom: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              backgroundColor: colors.inputBg,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              color: colors.textPrimary,
            }}
          />

          <SectionLabel colors={colors}>Body</SectionLabel>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={6}
            maxLength={2000}
            placeholder="Write the announcement…"
            placeholderTextColor={colors.textMuted}
            textAlignVertical="top"
            style={{
              marginBottom: 16,
              minHeight: 140,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              backgroundColor: colors.inputBg,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              color: colors.textPrimary,
            }}
          />

          <SectionLabel colors={colors}>Audience</SectionLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {allowedAudienceTypes.map((type) => (
              <Chip
                key={type}
                label={
                  type === "all"
                    ? "Everyone"
                    : type === "role"
                    ? "By role"
                    : type === "department"
                    ? "By department"
                    : type === "course"
                    ? "By course"
                    : "By year level"
                }
                active={audienceType === type}
                onPress={() => setAudienceType(type)}
                colors={colors}
              />
            ))}
          </View>

          {audienceType === "role" && allowedAudienceTypes.includes("role") ? (
            <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap" }}>
              {ROLE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  active={role === option.value}
                  onPress={() => setRole(option.value)}
                  colors={colors}
                />
              ))}
            </View>
          ) : null}

          {audienceType === "department" ? (
            <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap" }}>
              {departments.map((department) => (
                <Chip
                  key={department.id}
                  label={department.name}
                  active={departmentId === department.id}
                  onPress={() => setDepartmentId(department.id)}
                  colors={colors}
                />
              ))}
            </View>
          ) : null}

          {audienceType === "course" ? (
            <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap" }}>
              {filteredCourses.map((course) => (
                <Chip
                  key={course.id}
                  label={course.name}
                  active={courseId === course.id}
                  onPress={() => setCourseId(course.id)}
                  colors={colors}
                />
              ))}
            </View>
          ) : null}

          {audienceType === "year_level" ? (
            <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap" }}>
              {ACADEMIC_LEVELS.map((level) => (
                <Chip
                  key={level}
                  label={level}
                  active={yearLevel === level}
                  onPress={() => setYearLevel(level)}
                  colors={colors}
                />
              ))}
            </View>
          ) : null}

          {/* Pin + Expiry */}
          <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => setPinned(!pinned)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: pinned ? colors.primary : colors.border,
                backgroundColor: pinned ? colors.primarySurface : colors.surface,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Pin size={16} color={pinned ? colors.primary : colors.textTertiary} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: pinned ? colors.primary : colors.textSecondary }}>
                Pin to top of feed
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Bell size={16} color={colors.textTertiary} />
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>Expires</Text>
              <DatePickerField
                compact
                mode="datetime"
                value={expiresAt}
                onChange={setExpiresAt}
                placeholder="YYYY-MM-DDTHH:MM"
                minDate={new Date()}
                containerStyle={{ width: 195 }}
              />
            </View>
          </View>

          <View
            style={{
              marginTop: 20,
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSunken,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            {audienceType === "department" ? (
              <Building2 size={17} color={colors.textTertiary} />
            ) : audienceType === "course" ? (
              <GraduationCap size={17} color={colors.textTertiary} />
            ) : audienceType === "year_level" ? (
              <Calendar size={17} color={colors.textTertiary} />
            ) : audienceType === "role" ? (
              <Users size={17} color={colors.textTertiary} />
            ) : (
              <ShieldCheck size={17} color={colors.textTertiary} />
            )}
            <Text style={{ marginLeft: 8, flex: 1, fontSize: 13, color: colors.textSecondary }}>{audienceLabel}</Text>
            {countLoading ? (
              <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.primary} />
            ) : (
              <Text style={{ fontSize: 13, fontWeight: "800", color: colors.textPrimary }}>
                {count ?? "—"} recipient{count === 1 ? "" : "s"}
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setConfirming(true)}
            disabled={!canSend}
            style={{
              marginTop: 20,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              backgroundColor: colors.primary,
              paddingHorizontal: 20,
              paddingVertical: 12,
              opacity: !canSend ? 0.45 : 1,
            }}
          >
            <Send size={16} color={colors.textOnPrimary} />
            <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: "700", color: colors.textOnPrimary }}>
              Send announcement
            </Text>
          </TouchableOpacity>
          {count === 0 ? (
            <Text style={{ marginTop: 8, fontSize: 12, color: colors.destructiveText }}>
              This audience has no eligible recipients.
            </Text>
          ) : null}
        </View>

        {/* History panel */}
        <View
          style={{
            minWidth: 360,
            flex: 1,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 24,
          }}
        >
          <View style={{ marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary }}>History</Text>
            <Text style={{ fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
              {historyTotal} sent
            </Text>
          </View>

          {historyLoading ? (
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48 }}>
              <ActivityIndicator accessibilityLabel="Loading" size="large" color={colors.primary} />
            </View>
          ) : history.length === 0 ? (
            <Text style={{ paddingVertical: 40, textAlign: "center", fontSize: 13, color: colors.textTertiary }}>
              No announcements sent yet.
            </Text>
          ) : (
            history.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <View
                  key={item.id}
                  style={{
                    marginBottom: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.divider,
                    paddingBottom: 14,
                  }}
                >
                  {isEditing ? (
                    <View style={{ gap: 12 }}>
                      <TextInput
                        value={editTitle}
                        onChangeText={setEditTitle}
                        maxLength={120}
                        style={{
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: colors.inputBorder,
                          backgroundColor: colors.inputBg,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          fontSize: 14,
                          color: colors.textPrimary,
                          fontWeight: "700",
                        }}
                      />
                      <TextInput
                        value={editBody}
                        onChangeText={setEditBody}
                        multiline
                        numberOfLines={4}
                        maxLength={2000}
                        style={{
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: colors.inputBorder,
                          backgroundColor: colors.inputBg,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          fontSize: 13,
                          color: colors.textPrimary,
                        }}
                      />
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                        <TouchableOpacity
                          onPress={() => setEditPinned(!editPinned)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: editPinned ? colors.primary : colors.border,
                            backgroundColor: editPinned ? colors.primarySurface : colors.surface,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                          }}
                        >
                          <Pin size={14} color={editPinned ? colors.primary : colors.textTertiary} />
                          <Text style={{ fontSize: 12, fontWeight: "600", color: editPinned ? colors.primary : colors.textSecondary }}>
                            Pinned
                          </Text>
                        </TouchableOpacity>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Calendar size={14} color={colors.textTertiary} />
                          <Text style={{ fontSize: 11, color: colors.textTertiary }}>Expires</Text>
                          <DatePickerField
                            compact
                            mode="datetime"
                            value={editExpiresAt}
                            onChange={setEditExpiresAt}
                            placeholder="YYYY-MM-DDTHH:MM"
                            containerStyle={{ width: 180 }}
                          />
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                          onPress={saveEdit}
                          disabled={busy}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 8,
                            backgroundColor: colors.primary,
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            opacity: busy ? 0.5 : 1,
                          }}
                        >
                          <CheckCircle2 size={14} color={colors.textOnPrimary} />
                          <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: "700", color: colors.textOnPrimary }}>
                            Save
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setEditingId(null)}
                          disabled={busy}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.surface,
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}>
                        {item.pinned ? "📌 " : ""}{item.title}
                      </Text>
                      <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: colors.textSecondary }} numberOfLines={3}>
                        {item.body}
                      </Text>
                      <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                        <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                          {item.recipients} recipient{item.recipients === 1 ? "" : "s"} ·{" "}
                          {formatDate(item.created_at)} · {item.actor_username || "system"}
                        </Text>
                        <Text style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: colors.textTertiary }}>
                          {item.audience?.type === "role"
                            ? `Role: ${item.audience.role}`
                            : item.audience?.type === "department"
                            ? "Department"
                            : item.audience?.type === "course"
                            ? "Course"
                            : item.audience?.type === "year_level"
                            ? `Year: ${item.audience.year_level}`
                            : "Everyone"}
                        </Text>
                        {item.pinned && (
                          <Text
                            style={{
                              fontSize: 11,
                              textTransform: "uppercase",
                              letterSpacing: 0.6,
                              color: colors.primary,
                              backgroundColor: colors.primarySurface,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4,
                            }}
                          >
                            Pinned
                          </Text>
                        )}
                        {item.expires_at && (
                          <Text
                            style={{
                              fontSize: 11,
                              textTransform: "uppercase",
                              letterSpacing: 0.6,
                              color: colors.accentText,
                              backgroundColor: colors.accentWash,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4,
                            }}
                          >
                            Expires {formatDate(item.expires_at)}
                          </Text>
                        )}
                      </View>
                      <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => startEdit(item)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.surface,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary }}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => confirmDelete(item.id)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: colors.destructive,
                            backgroundColor: colors.destructiveSurface,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.destructiveText }}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              );
            })
          )}

          {historyCursor ? (
            <TouchableOpacity
              onPress={() => void loadHistory(historyCursor, true)}
              disabled={historyMore}
              style={{
                marginTop: 8,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                paddingVertical: 10,
              }}
            >
              {historyMore ? (
                <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.primary} />
              ) : (
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textSecondary }}>Load more</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ActionDialog
        key={confirming ? "open" : "closed"}
        visible={confirming}
        title="Send announcement?"
        description={`“${title.trim() || "Untitled"}” will be delivered in-app to ${count ?? 0} recipient${count === 1 ? "" : "s"} in ${audienceLabel}.`}
        confirmLabel="Send now"
        showReason={false}
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void send()}
      />

      {deletingId ? (
        <ActionDialog
          key="delete"
          visible={true}
          title="Delete announcement?"
          description="This removes the post and its notification from every recipient's bell. It cannot be undone."
          confirmLabel="Delete"
          destructive={true}
          showReason={false}
          busy={busy}
          onCancel={() => setDeletingId(null)}
          onConfirm={() => void doDelete()}
        />
      ) : null}
    </ScrollView>
  );
}

function ActivityIndicator({ accessibilityLabel, size, color }: { accessibilityLabel: string; size: "small" | "large"; color: string }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color, fontSize: size === "large" ? 16 : 12 }}>{accessibilityLabel}</Text>
    </View>
  );
}