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
import { useTheme } from "../../../src/contexts/ThemeContext";
import { ThemeTokens } from "../../../src/lib/tokens";
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
  colors,
}: {
  label: string;
  value: string;
  icon?: any;
  colors: ThemeTokens;
}) {
  return (
    <View style={{ marginBottom: 16, flexDirection: "row", alignItems: "flex-start" }}>
      {Icon ? (
        <View
          style={{
            marginRight: 12,
            marginTop: 2,
            height: 32,
            width: 32,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            backgroundColor: colors.surfaceSunken,
          }}
        >
          <Icon size={15} color={colors.textTertiary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
          {label}
        </Text>
        <Text style={{ marginTop: 2, fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>
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
  const { colors } = useTheme();
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
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ marginBottom: 24, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <TouchableOpacity
          onPress={() => router.push("/(admin)/users" as any)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <ArrowLeft size={16} color={colors.textSecondary} />
          <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
            Users
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => void load()}
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <RefreshCw size={16} color={colors.textSecondary} />
          <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
            Refresh
          </Text>
        </TouchableOpacity>
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

      {loading && !target ? (
        <View style={{ minHeight: 320, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !target ? (
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingVertical: 80,
          }}
        >
          <UserRound size={32} color={colors.textDisabled} />
          <Text style={{ marginTop: 12, color: colors.textTertiary }}>Account not found.</Text>
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 24 }}>
          <View
            style={{
              minWidth: 300,
              flex: 0.9,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: 24,
            }}
          >
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  height: 96,
                  width: 96,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  borderRadius: 48,
                  backgroundColor: colors.primarySurface,
                  borderWidth: 2,
                  borderColor: colors.border,
                }}
              >
                {target.avatar_url ? (
                  <Image
                    source={{ uri: target.avatar_url }}
                    style={{ width: 96, height: 96 }}
                  />
                ) : (
                  <Text style={{ fontSize: 32, fontWeight: "900", color: colors.primary }}>
                    {(target.full_name || target.username || "?")[0]}
                  </Text>
                )}
              </View>
              <Text
                style={{
                  marginTop: 16,
                  textAlign: "center",
                  fontSize: 20,
                  fontWeight: "900",
                  color: colors.textPrimary,
                }}
              >
                {target.full_name || target.username || "Unnamed account"}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: colors.textTertiary }}>
                @{target.username || "unknown"}
              </Text>
              <View
                style={{
                  marginTop: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: 9999,
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  backgroundColor: suspended ? colors.destructiveSurface : colors.successSurface,
                }}
              >
                {suspended ? (
                  <ShieldAlert size={13} color={colors.destructiveText} />
                ) : (
                  <ShieldCheck size={13} color={colors.successText} />
                )}
                <Text
                  style={{
                    marginLeft: 6,
                    fontSize: 12,
                    fontWeight: "700",
                    color: suspended ? colors.destructiveText : colors.successText,
                  }}
                >
                  {suspended ? "Suspended" : "Active"}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 28, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 20 }}>
              <Detail label="Email" value={target.email || "—"} icon={Mail} colors={colors} />
              <Detail label="Role" value={target.role || "—"} icon={ShieldCheck} colors={colors} />
              <Detail
                label="Department"
                value={target.department_name || "—"}
                icon={BookOpen}
                colors={colors}
              />
              <Detail
                label="Course / year"
                value={
                  [target.course_name || target.course, target.year_level]
                    .filter(Boolean)
                    .join(" · ") || "—"
                }
                icon={FileText}
                colors={colors}
              />
              <Detail
                label="Joined"
                value={formatDate(target.created_at)}
                icon={CalendarDays}
                colors={colors}
              />
              <Detail
                label="Last seen"
                value={formatDate(target.last_seen_at, true)}
                icon={CalendarDays}
                colors={colors}
              />
            </View>

            {suspended ? (
              <View
                style={{
                  marginTop: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.destructive,
                  backgroundColor: colors.destructiveSurface,
                  padding: 16,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.destructiveText }}>
                  Current suspension
                </Text>
                <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: colors.textPrimary }}>
                  {target.suspension_reason || "No reason recorded."}
                </Text>
                <Text style={{ marginTop: 8, fontSize: 12, color: colors.destructiveText }}>
                  {target.suspended_until
                    ? `Until ${formatDate(target.suspended_until, true)}`
                    : "Indefinite"}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ minWidth: 460, flex: 1.6 }}>
            <View style={{ marginBottom: 20, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
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
                  style={{
                    minWidth: 110,
                    flex: 1,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    padding: 16,
                  }}
                >
                  <Icon size={16} color={colors.textTertiary} />
                  <Text style={{ marginTop: 8, fontSize: 24, fontWeight: "900", color: colors.textPrimary }}>
                    {value}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary }}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            <View
              style={{
                marginBottom: 20,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                padding: 24,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: "800", color: colors.textPrimary }}>Governance</Text>
              <Text style={{ marginTop: 4, fontSize: 13, color: colors.textSecondary }}>
                Every action requires a reason and is written to the audit log.
              </Text>

              <View style={{ marginTop: 20 }}>
                <Text style={{ marginBottom: 8, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
                  Role
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {(canManageTarget ? roles : []).map((option) => {
                    const active = selectedRole === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        onPress={() => setSelectedRole(option)}
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
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {!canManageTarget ? (
                    <Text style={{ fontSize: 13, color: colors.textTertiary }}>
                      This account is outside your management scope.
                    </Text>
                  ) : null}
                </View>

                {canManageTarget ? (
                  <TouchableOpacity
                    onPress={() => setDialog("role")}
                    disabled={!selectedRole || selectedRole === target.role}
                    style={{
                      marginTop: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      alignSelf: "flex-start",
                      borderRadius: 12,
                      backgroundColor: colors.primary,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      opacity: !selectedRole || selectedRole === target.role ? 0.45 : 1,
                    }}
                  >
                    <UserCog size={16} color={colors.textOnPrimary} />
                    <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: "700", color: colors.textOnPrimary }}>
                      Change role
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={{ marginTop: 24, flexDirection: "row", flexWrap: "wrap", gap: 10, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 20 }}>
                {canManageTarget ? (
                  suspended ? (
                    <TouchableOpacity
                      onPress={() => setDialog("unsuspend")}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.success,
                        backgroundColor: colors.successSurface,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                      }}
                    >
                      <ShieldCheck size={16} color={colors.successText} />
                      <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: "700", color: colors.successText }}>
                        Restore account
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setDialog("suspend")}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.warning,
                        backgroundColor: colors.warningSurface,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                      }}
                    >
                      <ShieldAlert size={16} color={colors.warningText} />
                      <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: "700", color: colors.warningText }}>
                        Suspend
                      </Text>
                    </TouchableOpacity>
                  )
                ) : null}

                {canManageTarget && superadmin ? (
                  <TouchableOpacity
                    onPress={() => setDialog("force")}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.borderStrong,
                      backgroundColor: colors.surface,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                    }}
                  >
                    <RefreshCw size={16} color={colors.textSecondary} />
                    <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: "700", color: colors.textSecondary }}>
                      Force sign-out
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {canManageTarget && superadmin ? (
                  <TouchableOpacity
                    onPress={() => setDialog("delete")}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.destructive,
                      backgroundColor: colors.destructiveSurface,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                    }}
                  >
                    <Trash2 size={16} color={colors.destructiveText} />
                    <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: "700", color: colors.destructiveText }}>
                      Delete account
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View
              style={{
                marginBottom: 20,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                padding: 24,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: "800", color: colors.textPrimary }}>Recent content</Text>
              {target.recent_content.length === 0 ? (
                <Text style={{ paddingVertical: 24, fontSize: 13, color: colors.textTertiary }}>
                  No posts or theses yet.
                </Text>
              ) : (
                target.recent_content.map((item) => (
                  <View
                    key={`${item.type}-${item.id}`}
                    style={{
                      marginTop: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceSunken,
                      padding: 12,
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
                        backgroundColor: colors.surface,
                      }}
                    >
                      {item.type === "thesis" ? (
                        <BookOpen size={16} color={colors.textTertiary} />
                      ) : (
                        <FileText size={16} color={colors.textTertiary} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}
                        numberOfLines={1}
                      >
                        {item.title || "Untitled"}
                      </Text>
                      <Text style={{ marginTop: 2, fontSize: 12, color: colors.textTertiary }}>
                        {item.type} · {item.status} · {formatDate(item.created_at)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                padding: 24,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: "800", color: colors.textPrimary }}>Sanctions</Text>
              {target.sanctions.length === 0 ? (
                <Text style={{ paddingVertical: 24, fontSize: 13, color: colors.textTertiary }}>
                  No sanctions recorded.
                </Text>
              ) : (
                target.sanctions.map((entry) => (
                  <View
                    key={entry.id}
                    style={{
                      marginTop: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.divider,
                      paddingBottom: 12,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>
                      {entry.action}
                    </Text>
                    <Text style={{ marginTop: 2, fontSize: 12, color: colors.textTertiary }}>
                      {entry.actor_username || "system"} · {formatDate(entry.created_at, true)}
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

