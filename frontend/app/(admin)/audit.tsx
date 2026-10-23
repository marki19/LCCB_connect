import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ScrollText, Search } from "lucide-react-native";
import { listAdminAudit, type AuditEntry } from "../../src/lib/adminApi";
import { useTheme } from "../../src/contexts/ThemeContext";
import { ThemeTokens } from "../../src/lib/tokens";
import PageHeader from "../../src/components/admin/PageHeader";

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

export default function AdminAuditScreen() {
  const { colors } = useTheme();
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
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        eyebrow="System / record"
        title="Audit log"
        description="The append-only record of governance actions. Superadmin only."
        onRefresh={() => void load(null, false)}
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
              placeholder="Search actor, target, or reason…"
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              value={from}
              onChangeText={setFrom}
              placeholder="From YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={{
                width: 144,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                backgroundColor: colors.inputBg,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 13,
                color: colors.textPrimary,
              }}
            />
            <TextInput
              value={to}
              onChangeText={setTo}
              placeholder="To YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={{
                width: 144,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                backgroundColor: colors.inputBg,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 13,
                color: colors.textPrimary,
              }}
            />
          </View>
          <Text style={{ fontSize: 13, color: colors.textTertiary }}>
            {loading ? "Loading…" : `${total} entr${total === 1 ? "y" : "ies"}`}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
          {ACTION_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              active={action === option.value}
              onPress={() => setAction(option.value)}
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
          <Text style={{ width: 160, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
            When
          </Text>
          <Text style={{ width: 160, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
            Actor
          </Text>
          <Text style={{ width: 176, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
            Action
          </Text>
          <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
            Target
          </Text>
          <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
            Reason
          </Text>
        </View>

        {loading ? (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 64 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : entries.length === 0 ? (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 64 }}>
            <ScrollText size={30} color={colors.textDisabled} />
            <Text style={{ marginTop: 12, fontSize: 15, fontWeight: "600", color: colors.textSecondary }}>No audit entries match.</Text>
          </View>
        ) : (
          entries.map((entry) => (
            <View
              key={entry.id}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                borderBottomWidth: 1,
                borderBottomColor: colors.tableRowBorder,
                paddingHorizontal: 20,
                paddingVertical: 14,
              }}
            >
              <Text style={{ width: 160, paddingTop: 2, fontSize: 12, color: colors.textTertiary }}>
                {formatDate(entry.created_at, true)}
              </Text>
              <View style={{ width: 160, paddingRight: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }} numberOfLines={1}>
                  {entry.actor_username || "system"}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>{entry.actor_role || "—"}</Text>
              </View>
              <View style={{ width: 176, paddingRight: 8 }}>
                <View style={{ alignSelf: "flex-start", borderRadius: 9999, backgroundColor: colors.surfaceSunken, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary }}>
                    {entry.action}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }} numberOfLines={2}>
                  {entry.target_label || entry.target_id || "—"}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>{entry.target_type}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: colors.textSecondary }} numberOfLines={3}>
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

