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
import { useTheme } from "../../../src/contexts/ThemeContext";
import { ThemeTokens } from "../../../src/lib/tokens";

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

function getRoleBadgeStyle(role: string | null, colors: ThemeTokens) {
  switch (role) {
    case "faculty":
      return { bg: colors.infoSurface, text: colors.infoText };
    case "departmentAdmin":
      return { bg: colors.primarySurfaceAlt, text: colors.primary };
    case "admin":
      return { bg: colors.primarySurface, text: colors.primary };
    case "superadmin":
      return { bg: colors.goldSurface, text: colors.goldText };
    case "student":
    default:
      return { bg: colors.surfaceSunken, text: colors.textSecondary };
  }
}

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
        marginRight: 8,
        borderRadius: 9999,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primarySurface : colors.surface,
        paddingHorizontal: 14,
        paddingVertical: 6,
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

export default function AdminUsersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
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
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ marginBottom: 24, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <View>
          <Text style={{ fontSize: 26, fontWeight: "900", letterSpacing: -0.5, color: colors.textPrimary }}>
            Users
          </Text>
          <Text style={{ marginTop: 4, fontSize: 14, color: colors.textSecondary }}>
            Profiles, roles, and account sanctions.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => void fetchUsers(null, false)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}
        >
          <RefreshCw size={15} color={colors.textSecondary} />
          <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
            Refresh
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={{
          marginBottom: 20,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: 16,
        }}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <View
            style={{
              minWidth: 260,
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              backgroundColor: colors.inputBg,
              paddingHorizontal: 12,
            }}
          >
            <Search size={18} color={colors.textTertiary} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search name or username…"
              placeholderTextColor={colors.textMuted}
              style={{
                marginLeft: 8,
                flex: 1,
                paddingVertical: 10,
                fontSize: 14,
                color: colors.textPrimary,
              }}
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
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Filter size={15} color={colors.textSecondary} />
              <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: "700", color: colors.textSecondary }}>
                Clear filters
              </Text>
            </TouchableOpacity>
          ) : null}
          <Text style={{ fontSize: 13, color: colors.textTertiary }}>
            {loading ? "Loading…" : `${total} account${total === 1 ? "" : "s"}`}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
          {ROLE_OPTIONS.map((option) => (
            <Chip
              key={`role-${option.value}`}
              label={option.label}
              active={role === option.value}
              onPress={() => setRole(option.value)}
              colors={colors}
            />
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {STATUS_OPTIONS.map((option) => (
            <Chip
              key={`status-${option.value}`}
              label={option.label}
              active={status === option.value}
              onPress={() => setStatus(option.value)}
              colors={colors}
            />
          ))}
          <View style={{ marginHorizontal: 8, marginVertical: 4, width: 1, backgroundColor: colors.divider }} />
          <Chip
            label="All departments"
            active={!departmentId}
            onPress={() => setDepartmentId("")}
            colors={colors}
          />
          {departments.map((department) => (
            <Chip
              key={department.id}
              label={department.name}
              active={departmentId === department.id}
              onPress={() => setDepartmentId(department.id)}
              colors={colors}
            />
          ))}
        </ScrollView>
      </View>

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

      <View
        style={{
          overflow: "hidden",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: colors.divider,
            backgroundColor: colors.tableHeaderBg,
            paddingHorizontal: 20,
            paddingVertical: 12,
          }}
        >
          <Text style={{ flex: 2, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
            Account
          </Text>
          <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
            Role
          </Text>
          <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
            Department
          </Text>
          <Text style={{ width: 96, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
            Status
          </Text>
          <Text style={{ width: 112, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
            Joined
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 64 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : users.length === 0 ? (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 64 }}>
            <Users size={32} color={colors.textDisabled} />
            <Text style={{ marginTop: 12, fontSize: 15, fontWeight: "600", color: colors.textSecondary }}>
              No accounts match these filters.
            </Text>
          </View>
        ) : (
          users.map((user) => {
            const roleStyle = getRoleBadgeStyle(user.role, colors);
            const suspended = user.status === "suspended";
            return (
              <TouchableOpacity
                key={user.id}
                onPress={() => router.push(`/(admin)/users/${user.id}` as any)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: colors.tableRowBorder,
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                }}
              >
                <View style={{ flex: 2, flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      marginRight: 12,
                      height: 38,
                      width: 38,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 19,
                      backgroundColor: colors.surfaceSunken,
                    }}
                  >
                    {user.avatar_url ? (
                      <View style={{ height: 38, width: 38, overflow: "hidden", borderRadius: 19 }}>
                        <Text style={{ textAlign: "center", lineHeight: 38, fontSize: 14, fontWeight: "700", color: colors.textSecondary }}>
                          {(user.full_name || user.username || "?")[0]}
                        </Text>
                      </View>
                    ) : (
                      <UserRound size={18} color={colors.textTertiary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }} numberOfLines={1}>
                      {user.full_name || user.username || "Unnamed account"}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textTertiary }} numberOfLines={1}>
                      @{user.username || "unknown"}
                    </Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ alignSelf: "flex-start", borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: roleStyle.bg }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: roleStyle.text }}>
                      {roleLabel(user.role)}
                    </Text>
                  </View>
                </View>
                <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>
                  {user.department_name || "—"}
                </Text>
                <View style={{ width: 96 }}>
                  <View
                    style={{
                      alignSelf: "flex-start",
                      flexDirection: "row",
                      alignItems: "center",
                      borderRadius: 9999,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      backgroundColor: suspended ? colors.destructiveSurface : colors.successSurface,
                    }}
                  >
                    {suspended ? (
                      <ShieldAlert size={12} color={colors.destructiveText} />
                    ) : (
                      <View style={{ marginRight: 5, height: 6, width: 6, borderRadius: 3, backgroundColor: colors.success }} />
                    )}
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        marginLeft: suspended ? 4 : 0,
                        color: suspended ? colors.destructiveText : colors.successText,
                      }}
                    >
                      {suspended ? "Suspended" : "Active"}
                    </Text>
                  </View>
                </View>
                <Text style={{ width: 112, fontSize: 12, color: colors.textTertiary }}>
                  {formatDate(user.created_at)}
                </Text>
                <ChevronRight size={17} color={colors.textTertiary} />
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {cursor ? (
        <TouchableOpacity
          onPress={() => void fetchUsers(cursor, true)}
          disabled={loadingMore}
          style={{
            marginTop: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingVertical: 12,
          }}
        >
          {loadingMore ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textSecondary }}>Load more</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

