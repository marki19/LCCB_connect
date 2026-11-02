import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  EyeOff,
  FileText,
  Flag,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import {
  moderateContent,
  resolveMessageReport,
  type ContentType,
  type ModerationAction,
} from "../../lib/adminApi";
import { apiJson } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { isDepartmentAdminRole } from "../../lib/roles";
import ActionDialog from "../admin/ActionDialog";

type QueueKind = "post" | "comment" | "thesis" | "report";

type QueueItem = {
  key: string;
  kind: QueueKind;
  id: string;
  title: string;
  excerpt: string;
  reason?: string;
  reporter?: string;
  author: string;
  createdAt: string;
  postId?: string;
};

type PendingAction = {
  report: boolean;
  id: string;
  type?: ContentType;
  action: ModerationAction | "reviewed" | "dismissed";
  title: string;
  description: string;
  confirmLabel: string;
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

/**
 * Department-scoped moderation surface. Uses only `/moderation/*` routes:
 * the admin-only content library is deliberately not available here.
 */
export default function ModerationQueue() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors } = useTheme();

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  const scope = isDepartmentAdminRole(profile?.role)
    ? profile?.department_name || "your assigned department"
    : "all departments";
  const heading = isDepartmentAdminRole(profile?.role)
    ? "Department moderation"
    : "Moderation";

  const loadQueue = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError("");

    try {
      const data = await apiJson<any>("/moderation/queue");
      const next: QueueItem[] = [
        ...(data.flaggedPosts || []).map((post: any) => ({
          key: `post-${post.id}`,
          kind: "post" as const,
          id: post.id,
          title: post.title || "Untitled post",
          excerpt: post.content || "",
          author: post.author?.full_name || post.author?.username || "Unknown",
          createdAt: post.created_at,
        })),
        ...(data.flaggedComments || []).map((comment: any) => ({
          key: `comment-${comment.id}`,
          kind: "comment" as const,
          id: comment.id,
          title: comment.post_title ? `Comment on "${comment.post_title}"` : "Comment",
          excerpt: comment.content || "",
          author: comment.author?.full_name || comment.author?.username || "Unknown",
          createdAt: comment.created_at,
          postId: comment.post_id,
        })),
        ...(data.flaggedTheses || []).map((thesis: any) => ({
          key: `thesis-${thesis.id}`,
          kind: "thesis" as const,
          id: thesis.id,
          title: thesis.title || "Untitled thesis",
          excerpt: thesis.abstract || "",
          author: thesis.uploader?.full_name || thesis.uploader?.username || "Unknown",
          createdAt: thesis.created_at,
        })),
        ...(data.messageReports || []).map((report: any) => ({
          key: `report-${report.id}`,
          kind: "report" as const,
          id: report.id,
          title: `Reported message from ${report.sender?.full_name || report.sender?.username || "Unknown"}`,
          excerpt: report.message_body || "",
          reason: report.reason,
          reporter: report.reporter?.full_name || report.reporter?.username || "Unknown",
          createdAt: report.created_at,
        })),
      ].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setQueue(next);
    } catch (e: any) {
      setError(e?.message || "Could not load the moderation queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadQueue(), 0);
    return () => clearTimeout(timer);
  }, [loadQueue]);

  const counts = useMemo(
    () => ({
      content: queue.filter((item) => item.kind !== "report").length,
      reports: queue.filter((item) => item.kind === "report").length,
    }),
    [queue]
  );

  const openContentAction = (item: QueueItem, action: "restore" | "hide") => {
    setActionError("");
    setPending({
      report: false,
      id: item.id,
      type: item.kind as ContentType,
      action,
      title: action === "restore" ? "Approve content" : "Hide content",
      description:
        action === "hide"
          ? "Removes the content from public surfaces. The author is notified and the reason is recorded."
          : "Marks the content approved and returns it to public surfaces.",
      confirmLabel: action === "restore" ? "Approve" : "Hide",
    });
  };

  const openReportAction = (item: QueueItem, action: "reviewed" | "dismissed") => {
    setActionError("");
    setPending({
      report: true,
      id: item.id,
      action,
      title: action === "reviewed" ? "Mark report reviewed" : "Dismiss report",
      description:
        action === "reviewed"
          ? "Closes the report as reviewed. The message itself is not changed."
          : "Closes the report with no action against the message.",
      confirmLabel: action === "reviewed" ? "Mark reviewed" : "Dismiss",
    });
  };

  const confirmPending = async (input: { reason: string }) => {
    if (!pending) return;
    setBusy(true);
    setActionError("");
    setNotice("");

    try {
      if (pending.report) {
        await resolveMessageReport(
          pending.id,
          pending.action as "reviewed" | "dismissed",
          input.reason
        );
        setNotice("Report resolved.");
      } else if (pending.type) {
        await moderateContent(
          pending.type,
          pending.id,
          pending.action as ModerationAction,
          input.reason
        );
        setNotice(
          `${pending.type[0].toUpperCase()}${pending.type.slice(1)} ${
            pending.action === "restore" ? "approved" : "hidden"
          }.`
        );
      }

      setPending(null);
      void loadQueue();
    } catch (e: any) {
      setActionError(e?.message || "The moderation action failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          marginBottom: 24,
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <View style={{ flex: 1, minWidth: 260 }}>
          <Text
            style={{
              fontSize: 26,
              fontWeight: "900",
              letterSpacing: -0.5,
              color: colors.textPrimary,
            }}
          >
            {heading}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 14, color: colors.textSecondary }}>
            Review flagged posts, comments, theses, and message reports for {scope}.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => void loadQueue()}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Refresh moderation queue"
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: 16,
            paddingVertical: 10,
            opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={15} color={colors.textSecondary} />
          <Text
            style={{
              marginLeft: 8,
              fontSize: 13,
              fontWeight: "600",
              color: colors.textSecondary,
            }}
          >
            Refresh
          </Text>
        </TouchableOpacity>
      </View>

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

      {actionError ? (
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
          <Text style={{ fontWeight: "600", color: colors.destructiveText }}>{actionError}</Text>
        </View>
      ) : null}

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

      <View style={{ marginBottom: 16, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <View
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
          <AlertTriangle size={16} color={colors.warningText} />
          <Text style={{ marginLeft: 8, fontSize: 13, color: colors.warningText }}>
            Flagged content <Text style={{ fontWeight: "800" }}>{counts.content}</Text>
          </Text>
        </View>
        <View
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
          <Flag size={16} color={colors.destructiveText} />
          <Text style={{ marginLeft: 8, fontSize: 13, color: colors.destructiveText }}>
            Message reports <Text style={{ fontWeight: "800" }}>{counts.reports}</Text>
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : queue.length === 0 && !error ? (
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
          <ShieldCheck size={32} color={colors.textDisabled} />
          <Text
            style={{
              marginTop: 12,
              fontSize: 15,
              fontWeight: "600",
              color: colors.textSecondary,
            }}
          >
            The queue is clear.
          </Text>
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {queue.map((item) => (
            <View
              key={item.key}
              style={{
                minWidth: 340,
                flex: 1,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                padding: 20,
              }}
            >
              <View
                style={{
                  marginBottom: 12,
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      marginRight: 12,
                      height: 36,
                      width: 36,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 10,
                      backgroundColor:
                        item.kind === "report"
                          ? colors.destructiveSurface
                          : colors.warningSurface,
                    }}
                  >
                    {item.kind === "report" ? (
                      <Flag size={16} color={colors.destructiveText} />
                    ) : item.kind === "comment" ? (
                      <MessageSquare size={16} color={colors.warningText} />
                    ) : (
                      <FileText size={16} color={colors.warningText} />
                    )}
                  </View>
                  <View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: colors.textPrimary,
                        textTransform: "capitalize",
                      }}
                    >
                      {item.kind === "report" ? "Reported message" : item.kind}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>
                </View>
                {item.kind === "comment" && item.postId ? (
                  <TouchableOpacity
                    onPress={() => router.push(`/post/${item.postId}` as any)}
                    accessibilityRole="button"
                    accessibilityLabel="Open the commented post"
                  >
                    <ArrowUpRight size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text
                style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  lineHeight: 18,
                  color: colors.textSecondary,
                }}
                numberOfLines={3}
              >
                {item.excerpt || "No text content."}
              </Text>
              {item.reason ? (
                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    fontWeight: "600",
                    color: colors.destructiveText,
                  }}
                >
                  Report reason: {item.reason}
                </Text>
              ) : null}
              <Text style={{ marginTop: 8, fontSize: 12, color: colors.textTertiary }}>
                By {item.author}
                {item.reporter ? ` · Reported by ${item.reporter}` : ""}
              </Text>

              <View
                style={{
                  marginTop: 16,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  borderTopWidth: 1,
                  borderTopColor: colors.divider,
                  paddingTop: 12,
                }}
              >
                {item.kind === "report" ? (
                  <>
                    <TouchableOpacity
                      onPress={() => openReportAction(item, "reviewed")}
                      accessibilityRole="button"
                      accessibilityLabel="Mark report reviewed"
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.success,
                        backgroundColor: colors.successSurface,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                      }}
                    >
                      <CheckCircle2 size={14} color={colors.successText} />
                      <Text
                        style={{
                          marginLeft: 6,
                          fontSize: 12,
                          fontWeight: "700",
                          color: colors.successText,
                        }}
                      >
                        Reviewed
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => openReportAction(item, "dismissed")}
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss report"
                      style={{
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.borderStrong,
                        backgroundColor: colors.surfaceSunken,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: colors.textSecondary,
                        }}
                      >
                        Dismiss
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => openContentAction(item, "restore")}
                      accessibilityRole="button"
                      accessibilityLabel={`Approve ${item.kind}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.success,
                        backgroundColor: colors.successSurface,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                      }}
                    >
                      <CheckCircle2 size={14} color={colors.successText} />
                      <Text
                        style={{
                          marginLeft: 6,
                          fontSize: 12,
                          fontWeight: "700",
                          color: colors.successText,
                        }}
                      >
                        Approve
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => openContentAction(item, "hide")}
                      accessibilityRole="button"
                      accessibilityLabel={`Hide ${item.kind}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.warning,
                        backgroundColor: colors.warningSurface,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                      }}
                    >
                      <EyeOff size={14} color={colors.warningText} />
                      <Text
                        style={{
                          marginLeft: 6,
                          fontSize: 12,
                          fontWeight: "700",
                          color: colors.warningText,
                        }}
                      >
                        Hide
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      <ActionDialog
        visible={!!pending}
        title={pending?.title || "Moderation action"}
        description={pending?.description}
        confirmLabel={pending?.confirmLabel}
        busy={busy}
        onCancel={() => {
          if (!busy) {
            setPending(null);
            setActionError("");
          }
        }}
        onConfirm={(input) => void confirmPending(input)}
      />
    </ScrollView>
  );
}
