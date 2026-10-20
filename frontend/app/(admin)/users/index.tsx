import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ChevronRight,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
  Users,
} from "lucide-react-native";
import { listAdminUsers, type AdminUser } from "../../../src/lib/adminApi";
import { fetchDepartments } from "../../../src/lib/catalog";
import type { Department } from "../../../src/types";

const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "student", label: "Student" },
  { value: "faculty", label: "Faculty" },
  { value: "departmentAdmin", label: "Dept. admin" },
  { value: "admin", label: "Admin" },
  { value: "superadmin", label: "Superadmin" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

const ROLE_STYLE: Record<string, { bg: string; text: string }> = {
  student: { bg: "bg-slate-100", text: "text-slate-600" },
  faculty: { bg: "bg-teal-50", text: "text-teal-700" },
  departmentAdmin: { bg: "bg-indigo-50", text: "text-indigo-700" },
  admin: { bg: "bg-blue-50", text: "text-blue-700" },
  superadmin: { bg: "bg-violet-50", text: "text-violet-700" },
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function roleLabel(role: string | null) {
  const found = ROLE_OPTIONS.find((option) => option.value === role);
  return found?.label || role || "Unknown";
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
        active
          ? "border-[#1D4ED8] bg-blue-50"
          : "border-slate-200 bg-white"
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

export default function AdminUsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    void fetchDepartments()
      .then((rows) => {
        if (!cancelled) setDepartments(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchUsers = useCallback(
    async (nextCursor: string | null, append: boolean) => {
      const requestId = ++requestRef.current;
      await Promise.resolve();
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setUsers([]);
      }
      setError("");
      try {
        const page = await listAdminUsers({
          q: debouncedQ || undefined,
          role: role || undefined,
          status: status || undefined,
          department_id: departmentId || undefined,
          limit: 25,
          cursor: nextCursor,
        });
        if (requestId !== requestRef.current) return;
        setUsers((current) => (append ? [...current, ...page.items] : page.items));
        setTotal(page.total);
        setCursor(page.next_cursor);
      } catch (e: any) {
        if (requestId !== requestRef.current) return;
        setError(e?.message || "Could not load users.");
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [debouncedQ, role, status, departmentId]
  );

  useEffect(() => {
    const timer = setTimeout(() => void fetchUsers(null, false), 0);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const hasFilters = !!(q || role || status || departmentId);

  return (
    <ScrollView
      className="flex-1 bg-[#F8FAFC] p-8"
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-6 flex-row flex-wrap items-start justify-between gap-4">
        <View>
          <Text className="text-3xl font-black tracking-tight text-slate-900">
            Users
          </Text>
          <Text className="mt-1 text-base text-slate-500">
            Profiles, roles, and account sanctions.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => void fetchUsers(null, false)}
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
              placeholder="Search name or username…"
              placeholderTextColor="#94A3B8"
              className="ml-2 flex-1 py-2.5 text-slate-900"
              autoCapitalize="none"
            />
          </View>
          {hasFilters ? (
            <TouchableOpacity
              onPress={() => {
                setQ("");
                setRole("");
                setStatus("");
                setDepartmentId("");
              }}
              className="flex-row items-center rounded-xl border border-slate-200 px-3 py-2.5"
            >
              <Filter size={15} color="#64748B" />
              <Text className="ml-1.5 text-xs font-bold text-slate-500">
                Clear filters
              </Text>
            </TouchableOpacity>
          ) : null}
          <Text className="text-sm text-slate-400">
            {loading ? "Loading…" : `${total} account${total === 1 ? "" : "s"}`}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
          {ROLE_OPTIONS.map((option) => (
            <Chip
              key={`role-${option.value}`}
              label={option.label}
              active={role === option.value}
              onPress={() => setRole(option.value)}
            />
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
          {STATUS_OPTIONS.map((option) => (
            <Chip
              key={`status-${option.value}`}
              label={option.label}
              active={status === option.value}
              onPress={() => setStatus(option.value)}
            />
          ))}
          <View className="mx-2 my-1 w-px bg-slate-200" />
          <Chip
            label="All departments"
            active={!departmentId}
            onPress={() => setDepartmentId("")}
          />
          {departments.map((department) => (
            <Chip
              key={department.id}
              label={department.name}
              active={departmentId === department.id}
              onPress={() => setDepartmentId(department.id)}
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
          <Text className="flex-[2] text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Account
          </Text>
          <Text className="flex-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Role
          </Text>
          <Text className="flex-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Department
          </Text>
          <Text className="w-24 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Status
          </Text>
          <Text className="w-28 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Joined
          </Text>
          <View className="w-6" />
        </View>

        {loading ? (
          <View className="items-center justify-center py-16">
            <ActivityIndicator size="large" color="#1D4ED8" />
          </View>
        ) : users.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Users size={32} color="#CBD5E1" />
            <Text className="mt-3 text-base font-semibold text-slate-500">
              No accounts match these filters.
            </Text>
          </View>
        ) : (
          users.map((user) => {
            const style = ROLE_STYLE[user.role || ""] || ROLE_STYLE.student;
            const suspended = user.status === "suspended";
            return (
              <TouchableOpacity
                key={user.id}
                onPress={() => router.push(`/(admin)/users/${user.id}` as any)}
                className="flex-row items-center border-b border-slate-50 px-5 py-3.5 hover:bg-slate-50"
              >
                <View className="flex-[2] flex-row items-center">
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                    {user.avatar_url ? (
                      <View className="h-10 w-10 overflow-hidden rounded-full">
                        <Text className="text-center leading-10 text-sm font-bold text-slate-500">
                          {(user.full_name || user.username || "?")[0]}
                        </Text>
                      </View>
                    ) : (
                      <UserRound size={18} color="#64748B" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-800" numberOfLines={1}>
                      {user.full_name || user.username || "Unnamed account"}
                    </Text>
                    <Text className="text-xs text-slate-400" numberOfLines={1}>
                      @{user.username || "unknown"}
                    </Text>
                  </View>
                </View>
                <View className="flex-1">
                  <View className={`self-start rounded-full px-2.5 py-1 ${style.bg}`}>
                    <Text className={`text-[11px] font-bold ${style.text}`}>
                      {roleLabel(user.role)}
                    </Text>
                  </View>
                </View>
                <Text className="flex-1 text-sm text-slate-600" numberOfLines={1}>
                  {user.department_name || "—"}
                </Text>
                <View className="w-24">
                  <View
                    className={`self-start flex-row items-center rounded-full px-2.5 py-1 ${
                      suspended ? "bg-red-50" : "bg-emerald-50"
                    }`}
                  >
                    {suspended ? (
                      <ShieldAlert size={11} color="#DC2626" />
                    ) : (
                      <View className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    )}
                    <Text
                      className={`text-[11px] font-bold ${
                        suspended ? "ml-1 text-red-600" : "text-emerald-700"
                      }`}
                    >
                      {suspended ? "Suspended" : "Active"}
                    </Text>
                  </View>
                </View>
                <Text className="w-28 text-xs text-slate-500">
                  {formatDate(user.created_at)}
                </Text>
                <ChevronRight size={17} color="#94A3B8" />
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {cursor ? (
        <TouchableOpacity
          onPress={() => void fetchUsers(cursor, true)}
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
