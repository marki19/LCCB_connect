import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Building2,
  CheckCircle2,
  Megaphone,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react-native";
import {
  getAudienceCount,
  listAnnouncements,
  sendAnnouncement,
  type Announcement,
} from "../../src/lib/adminApi";
import { fetchDepartments } from "../../src/lib/catalog";
import { useTheme } from "../../src/contexts/ThemeContext";
import { ThemeTokens } from "../../src/lib/tokens";
import type { Department } from "../../src/types";
import ActionDialog from "../../src/components/admin/ActionDialog";
import PageHeader from "../../src/components/admin/PageHeader";

type AudienceType = "all" | "role" | "department";

const ROLE_OPTIONS = [
  { value: "student", label: "Students" },
  { value: "faculty", label: "Faculty" },
  { value: "departmentAdmin", label: "Dept. admins" },
  { value: "admin", label: "Admins" },
  { value: "superadmin", label: "Superadmins" },
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

export default function AdminAnnouncementsScreen() {
  const { colors } = useTheme();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [role, setRole] = useState("student");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
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

  useEffect(() => {
    let cancelled = false;
    void fetchDepartments()
      .then((rows) => {
        if (cancelled) return;
        setDepartments(rows);
        if (rows[0]?.id) setDepartmentId((current) => current || rows[0].id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const audience = useMemo(() => {
    if (audienceType === "role") return { type: "role" as const, role };
    if (audienceType === "department") {
      return { type: "department" as const, department_id: departmentId };
    }
    return { type: "all" as const };
  }, [audienceType, role, departmentId]);

  const audienceLabel = useMemo(() => {
    if (audience.type === "all") return "Everyone";
    if (audience.type === "role") {
      return ROLE_OPTIONS.find((option) => option.value === audience.role)?.label || audience.role;
    }
    return (
      departments.find((department) => department.id === audience.department_id)?.name ||
      "Selected department"
    );
  }, [audience, departments]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (audienceType === "department" && !departmentId) {
        setCount(null);
        return;
      }
      setCountLoading(true);
      try {
        const result = await getAudienceCount(audience as any);
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
  }, [audience, audienceType, departmentId]);

  const loadHistory = useCallback(
    async (cursor: string | null, append: boolean) => {
      await Promise.resolve();
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
    (count ?? 0) > 0;

  const send = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await sendAnnouncement({
        title: title.trim(),
        body: body.trim(),
        audience: audience as any,
      });
      setConfirming(false);
      setTitle("");
      setBody("");
      setNotice(
        `Announcement sent to ${result.recipients} recipient${result.recipients === 1 ? "" : "s"
        }.`
      );
      await loadHistory(null, false);
    } catch (e: any) {
      setError(e?.message || "Could not send the announcement.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

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
          <Text style={{ marginLeft: 8, flex: 1, fontWeight: "600", color: colors.successText }}>
            {notice}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 24 }}>
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
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary }}>
                New announcement
              </Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                Title and body are required.
              </Text>
            </View>
          </View>

          <Text style={{ marginBottom: 6, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
            Title
          </Text>
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

          <Text style={{ marginBottom: 6, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
            Body
          </Text>
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

          <Text style={{ marginBottom: 8, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
            Audience
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            <Chip
              label="Everyone"
              active={audienceType === "all"}
              onPress={() => setAudienceType("all")}
              colors={colors}
            />
            <Chip
              label="By role"
              active={audienceType === "role"}
              onPress={() => setAudienceType("role")}
              colors={colors}
            />
            <Chip
              label="By department"
              active={audienceType === "department"}
              onPress={() => setAudienceType("department")}
              colors={colors}
            />
          </View>

          {audienceType === "role" ? (
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
            ) : audienceType === "role" ? (
              <Users size={17} color={colors.textTertiary} />
            ) : (
              <ShieldCheck size={17} color={colors.textTertiary} />
            )}
            <Text style={{ marginLeft: 8, flex: 1, fontSize: 13, color: colors.textSecondary }}>
              {audienceLabel}
            </Text>
            {countLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
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
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : history.length === 0 ? (
            <Text style={{ paddingVertical: 40, textAlign: "center", fontSize: 13, color: colors.textTertiary }}>
              No announcements sent yet.
            </Text>
          ) : (
            history.map((item) => (
              <View
                key={item.id}
                style={{
                  marginBottom: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.divider,
                  paddingBottom: 14,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}>{item.title}</Text>
                <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: colors.textSecondary }} numberOfLines={3}>
                  {item.body}
                </Text>
                <Text style={{ marginTop: 8, fontSize: 12, color: colors.textTertiary }}>
                  {item.recipients} recipient{item.recipients === 1 ? "" : "s"} ·{" "}
                  {formatDate(item.created_at)} · {item.actor_username || "system"}
                </Text>
                <Text style={{ marginTop: 2, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: colors.textMuted }}>
                  {item.audience?.type === "role"
                    ? `Role: ${item.audience.role}`
                    : item.audience?.type === "department"
                    ? "Department audience"
                    : "Everyone"}
                </Text>
              </View>
            ))
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
                <ActivityIndicator size="small" color={colors.primary} />
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
        description={`“${title.trim() || "Untitled"}” will be delivered in-app to ${count ?? 0} recipient${
          count === 1 ? "" : "s"
        } in ${audienceLabel}.`}
        confirmLabel="Send now"
        showReason={false}
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void send()}
      />
    </ScrollView>
  );
}
