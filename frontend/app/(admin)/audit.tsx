import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { RefreshCw, ScrollText, Search } from "lucide-react-native";
import { listAdminAudit, type AuditEntry } from "../../src/lib/adminApi";

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "user.role_change", label: "Role change" },
  { value: "user.suspend", label: "Suspend" },
  { value: "user.unsuspend", label: "Restore" },
  { value: "user.force_signout", label: "Force sign-out" },
  { value: "user.delete", label: "User delete" },
  { value: "content.hide", label: "Content hide" },
  { value: "content.restore", label: "Content restore" },
  { value: "content.delete", label: "Content delete" },
  { value: "report.review", label: "Report review" },
  { value: "report.dismiss", label: "Report dismiss" },
  { value: "announcement.send", label: "Announcement" },
  { value: "catalog.create", label: "Catalog create" },
  { value: "catalog.update", label: "Catalog update" },
  { value: "catalog.activate", label: "Catalog activate" },
  { value: "catalog.deactivate", label: "Catalog deactivate" },
];

function formatDate(value?: string | null, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function toIso(value: string, endOfDay = false) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
  const date = new Date(`${trimmed}T${endOfDay ? "23:59:59" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
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
      className={`mr-2 rounded-full border px-3.5 py-1.5 ${
        active ? "border-[#1D4ED8] bg-blue-50" : "border-slate-200 bg-white"
      }`}
    >
      <Text
        className={`text-xs font-bold ${
          active ? "text-[#1D4ED8]" : "text-slate-500"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminAuditScreen() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q]);

  const load = useCallback(
    async (nextCursor: string | null, append: boolean) => {
      const requestId = ++requestRef.current;
      await Promise.resolve();
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setEntries([]);
      }
      setError("");
      try {
        const page = await listAdminAudit({
          q: debouncedQ || undefined,
          action: action || undefined,
          from: toIso(from),
          to: toIso(to, true),
          limit: 30,
          cursor: nextCursor,
        });
        if (requestId !== requestRef.current) return;
        setEntries((current) => (append ? [...current, ...page.items] : page.items));
        setTotal(page.total);
        setCursor(page.next_cursor);
      } catch (e: any) {
        if (requestId !== requestRef.current) return;
        setError(e?.message || "Could not load the audit log.");
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [debouncedQ, action, from, to]
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(null, false), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <ScrollView
      className="flex-1 bg-[#F8FAFC] p-8"
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-6 flex-row flex-wrap items-start justify-between gap-4">
        <View>
          <Text className="text-3xl font-black tracking-tight text-slate-900">
            Audit log
          </Text>
          <Text className="mt-1 text-base text-slate-500">
            The append-only record of governance actions. Superadmin only.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => void load(null, false)}
          className="flex-row items-center rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm"
        >
          <RefreshCw size={16} color="#475569" />
          <Text className="ml-2 text-sm font-semibold text-slate-700">Refresh</Text>
        </TouchableOpacity>
      </View>

      <View className="mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <View className="flex-row flex-wrap items-center gap-3">
          <View className="min-w-[260px] flex-1 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3">
            <Search size={18} color="#94A3B8" />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search actor, target, or reason…"
              placeholderTextColor="#94A3B8"
              className="ml-2 flex-1 py-2.5 text-slate-900"
              autoCapitalize="none"
            />
          </View>
          <View className="flex-row items-center gap-2">
            <TextInput
              value={from}
              onChangeText={setFrom}
              placeholder="From YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
              className="w-36 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900"
            />
            <TextInput
              value={to}
              onChangeText={setTo}
              placeholder="To YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
              className="w-36 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900"
            />
          </View>
          <Text className="text-sm text-slate-400">
            {loading ? "Loading…" : `${total} entr${total === 1 ? "y" : "ies"}`}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
          {ACTION_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              active={action === option.value}
              onPress={() => setAction(option.value)}
            />
          ))}
        </ScrollView>
      </View>

      {error ? (
        <View className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4">
          <Text className="font-semibold text-red-600">{error}</Text>
        </View>
      ) : null}

      <View className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <View className="flex-row items-center border-b border-slate-100 bg-slate-50 px-5 py-3">
          <Text className="w-40 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            When
          </Text>
          <Text className="w-40 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Actor
          </Text>
          <Text className="w-44 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Action
          </Text>
          <Text className="flex-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Target
          </Text>
          <Text className="flex-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Reason
          </Text>
        </View>

        {loading ? (
          <View className="items-center justify-center py-16">
            <ActivityIndicator size="large" color="#1D4ED8" />
          </View>
        ) : entries.length === 0 ? (
          <View className="items-center justify-center py-16">
            <ScrollText size={30} color="#CBD5E1" />
            <Text className="mt-3 text-slate-500">No audit entries match.</Text>
          </View>
        ) : (
          entries.map((entry) => (
            <View
              key={entry.id}
              className="flex-row items-start border-b border-slate-50 px-5 py-3.5"
            >
              <Text className="w-40 pt-0.5 text-xs text-slate-500">
                {formatDate(entry.created_at, true)}
              </Text>
              <View className="w-40 pr-2">
                <Text className="text-xs font-semibold text-slate-700" numberOfLines={1}>
                  {entry.actor_username || "system"}
                </Text>
                <Text className="text-[11px] text-slate-400">{entry.actor_role || "—"}</Text>
              </View>
              <View className="w-44 pr-2">
                <View className="self-start rounded-full bg-slate-100 px-2.5 py-1">
                  <Text className="text-[11px] font-bold text-slate-600">
                    {entry.action}
                  </Text>
                </View>
              </View>
              <View className="flex-1 pr-3">
                <Text className="text-xs font-semibold text-slate-700" numberOfLines={2}>
                  {entry.target_label || entry.target_id || "—"}
                </Text>
                <Text className="text-[11px] text-slate-400">{entry.target_type}</Text>
              </View>
              <Text className="flex-1 text-xs leading-5 text-slate-500" numberOfLines={3}>
                {entry.reason || "—"}
              </Text>
            </View>
          ))
        )}
      </View>

      {cursor ? (
        <TouchableOpacity
          onPress={() => void load(cursor, true)}
          disabled={loadingMore}
          className="mt-4 flex-row items-center justify-center rounded-xl border border-slate-200 bg-white py-3 shadow-sm"
        >
          {loadingMore ? (
            <ActivityIndicator size="small" color="#1D4ED8" />
          ) : (
            <Text className="text-sm font-bold text-slate-700">Load more</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}
