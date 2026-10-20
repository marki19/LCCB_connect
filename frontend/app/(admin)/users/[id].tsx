import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FileText,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  UserRound,
} from "lucide-react-native";
import {
  changeUserRole,
  deleteAdminUser,
  forceSignOut,
  getAdminUser,
  suspendUser,
  unsuspendUser,
  type AdminDossier,
} from "../../../src/lib/adminApi";
import {
  canManageRole,
  grantableRoles,
  isSuperAdminRole,
} from "../../../src/lib/roles";
import { useAuth } from "../../../src/contexts/AuthContext";
import ActionDialog from "../../../src/components/admin/ActionDialog";

type DialogKind = "role" | "suspend" | "unsuspend" | "force" | "delete" | null;

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

function toIsoUntil(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Use YYYY-MM-DD for the suspension end date.");
  }
  const date = new Date(`${value}T23:59:59`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("That suspension end date is not valid.");
  }
  return date.toISOString();
}

function Detail({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: any;
}) {
  return (
    <View className="mb-4 flex-row items-start">
      {Icon ? (
        <View className="mr-3 mt-0.5 h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
          <Icon size={15} color="#64748B" />
        </View>
      ) : null}
      <View className="flex-1">
        <Text className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {label}
        </Text>
        <Text className="mt-0.5 text-sm font-semibold text-slate-700">
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function AdminUserDossierScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { profile } = useAuth();
  const [target, setTarget] = useState<AdminDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [selectedRole, setSelectedRole] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    await Promise.resolve();
    setLoading(true);
    setError("");
    try {
      const data = await getAdminUser(id);
      setTarget(data);
      setSelectedRole(data.role || "");
    } catch (e: any) {
      setError(e?.message || "Could not load this account.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const roles = useMemo(() => grantableRoles(profile?.role), [profile?.role]);
  const canManageTarget =
    !!target &&
    !!profile &&
    String(profile.id) !== String(target.id) &&
    canManageRole(profile.role, target.role);
  const superadmin = isSuperAdminRole(profile?.role);
  const suspended = target?.status === "suspended";

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setDialog(null);
      setNotice(message);
      await load();
    } catch (e: any) {
      setError(e?.message || "The action failed.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDialog = (input: { reason: string; until: string }) => {
    if (!target) return;
    if (dialog === "role") {
      void run(
        () =>
          changeUserRole(
            target.id,
            (selectedRole || target.role) as any,
            input.reason
          ),
        "Role updated."
      );
    } else if (dialog === "suspend") {
      let until: string | null;
      try {
        until = toIsoUntil(input.until);
      } catch (e: any) {
        setError(e.message);
        setDialog(null);
        return;
      }
      void run(
        () => suspendUser(target.id, input.reason, until),
        "Account suspended and sessions revoked."
      );
    } else if (dialog === "unsuspend") {
      void run(
        () => unsuspendUser(target.id, input.reason),
        "Account restored."
      );
    } else if (dialog === "force") {
      void run(
        () => forceSignOut(target.id, input.reason),
        "Sessions revoked. An already-issued access token may remain valid until it expires."
      );
    } else if (dialog === "delete") {
      void run(
        () => deleteAdminUser(target.id, input.reason),
        "Account and profile deleted."
      );
    }
  };

  const dialogProps = (() => {
    if (dialog === "role") {
      return {
        title: "Change role",
        description: `Change this account from ${target?.role || "unknown"} to ${
          selectedRole || target?.role || "unknown"
        }.`,
        confirmLabel: "Save role",
        destructive: false,
        showUntil: false,
        confirmationPhrase: undefined,
      };
    }
    if (dialog === "suspend") {
      return {
        title: "Suspend account",
        description:
          "The user is signed out, banned in Supabase Auth, and blocked from every API route until restored.",
        confirmLabel: "Suspend",
        destructive: true,
        showUntil: true,
        confirmationPhrase: undefined,
      };
    }
    if (dialog === "unsuspend") {
      return {
        title: "Restore account",
        description: "The suspension is lifted and the account can sign in again.",
        confirmLabel: "Restore",
        destructive: false,
        showUntil: false,
        confirmationPhrase: undefined,
      };
    }
    if (dialog === "force") {
      return {
        title: "Force sign-out",
        description:
          "Revokes this account's refresh sessions. An access token already issued may stay valid until it expires.",
        confirmLabel: "Revoke sessions",
        destructive: true,
        showUntil: false,
        confirmationPhrase: undefined,
      };
    }
    return {
      title: "Delete account",
      description:
        "Deletes the Supabase Auth user and profile. The profile cascade removes posts, theses, comments, likes, messages, and memberships. This cannot be undone.",
      confirmLabel: "Delete account",
      destructive: true,
      showUntil: false,
      confirmationPhrase: target?.username || "delete",
    };
  })();

  return (
    <ScrollView
      className="flex-1 bg-[#F8FAFC] p-8"
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-6 flex-row flex-wrap items-center justify-between gap-3">
        <TouchableOpacity
          onPress={() => router.push("/(admin)/users" as any)}
          className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
        >
          <ArrowLeft size={16} color="#475569" />
          <Text className="ml-2 text-sm font-semibold text-slate-700">Users</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => void load()}
          className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
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

      {loading && !target ? (
        <View className="min-h-[320px] items-center justify-center">
          <ActivityIndicator size="large" color="#1D4ED8" />
        </View>
      ) : !target ? (
        <View className="items-center justify-center rounded-2xl border border-slate-100 bg-white py-20">
          <UserRound size={32} color="#CBD5E1" />
          <Text className="mt-3 text-slate-500">Account not found.</Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-6">
          <View className="min-w-[300px] flex-[0.9] rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <View className="items-center">
              <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-blue-100">
                {target.avatar_url ? (
                  <Image
                    source={{ uri: target.avatar_url }}
                    style={{ width: 96, height: 96 }}
                  />
                ) : (
                  <Text className="text-3xl font-black text-blue-700">
                    {(target.full_name || target.username || "?")[0]}
                  </Text>
                )}
              </View>
              <Text className="mt-4 text-center text-xl font-black text-slate-900">
                {target.full_name || target.username || "Unnamed account"}
              </Text>
              <Text className="mt-0.5 text-sm text-slate-400">
                @{target.username || "unknown"}
              </Text>
              <View
                className={`mt-3 flex-row items-center rounded-full px-3 py-1 ${
                  suspended ? "bg-red-50" : "bg-emerald-50"
                }`}
              >
                {suspended ? (
                  <ShieldAlert size={13} color="#DC2626" />
                ) : (
                  <ShieldCheck size={13} color="#059669" />
                )}
                <Text
                  className={`ml-1.5 text-xs font-bold ${
                    suspended ? "text-red-600" : "text-emerald-700"
                  }`}
                >
                  {suspended ? "Suspended" : "Active"}
                </Text>
              </View>
            </View>

            <View className="mt-7 border-t border-slate-100 pt-5">
              <Detail label="Email" value={target.email || "—"} icon={Mail} />
              <Detail label="Role" value={target.role || "—"} icon={ShieldCheck} />
              <Detail
                label="Department"
                value={target.department_name || "—"}
                icon={BookOpen}
              />
              <Detail
                label="Course / year"
                value={
                  [target.course_name || target.course, target.year_level]
                    .filter(Boolean)
                    .join(" · ") || "—"
                }
                icon={FileText}
              />
              <Detail
                label="Joined"
                value={formatDate(target.created_at)}
                icon={CalendarDays}
              />
              <Detail
                label="Last seen"
                value={formatDate(target.last_seen_at, true)}
                icon={CalendarDays}
              />
            </View>

            {suspended ? (
              <View className="mt-2 rounded-xl border border-red-100 bg-red-50 p-4">
                <Text className="text-[11px] font-bold uppercase tracking-wide text-red-500">
                  Current suspension
                </Text>
                <Text className="mt-1 text-sm leading-5 text-red-800">
                  {target.suspension_reason || "No reason recorded."}
                </Text>
                <Text className="mt-2 text-xs text-red-600">
                  {target.suspended_until
                    ? `Until ${formatDate(target.suspended_until, true)}`
                    : "Indefinite"}
                </Text>
              </View>
            ) : null}
          </View>

          <View className="min-w-[460px] flex-[1.6]">
            <View className="mb-5 flex-row flex-wrap gap-3">
              {[
                { label: "Posts", value: target.counts.posts, icon: FileText },
                { label: "Theses", value: target.counts.theses, icon: BookOpen },
                { label: "Comments", value: target.counts.comments, icon: MessageSquare },
                { label: "Likes given", value: target.counts.likes_given, icon: CheckCircle2 },
                {
                  label: "Reports against",
                  value: target.counts.message_reports_against,
                  icon: ShieldAlert,
                },
              ].map(({ label, value, icon: Icon }) => (
                <View
                  key={label}
                  className="min-w-[110px] flex-1 rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                >
                  <Icon size={16} color="#64748B" />
                  <Text className="mt-2 text-2xl font-black text-slate-800">{value}</Text>
                  <Text className="text-xs font-semibold text-slate-500">{label}</Text>
                </View>
              ))}
            </View>

            <View className="mb-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <Text className="text-lg font-bold text-slate-800">Governance</Text>
              <Text className="mt-1 text-sm text-slate-500">
                Every action requires a reason and is written to the audit log.
              </Text>

              <View className="mt-5">
                <Text className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Role
                </Text>
                <View className="flex-row flex-wrap">
                  {(canManageTarget ? roles : []).map((option) => {
                    const active = selectedRole === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        onPress={() => setSelectedRole(option)}
                        className={`mb-2 mr-2 rounded-full border px-3.5 py-2 ${
                          active
                            ? "border-[#1D4ED8] bg-blue-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            active ? "text-[#1D4ED8]" : "text-slate-600"
                          }`}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {!canManageTarget ? (
                    <Text className="text-sm text-slate-400">
                      This account is outside your management scope.
                    </Text>
                  ) : null}
                </View>

                {canManageTarget ? (
                  <TouchableOpacity
                    onPress={() => setDialog("role")}
                    disabled={!selectedRole || selectedRole === target.role}
                    className={`mt-2 flex-row items-center self-start rounded-xl bg-[#1D4ED8] px-4 py-2.5 ${
                      !selectedRole || selectedRole === target.role ? "opacity-40" : ""
                    }`}
                  >
                    <UserCog size={16} color="#FFFFFF" />
                    <Text className="ml-2 text-sm font-bold text-white">
                      Change role
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View className="mt-6 flex-row flex-wrap gap-2 border-t border-slate-100 pt-5">
                {canManageTarget ? (
                  suspended ? (
                    <TouchableOpacity
                      onPress={() => setDialog("unsuspend")}
                      className="flex-row items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5"
                    >
                      <ShieldCheck size={16} color="#059669" />
                      <Text className="ml-2 text-sm font-bold text-emerald-700">
                        Restore account
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setDialog("suspend")}
                      className="flex-row items-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5"
                    >
                      <ShieldAlert size={16} color="#D97706" />
                      <Text className="ml-2 text-sm font-bold text-amber-700">
                        Suspend
                      </Text>
                    </TouchableOpacity>
                  )
                ) : null}

                {canManageTarget && superadmin ? (
                  <TouchableOpacity
                    onPress={() => setDialog("force")}
                    className="flex-row items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5"
                  >
                    <RefreshCw size={16} color="#475569" />
                    <Text className="ml-2 text-sm font-bold text-slate-700">
                      Force sign-out
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {canManageTarget && superadmin ? (
                  <TouchableOpacity
                    onPress={() => setDialog("delete")}
                    className="flex-row items-center rounded-xl border border-red-200 bg-red-50 px-4 py-2.5"
                  >
                    <Trash2 size={16} color="#DC2626" />
                    <Text className="ml-2 text-sm font-bold text-red-600">
                      Delete account
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View className="mb-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <Text className="text-lg font-bold text-slate-800">Recent content</Text>
              {target.recent_content.length === 0 ? (
                <Text className="py-6 text-sm text-slate-400">
                  No posts or theses yet.
                </Text>
              ) : (
                target.recent_content.map((item) => (
                  <View
                    key={`${item.type}-${item.id}`}
                    className="mt-3 flex-row items-center rounded-xl border border-slate-100 p-3"
                  >
                    <View className="mr-3 h-9 w-9 items-center justify-center rounded-lg bg-slate-50">
                      {item.type === "thesis" ? (
                        <BookOpen size={16} color="#64748B" />
                      ) : (
                        <FileText size={16} color="#64748B" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-sm font-semibold text-slate-800"
                        numberOfLines={1}
                      >
                        {item.title || "Untitled"}
                      </Text>
                      <Text className="text-xs text-slate-400">
                        {item.type} · {item.status} · {formatDate(item.created_at)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <Text className="text-lg font-bold text-slate-800">Sanctions</Text>
              {target.sanctions.length === 0 ? (
                <Text className="py-6 text-sm text-slate-400">
                  No sanctions recorded.
                </Text>
              ) : (
                target.sanctions.map((entry) => (
                  <View
                    key={entry.id}
                    className="mt-3 border-b border-slate-50 pb-3 last:border-0"
                  >
                    <Text className="text-sm font-semibold text-slate-800">
                      {entry.action}
                    </Text>
                    <Text className="mt-0.5 text-xs text-slate-500">
                      {entry.actor_username || "system"} · {formatDate(entry.created_at, true)}
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
          </View>
        </View>
      )}

      <ActionDialog
        key={dialog || "closed"}
        visible={!!dialog}
        title={dialogProps.title}
        description={dialogProps.description}
        confirmLabel={dialogProps.confirmLabel}
        destructive={dialogProps.destructive}
        showUntil={dialogProps.showUntil}
        confirmationPhrase={dialogProps.confirmationPhrase}
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={(input) => confirmDialog(input)}
      />
    </ScrollView>
  );
}
