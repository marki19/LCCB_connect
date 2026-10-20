import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  EyeOff,
  FileText,
  Flag,
  Megaphone,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react-native";
import { getAdminOverview, type AdminOverview } from "../../src/lib/adminApi";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { ThemeTokens } from "../../src/lib/tokens";
import { isSuperAdminRole } from "../../src/lib/roles";

const ACTION_LABELS: Record<string, string> = {
  "user.role_change": "Role changed",
  "user.suspend": "User suspended",
  "user.unsuspend": "User restored",
  "user.force_signout": "Sessions revoked",
  "user.delete": "User deleted",
  "content.hide": "Content hidden",
  "content.restore": "Content restored",
  "content.delete": "Content deleted",
  "report.review": "Report reviewed",
  "report.dismiss": "Report dismissed",
  "announcement.send": "Announcement sent",
  "catalog.create": "Catalog item created",
  "catalog.update": "Catalog item updated",
  "catalog.activate": "Catalog item activated",
  "catalog.deactivate": "Catalog item deactivated",
};

const ATTENTION_LABELS: Record<string, string> = {
  flagged_post: "Flagged post",
  flagged_comment: "Flagged comment",
  flagged_thesis: "Flagged thesis",
  message_report: "Reported message",
};

function timeAgo(value: string) {
  const date = new Date(value).getTime();
  if (!Number.isFinite(date)) return value;
  const seconds = Math.max(0, Math.floor((Date.now() - date) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

type StatCardProps = {
  title: string;
  value: number | string;
  detail?: string;
  icon: any;
  color: string;
  colors: ThemeTokens;
};

function StatCard({ title, value, detail, icon: Icon, color, colors }: StatCardProps) {
  return (
    <View
      style={{
        minWidth: 210,
        flex: 1,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: 20,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View style={{ marginBottom: 14, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View
          style={{
            height: 44,
            width: 44,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            backgroundColor: `${color}18`,
          }}
        >
          <Icon color={color} size={22} />
        </View>
      </View>
      <Text style={{ fontSize: 28, fontWeight: "900", letterSpacing: -0.5, color: colors.textPrimary }}>
        {value}
      </Text>
      <Text style={{ marginTop: 4, fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
        {title}
      </Text>
      {detail ? (
        <Text style={{ marginTop: 6, fontSize: 12, color: colors.textTertiary }}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

export default function AdminOverviewScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getAdminOverview());
    } catch (e: any) {
      setError(e?.message || "Could not load the overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const flaggedTotal = data
    ? data.reports.flagged_posts +
      data.reports.flagged_comments +
      data.reports.flagged_theses
    : 0;
  const openReports = data ? flaggedTotal + data.reports.message_reports : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ marginBottom: 28, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <View>
          <Text style={{ fontSize: 26, fontWeight: "900", letterSpacing: -0.5, color: colors.textPrimary }}>
            Overview
          </Text>
          <Text style={{ marginTop: 4, fontSize: 14, color: colors.textSecondary }}>
            Campus health and moderation at a glance.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => void load()}
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

      {error ? (
        <View
          style={{
            marginBottom: 20,
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

      {loading && !data ? (
        <View style={{ minHeight: 300, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : data ? (
        <>
          <View style={{ marginBottom: 20, flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            <StatCard
              title="Total users"
              value={data.users.total}
              detail={`${data.users.students} students · ${data.users.faculty} faculty`}
              icon={Users}
              color={colors.primary}
              colors={colors}
            />
            <StatCard
              title="Content items"
              value={data.content.posts + data.content.theses}
              detail={`${data.content.posts} posts · ${data.content.theses} theses`}
              icon={FileText}
              color={colors.info}
              colors={colors}
            />
            <StatCard
              title="Open reports"
              value={openReports}
              detail={`${data.reports.message_reports} messages · ${flaggedTotal} flagged`}
              icon={Flag}
              color={colors.destructive}
              colors={colors}
            />
            <StatCard
              title="Active last 7 days"
              value={data.users.active_7d}
              detail={`${data.users.new_7d} joined this week`}
              icon={Activity}
              color={colors.warning}
              colors={colors}
            />
          </View>

          <View style={{ marginBottom: 24, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <EyeOff size={16} color={colors.textTertiary} />
              <Text style={{ marginLeft: 8, fontSize: 13, color: colors.textSecondary }}>
                Hidden{" "}
                <Text style={{ fontWeight: "800", color: colors.textPrimary }}>{data.content.hidden}</Text>
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <AlertTriangle size={16} color={colors.warning} />
              <Text style={{ marginLeft: 8, fontSize: 13, color: colors.textSecondary }}>
                Flagged{" "}
                <Text style={{ fontWeight: "800", color: colors.textPrimary }}>{data.content.flagged}</Text>
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <ShieldAlert size={16} color={colors.destructive} />
              <Text style={{ marginLeft: 8, fontSize: 13, color: colors.textSecondary }}>
                Suspended{" "}
                <Text style={{ fontWeight: "800", color: colors.textPrimary }}>{data.users.suspended}</Text>
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Megaphone size={16} color={colors.primary} />
              <Text style={{ marginLeft: 8, fontSize: 13, color: colors.textSecondary }}>
                Announcements{" "}
                <Text style={{ fontWeight: "800", color: colors.textPrimary }}>
                  {data.announcements.sent_30d}
                </Text>
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 24 }}>
            <View
              style={{
                minWidth: 400,
                flex: 1,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                padding: 24,
              }}
            >
              <View style={{ marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary }}>
                  Needs attention
                </Text>
                <Text style={{ fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
                  Oldest first
                </Text>
              </View>
              {data.needs_attention.length === 0 ? (
                <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
                  <ShieldAlert size={32} color={colors.textDisabled} />
                  <Text style={{ marginTop: 8, fontSize: 13, color: colors.textTertiary }}>
                    Nothing in the queue.
                  </Text>
                </View>
              ) : (
                data.needs_attention.map((item) => (
                  <TouchableOpacity
                    key={`${item.kind}-${item.id}`}
                    onPress={() => router.push("/(admin)/content" as any)}
                    style={{
                      marginBottom: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 12,
                      backgroundColor: colors.surfaceSunken,
                    }}
                  >
                    <View
                      style={{
                        marginRight: 12,
                        height: 36,
                        width: 36,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 10,
                        backgroundColor: colors.warningSurface,
                      }}
                    >
                      <AlertTriangle size={17} color={colors.warning} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}
                        numberOfLines={1}
                      >
                        {item.label || "Untitled"}
                      </Text>
                      <Text style={{ marginTop: 2, fontSize: 12, color: colors.textTertiary }}>
                        {ATTENTION_LABELS[item.kind] || item.kind}
                        {item.author ? ` · ${item.author}` : ""} · {timeAgo(item.created_at)}
                      </Text>
                    </View>
                    <ArrowRight size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                ))
              )}
            </View>

            {isSuperAdminRole(profile?.role) ? (
              <View
                style={{
                  minWidth: 340,
                  flex: 1,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  padding: 24,
                }}
              >
                <View style={{ marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary }}>
                    Recent actions
                  </Text>
                  <TouchableOpacity onPress={() => router.push("/(admin)/audit" as any)}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
                      View audit
                    </Text>
                  </TouchableOpacity>
                </View>
                {(data.recent_actions || []).length === 0 ? (
                  <Text style={{ paddingVertical: 32, textAlign: "center", fontSize: 13, color: colors.textTertiary }}>
                    No governance actions yet.
                  </Text>
                ) : (
                  (data.recent_actions || []).map((entry) => (
                    <View
                      key={entry.id}
                      style={{
                        marginBottom: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.divider,
                        paddingBottom: 12,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>
                        {ACTION_LABELS[entry.action] || entry.action}
                      </Text>
                      <Text style={{ marginTop: 2, fontSize: 12, color: colors.textTertiary }}>
                        {entry.actor_username || "system"} ·{" "}
                        {entry.target_label || entry.target_type} ·{" "}
                        {timeAgo(entry.created_at)}
                      </Text>
                      {entry.reason ? (
                        <Text style={{ marginTop: 4, fontSize: 12, fontStyle: "italic", color: colors.textMuted }}>
                          {entry.reason}
                        </Text>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

