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
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react-native";
import { listAdminUsers, type AdminUser } from "../../../src/lib/adminApi";
import { fetchDepartments } from "../../../src/lib/catalog";
import type { Department } from "../../../src/types";
import { useTheme } from "../../../src/contexts/ThemeContext";
import { ThemeTokens } from "../../../src/lib/tokens";
import PageHeader from "../../../src/components/admin/PageHeader";
import DataTable from "../../../src/components/admin/DataTable";
import StatusBadge from "../../../src/components/admin/StatusBadge";
import EmptyState from "../../../src/components/admin/EmptyState";

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
      <PageHeader
        eyebrow="Governance / people"
        title="Users"
        description="Profiles, roles, and account sanctions — every change is reason-gated and audited."
        onRefresh={() => void fetchUsers(null, false)}
        refreshing={loading}
      />

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

      <DataTable<AdminUser>
        columns={[
          { key: "account", label: "Account", flex: 2.2 },
          { key: "role", label: "Role", flex: 1 },
          { key: "department", label: "Department", flex: 1.2 },
          { key: "status", label: "Status", width: 104 },
          { key: "joined", label: "Joined", width: 108 },
          { key: "open", label: "", width: 28 },
        ]}
        rows={users}
        keyExtractor={(user) => user.id}
        loading={loading}
        minWidth={820}
        onRowPress={(user) => router.push(`/(admin)/users/${user.id}` as any)}
        rowLabel={(user) =>
          `${user.full_name || user.username || "Unnamed account"}, ${roleLabel(
            user.role
          )}, ${user.status === "suspended" ? "suspended" : "active"}`
        }
        empty={
          <EmptyState
            compact
            icon={Users}
            tone={hasFilters ? "warning" : "brand"}
            title={hasFilters ? "No accounts match" : "No accounts yet"}
            body={
              hasFilters
                ? "Try a different role, status, or department — or clear the filters."
                : "New profiles will appear here as people join the campus."
            }
            actionLabel={hasFilters ? "Clear filters" : undefined}
            onAction={
              hasFilters
                ? () => {
                    setQ("");
                    setRole("");
                    setStatus("");
                    setDepartmentId("");
                  }
                : undefined
            }
          />
        }
        renderCell={(user, column, tableColors) => {
          const roleStyle = getRoleBadgeStyle(user.role, tableColors);
          const suspended = user.status === "suspended";
          switch (column.key) {
            case "account":
              return (
                <View style={{ flexDirection: "row", alignItems: "center", minWidth: 0 }}>
                  <View
                    style={{
                      marginRight: 12,
                      height: 38,
                      width: 38,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 19,
                      backgroundColor: tableColors.surfaceSunken,
                    }}
                  >
                    {user.avatar_url ? (
                      <View style={{ height: 38, width: 38, overflow: "hidden", borderRadius: 19 }}>
                        <Text
                          style={{
                            textAlign: "center",
                            lineHeight: 38,
                            fontSize: 14,
                            fontWeight: "700",
                            color: tableColors.textSecondary,
                          }}
                        >
                          {(user.full_name || user.username || "?")[0]}
                        </Text>
                      </View>
                    ) : (
                      <UserRound size={18} color={tableColors.textTertiary} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{ fontSize: 13, fontWeight: "700", color: tableColors.textPrimary }}
                      numberOfLines={1}
                    >
                      {user.full_name || user.username || "Unnamed account"}
                    </Text>
                    <Text
                      style={{ fontSize: 12, color: tableColors.textTertiary }}
                      numberOfLines={1}
                    >
                      @{user.username || "unknown"}
                    </Text>
                  </View>
                </View>
              );
            case "role":
              return (
                <View
                  style={{
                    alignSelf: "flex-start",
                    borderRadius: 9999,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    backgroundColor: roleStyle.bg,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: roleStyle.text }}>
                    {roleLabel(user.role)}
                  </Text>
                </View>
              );
            case "department":
              return (
                <Text
                  style={{ fontSize: 13, color: tableColors.textSecondary }}
                  numberOfLines={1}
                >
                  {user.department_name || "—"}
                </Text>
              );
            case "status":
              return (
                <StatusBadge
                  label={suspended ? "Suspended" : "Active"}
                  tone={suspended ? "danger" : "success"}
                  icon={suspended ? ShieldAlert : ShieldCheck}
                />
              );
            case "joined":
              return (
                <Text style={{ fontSize: 12, color: tableColors.textTertiary }}>
                  {formatDate(user.created_at)}
                </Text>
              );
            case "open":
              return <ChevronRight size={17} color={tableColors.textTertiary} />;
            default:
              return null;
          }
        }}
      />

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

