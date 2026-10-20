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
  RefreshCw,
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
import type { Department } from "../../src/types";
import ActionDialog from "../../src/components/admin/ActionDialog";

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
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`mb-2 mr-2 rounded-full border px-3.5 py-2 ${
        active ? "border-[#1D4ED8] bg-blue-50" : "border-slate-200 bg-white"
      }`}
    >
      <Text
        className={`text-xs font-bold ${
          active ? "text-[#1D4ED8]" : "text-slate-600"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminAnnouncementsScreen() {
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
        `Announcement sent to ${result.recipients} recipient${
          result.recipients === 1 ? "" : "s"
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
      className="flex-1 bg-[#F8FAFC] p-8"
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-6 flex-row flex-wrap items-start justify-between gap-4">
        <View>
          <Text className="text-3xl font-black tracking-tight text-slate-900">
            Announcements
          </Text>
          <Text className="mt-1 text-base text-slate-500">
            Send one message to a counted audience. Delivery is in-app.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => void loadHistory(null, false)}
          className="flex-row items-center rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm"
        >
          <RefreshCw size={16} color="#475569" />
          <Text className="ml-2 text-sm font-semibold text-slate-700">Refresh</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4">
          <Text className="font-semibold text-red-600">{error}</Text>
        </View>
      ) : null}
      {notice ? (
        <View className="mb-4 flex-row items-center rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <CheckCircle2 size={18} color="#059669" />
          <Text className="ml-2 flex-1 font-semibold text-emerald-700">{notice}</Text>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-6">
        <View className="min-w-[420px] flex-[1.3] rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <View className="mb-5 flex-row items-center">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <Megaphone size={19} color="#1D4ED8" />
            </View>
            <View>
              <Text className="text-lg font-bold text-slate-800">New announcement</Text>
              <Text className="text-xs text-slate-400">Title and body are required.</Text>
            </View>
          </View>

          <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Title
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder="e.g. Enrollment opens Monday"
            placeholderTextColor="#94A3B8"
            className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900"
          />

          <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Body
          </Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={6}
            maxLength={2000}
            placeholder="Write the announcement…"
            placeholderTextColor="#94A3B8"
            className="mb-4 min-h-[140px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900"
            textAlignVertical="top"
          />

          <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Audience
          </Text>
          <View className="flex-row flex-wrap">
            <Chip
              label="Everyone"
              active={audienceType === "all"}
              onPress={() => setAudienceType("all")}
            />
            <Chip
              label="By role"
              active={audienceType === "role"}
              onPress={() => setAudienceType("role")}
            />
            <Chip
              label="By department"
              active={audienceType === "department"}
              onPress={() => setAudienceType("department")}
            />
          </View>

          {audienceType === "role" ? (
            <View className="mt-2 flex-row flex-wrap">
              {ROLE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  active={role === option.value}
                  onPress={() => setRole(option.value)}
                />
              ))}
            </View>
          ) : null}

          {audienceType === "department" ? (
            <View className="mt-2 flex-row flex-wrap">
              {departments.map((department) => (
                <Chip
                  key={department.id}
                  label={department.name}
                  active={departmentId === department.id}
                  onPress={() => setDepartmentId(department.id)}
                />
              ))}
            </View>
          ) : null}

          <View className="mt-5 flex-row items-center rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            {audienceType === "department" ? (
              <Building2 size={17} color="#64748B" />
            ) : audienceType === "role" ? (
              <Users size={17} color="#64748B" />
            ) : (
              <ShieldCheck size={17} color="#64748B" />
            )}
            <Text className="ml-2 flex-1 text-sm text-slate-600">
              {audienceLabel}
            </Text>
            {countLoading ? (
              <ActivityIndicator size="small" color="#1D4ED8" />
            ) : (
              <Text className="text-sm font-bold text-slate-800">
                {count ?? "—"} recipient{count === 1 ? "" : "s"}
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setConfirming(true)}
            disabled={!canSend}
            className={`mt-5 flex-row items-center justify-center rounded-xl bg-[#1D4ED8] px-5 py-3 ${
              !canSend ? "opacity-40" : ""
            }`}
          >
            <Send size={17} color="#FFFFFF" />
            <Text className="ml-2 font-bold text-white">Send announcement</Text>
          </TouchableOpacity>
          {count === 0 ? (
            <Text className="mt-2 text-xs text-red-500">
              This audience has no eligible recipients.
            </Text>
          ) : null}
        </View>

        <View className="min-w-[360px] flex-1 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-slate-800">History</Text>
            <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {historyTotal} sent
            </Text>
          </View>

          {historyLoading ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color="#1D4ED8" />
            </View>
          ) : history.length === 0 ? (
            <Text className="py-10 text-center text-sm text-slate-400">
              No announcements sent yet.
            </Text>
          ) : (
            history.map((item) => (
              <View
                key={item.id}
                className="mb-3 border-b border-slate-100 pb-4 last:border-0"
              >
                <Text className="text-sm font-bold text-slate-800">{item.title}</Text>
                <Text className="mt-1 text-xs leading-5 text-slate-500" numberOfLines={3}>
                  {item.body}
                </Text>
                <Text className="mt-2 text-xs text-slate-400">
                  {item.recipients} recipient{item.recipients === 1 ? "" : "s"} ·{" "}
                  {formatDate(item.created_at)} · {item.actor_username || "system"}
                </Text>
                <Text className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">
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
              className="mt-2 flex-row items-center justify-center rounded-xl border border-slate-200 py-2.5"
            >
              {historyMore ? (
                <ActivityIndicator size="small" color="#1D4ED8" />
              ) : (
                <Text className="text-sm font-bold text-slate-700">Load more</Text>
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
