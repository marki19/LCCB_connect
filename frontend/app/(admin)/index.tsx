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
};

function StatCard({ title, value, detail, icon: Icon, color }: StatCardProps) {
  return (
    <View className="min-w-[210px] flex-1 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <View className="mb-4 flex-row items-start justify-between">
        <View
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon color={color} size={22} />
        </View>
      </View>
      <Text className="text-3xl font-black tracking-tight text-slate-800">
        {value}
      </Text>
      <Text className="mt-1 text-sm font-semibold text-slate-500">{title}</Text>
      {detail ? <Text className="mt-2 text-xs text-slate-400">{detail}</Text> : null}
    </View>
  );
}

export default function AdminOverviewScreen() {
  const router = useRouter();
  const { profile } = useAuth();
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
      className="flex-1 bg-[#F8FAFC] p-8"
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-7 flex-row flex-wrap items-start justify-between gap-4">
        <View>
          <Text className="text-3xl font-black tracking-tight text-slate-900">
            Overview
          </Text>
          <Text className="mt-1 text-base text-slate-500">
            Campus health and moderation at a glance.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => void load()}
          className="flex-row items-center rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm"
        >
          <RefreshCw size={16} color="#475569" />
          <Text className="ml-2 text-sm font-semibold text-slate-700">Refresh</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4">
          <Text className="font-semibold text-red-600">{error}</Text>
        </View>
      ) : null}

      {loading && !data ? (
        <View className="min-h-[300px] items-center justify-center">
          <ActivityIndicator size="large" color="#1D4ED8" />
        </View>
      ) : data ? (
        <>
          <View className="mb-5 flex-row flex-wrap gap-4">
            <StatCard
              title="Total users"
              value={data.users.total}
              detail={`${data.users.students} students · ${data.users.faculty} faculty`}
              icon={Users}
              color="#1D4ED8"
            />
            <StatCard
              title="Content items"
              value={data.content.posts + data.content.theses}
              detail={`${data.content.posts} posts · ${data.content.theses} theses`}
              icon={FileText}
              color="#0F766E"
            />
            <StatCard
              title="Open reports"
              value={openReports}
              detail={`${data.reports.message_reports} messages · ${flaggedTotal} flagged`}
              icon={Flag}
              color="#DC2626"
            />
            <StatCard
              title="Active last 7 days"
              value={data.users.active_7d}
              detail={`${data.users.new_7d} joined this week`}
              icon={Activity}
              color="#D97706"
            />
          </View>

          <View className="mb-6 flex-row flex-wrap gap-3">
            <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-4 py-3">
              <EyeOff size={16} color="#64748B" />
              <Text className="ml-2 text-sm text-slate-500">
                Hidden{" "}
                <Text className="font-bold text-slate-800">{data.content.hidden}</Text>
              </Text>
            </View>
            <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-4 py-3">
              <AlertTriangle size={16} color="#D97706" />
              <Text className="ml-2 text-sm text-slate-500">
                Flagged{" "}
                <Text className="font-bold text-slate-800">{data.content.flagged}</Text>
              </Text>
            </View>
            <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-4 py-3">
              <ShieldAlert size={16} color="#DC2626" />
              <Text className="ml-2 text-sm text-slate-500">
                Suspended{" "}
                <Text className="font-bold text-slate-800">{data.users.suspended}</Text>
              </Text>
            </View>
            <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-4 py-3">
              <Megaphone size={16} color="#4F46E5" />
              <Text className="ml-2 text-sm text-slate-500">
                Announcements{" "}
                <Text className="font-bold text-slate-800">
                  {data.announcements.sent_30d}
                </Text>
              </Text>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-6">
            <View className="min-w-[420px] flex-1 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-lg font-bold text-slate-800">
                  Needs attention
                </Text>
                <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Oldest first
                </Text>
              </View>
              {data.needs_attention.length === 0 ? (
                <View className="items-center justify-center py-10">
                  <ShieldAlert size={28} color="#CBD5E1" />
                  <Text className="mt-2 text-sm text-slate-400">
                    Nothing in the queue.
                  </Text>
                </View>
              ) : (
                data.needs_attention.map((item) => (
                  <TouchableOpacity
                    key={`${item.kind}-${item.id}`}
                    onPress={() => router.push("/(admin)/content" as any)}
                    className="mb-2 flex-row items-center rounded-xl border border-slate-100 p-3 hover:bg-slate-50"
                  >
                    <View className="mr-3 h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                      <AlertTriangle size={17} color="#D97706" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-slate-800" numberOfLines={1}>
                        {item.label || "Untitled"}
                      </Text>
                      <Text className="mt-0.5 text-xs text-slate-500">
                        {ATTENTION_LABELS[item.kind] || item.kind}
                        {item.author ? ` · ${item.author}` : ""} · {timeAgo(item.created_at)}
                      </Text>
                    </View>
                    <ArrowRight size={16} color="#94A3B8" />
                  </TouchableOpacity>
                ))
              )}
            </View>

            {isSuperAdminRole(profile?.role) ? (
              <View className="min-w-[340px] flex-1 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <View className="mb-4 flex-row items-center justify-between">
                  <Text className="text-lg font-bold text-slate-800">
                    Recent actions
                  </Text>
                  <TouchableOpacity onPress={() => router.push("/(admin)/audit" as any)}>
                    <Text className="text-xs font-bold text-[#1D4ED8]">View audit</Text>
                  </TouchableOpacity>
                </View>
                {(data.recent_actions || []).length === 0 ? (
                  <Text className="py-8 text-center text-sm text-slate-400">
                    No governance actions yet.
                  </Text>
                ) : (
                  (data.recent_actions || []).map((entry) => (
                    <View
                      key={entry.id}
                      className="mb-3 border-b border-slate-100 pb-3 last:border-0"
                    >
                      <Text className="text-sm font-semibold text-slate-800">
                        {ACTION_LABELS[entry.action] || entry.action}
                      </Text>
                      <Text className="mt-0.5 text-xs text-slate-500">
                        {entry.actor_username || "system"} ·{" "}
                        {entry.target_label || entry.target_type} ·{" "}
                        {timeAgo(entry.created_at)}
                      </Text>
                      {entry.reason ? (
                        <Text className="mt-1 text-xs italic text-slate-400">
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
