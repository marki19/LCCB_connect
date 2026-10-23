import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
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
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import {
  listAdminContent,
  moderateContent,
  resolveMessageReport,
  type AdminContentItem,
  type ContentType,
  type ModerationAction,
} from "../../src/lib/adminApi";
import { apiJson } from "../../src/lib/api";
import { fetchDepartments } from "../../src/lib/catalog";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { ThemeTokens } from "../../src/lib/tokens";
import { isSuperAdminRole } from "../../src/lib/roles";
import type { Department } from "../../src/types";
import ActionDialog from "../../src/components/admin/ActionDialog";
import PageHeader from "../../src/components/admin/PageHeader";

type PendingAction = {
  report: boolean;
  id: string;
  type?: ContentType;
  action: ModerationAction | "reviewed" | "dismissed";
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
  confirmationPhrase?: string;
};

type QueueItem = {
  key: string;
  kind: "post" | "comment" | "thesis" | "report";
  id: string;
  title: string;
  excerpt: string;
  reason?: string;
  reporter?: string;
  author: string;
  createdAt: string;
  postId?: string;
};

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "post", label: "Posts" },
  { value: "comment", label: "Comments" },
  { value: "thesis", label: "Theses" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "approved", label: "Approved" },
  { value: "flagged", label: "Flagged" },
  { value: "hidden", label: "Hidden" },
];

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

function getStatusBadgeStyle(status: string, colors: ThemeTokens) {
  if (status === "hidden") return { bg: colors.destructiveSurface, text: colors.destructiveText };
  if (status === "flagged") return { bg: colors.warningSurface, text: colors.warningText };
  return { bg: colors.successSurface, text: colors.successText };
}

function FilterChip({
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

export default function AdminContentScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const superadmin = isSuperAdminRole(profile?.role);

  const [tab, setTab] = useState<"queue" | "library">("queue");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState("");

  const [items, setItems] = useState<AdminContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const libraryRequest = useRef(0);

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

  const loadQueue = useCallback(async () => {
    await Promise.resolve();
    setQueueLoading(true);
    setQueueError("");
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
          title: comment.post_title ? `Comment on “${comment.post_title}”` : "Comment",
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
          author:
            thesis.uploader?.full_name || thesis.uploader?.username || "Unknown",
          createdAt: thesis.created_at,
        })),
        ...(data.messageReports || []).map((report: any) => ({
          key: `report-${report.id}`,
          kind: "report" as const,
          id: report.id,
          title: `Reported message from ${report.sender?.full_name || report.sender?.username || "Unknown"
            }`,
          excerpt: report.message_body || "",
          reason: report.reason,
          reporter:
            report.reporter?.full_name || report.reporter?.username || "Unknown",
          createdAt: report.created_at,
        })),
      ].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setQueue(next);
    } catch (e: any) {
      setQueueError(e?.message || "Could not load the moderation queue.");
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const loadLibrary = useCallback(
    async (nextCursor: string | null, append: boolean) => {
      const requestId = ++libraryRequest.current;
      await Promise.resolve();
      if (append) setLoadingMore(true);
      else {
        setLibraryLoading(true);
        setItems([]);
      }
      setLibraryError("");
      try {
        const page = await listAdminContent({
          type: type === "all" ? undefined : type,
          status: status === "all" ? undefined : status,
          q: debouncedQ || undefined,
          department_id: departmentId || undefined,
          limit: 25,
          cursor: nextCursor,
        });
        if (requestId !== libraryRequest.current) return;
        setItems((current) => (append ? [...current, ...page.items] : page.items));
        setTotal(page.total);
        setCursor(page.next_cursor);
      } catch (e: any) {
        if (requestId !== libraryRequest.current) return;
        setLibraryError(e?.message || "Could not load the content library.");
      } finally {
        if (requestId === libraryRequest.current) {
          setLibraryLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [type, status, debouncedQ, departmentId]
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadQueue(), 0);
    return () => clearTimeout(timer);
  }, [loadQueue]);

  useEffect(() => {
    const timer = setTimeout(() => void loadLibrary(null, false), 0);
    return () => clearTimeout(timer);
  }, [loadLibrary]);

  const refresh = () => {
    void loadQueue();
    void loadLibrary(null, false);
  };

  const openContentAction = (
    item: { id: string; type: ContentType; title: string },
    action: ModerationAction
  ) => {
    const verbs: Record<ModerationAction, string> = {
      restore: "Restore",
      hide: "Hide",
      delete: "Delete",
    };
    setActionError("");
    setPending({
      report: false,
      id: item.id,
      type: item.type,
      action,
      title: `${verbs[action]} ${item.type}`,
      description:
        action === "delete"
          ? "Permanently deletes the row. This cannot be undone. PDF storage is left untouched for theses."
          : action === "hide"
            ? "Removes the content from public surfaces. The author is notified and the reason is recorded."
            : "Marks the content approved and returns it to public surfaces.",
      confirmLabel: action === "delete" ? "Delete permanently" : verbs[action],
      destructive: action === "delete",
      confirmationPhrase: action === "delete" ? "delete" : undefined,
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
      destructive: false,
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
          `${pending.type[0].toUpperCase()}${pending.type.slice(1)} ${pending.action === "restore" ? "restored" : pending.action === "hide" ? "hidden" : "deleted"
          }.`
        );
      }
      setPending(null);
      refresh();
    } catch (e: any) {
      setActionError(e?.message || "The moderation action failed.");
    } finally {
      setBusy(false);
    }
  };

  const queueCounts = useMemo(
    () => ({
      content: queue.filter((item) => item.kind !== "report").length,
      reports: queue.filter((item) => item.kind === "report").length,
    }),
    [queue]
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        eyebrow="Governance / moderation"
        title="Reports & Content"
        description="Work the moderation queue or audit the full content library. Every decision carries a reason."
        onRefresh={refresh}
        refreshing={queueLoading || libraryLoading}
      />

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

      <View style={{ marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
        {[
          { value: "queue" as const, label: `Moderation queue (${queue.length})` },
          { value: "library" as const, label: "Content library" },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            onPress={() => setTab(option.value)}
            style={{
              marginBottom: -1,
              borderBottomWidth: 2,
              borderBottomColor: tab === option.value ? colors.primary : "transparent",
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: tab === option.value ? colors.primary : colors.textSecondary,
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "queue" ? (
        <>
          {queueError ? (
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
              <Text style={{ fontWeight: "600", color: colors.destructiveText }}>{queueError}</Text>
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
                Content <Text style={{ fontWeight: "800" }}>{queueCounts.content}</Text>
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
                Message reports <Text style={{ fontWeight: "800" }}>{queueCounts.reports}</Text>
              </Text>
            </View>
          </View>

          {queueLoading ? (
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : queue.length === 0 ? (
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
              <Text style={{ marginTop: 12, fontSize: 15, fontWeight: "600", color: colors.textSecondary }}>
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
                  <View style={{ marginBottom: 12, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View
                        style={{
                          marginRight: 12,
                          height: 36,
                          width: 36,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 10,
                          backgroundColor: item.kind === "report" ? colors.destructiveSurface : colors.warningSurface,
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
                        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>
                          {item.kind === "report" ? "Reported message" : item.kind}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                          {formatDate(item.createdAt)}
                        </Text>
                      </View>
                    </View>
                    {item.kind !== "report" && item.postId ? (
                      <TouchableOpacity
                        onPress={() => router.push(`/post/${item.postId}` as any)}
                      >
                        <ArrowUpRight size={16} color={colors.textTertiary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: colors.textSecondary }} numberOfLines={3}>
                    {item.excerpt || "No text content."}
                  </Text>
                  {item.reason ? (
                    <Text style={{ marginTop: 8, fontSize: 12, fontWeight: "600", color: colors.destructiveText }}>
                      Report reason: {item.reason}
                    </Text>
                  ) : null}
                  <Text style={{ marginTop: 8, fontSize: 12, color: colors.textTertiary }}>
                    By {item.author}
                    {item.reporter ? ` · Reported by ${item.reporter}` : ""}
                  </Text>

                  <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 8, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12 }}>
                    {item.kind === "report" ? (
                      <>
                        <TouchableOpacity
                          onPress={() => openReportAction(item, "reviewed")}
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
                          <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: "700", color: colors.successText }}>
                            Reviewed
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => openReportAction(item, "dismissed")}
                          style={{
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: colors.borderStrong,
                            backgroundColor: colors.surfaceSunken,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary }}>
                            Dismiss
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          onPress={() =>
                            openContentAction(
                              {
                                id: item.id,
                                type: item.kind as ContentType,
                                title: item.title,
                              },
                              "restore"
                            )
                          }
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
                          <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: "700", color: colors.successText }}>
                            Restore
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            openContentAction(
                              {
                                id: item.id,
                                type: item.kind as ContentType,
                                title: item.title,
                              },
                              "hide"
                            )
                          }
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
                          <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: "700", color: colors.warningText }}>
                            Hide
                          </Text>
                        </TouchableOpacity>
                        {superadmin ? (
                          <TouchableOpacity
                            onPress={() =>
                              openContentAction(
                                {
                                  id: item.id,
                                  type: item.kind as ContentType,
                                  title: item.title,
                                },
                                "delete"
                              )
                            }
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: colors.destructive,
                              backgroundColor: colors.destructiveSurface,
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                            }}
                          >
                            <Trash2 size={14} color={colors.destructiveText} />
                            <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: "700", color: colors.destructiveText }}>
                              Delete
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <>
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
                  placeholder="Search titles and text…"
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
              <Text style={{ fontSize: 13, color: colors.textTertiary }}>
                {libraryLoading ? "Loading…" : `${total} item${total === 1 ? "" : "s"}`}
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
              {TYPE_OPTIONS.map((option) => (
                <FilterChip
                  key={`type-${option.value}`}
                  label={option.label}
                  active={type === option.value}
                  onPress={() => setType(option.value)}
                  colors={colors}
                />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {STATUS_OPTIONS.map((option) => (
                <FilterChip
                  key={`status-${option.value}`}
                  label={option.label}
                  active={status === option.value}
                  onPress={() => setStatus(option.value)}
                  colors={colors}
                />
              ))}
              <View style={{ marginHorizontal: 8, marginVertical: 4, width: 1, backgroundColor: colors.divider }} />
              <FilterChip
                label="All departments"
                active={!departmentId}
                onPress={() => setDepartmentId("")}
                colors={colors}
              />
              {departments.map((department) => (
                <FilterChip
                  key={department.id}
                  label={department.name}
                  active={departmentId === department.id}
                  onPress={() => setDepartmentId(department.id)}
                  colors={colors}
                />
              ))}
            </ScrollView>
          </View>

          {libraryError ? (
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
              <Text style={{ fontWeight: "600", color: colors.destructiveText }}>{libraryError}</Text>
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
              <Text style={{ width: 80, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
                Type
              </Text>
              <Text style={{ flex: 2, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
                Content
              </Text>
              <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
                Author
              </Text>
              <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
                Department
              </Text>
              <Text style={{ width: 96, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
                Status
              </Text>
              <Text style={{ width: 112, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
                Created
              </Text>
              <Text style={{ width: 128, textAlign: "right", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
                Actions
              </Text>
            </View>

            {libraryLoading ? (
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 64 }}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : items.length === 0 ? (
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 64 }}>
                <FileText size={30} color={colors.textDisabled} />
                <Text style={{ marginTop: 12, fontSize: 15, fontWeight: "600", color: colors.textSecondary }}>No content matches these filters.</Text>
              </View>
            ) : (
              items.map((item) => {
                const badgeStyle = getStatusBadgeStyle(item.status, colors);
                return (
                  <View
                    key={`${item.type}-${item.id}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderBottomWidth: 1,
                      borderBottomColor: colors.tableRowBorder,
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                    }}
                  >
                    <View style={{ width: 80, flexDirection: "row", alignItems: "center" }}>
                      {item.type === "comment" ? (
                        <MessageSquare size={15} color={colors.textTertiary} />
                      ) : (
                        <FileText size={15} color={colors.textTertiary} />
                      )}
                      <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: "600", color: colors.textSecondary, textTransform: "capitalize" }}>
                        {item.type}
                      </Text>
                    </View>
                    <View style={{ flex: 2, paddingRight: 16 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }} numberOfLines={1}>
                        {item.title || "Untitled"}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textTertiary }} numberOfLines={1}>
                        {item.excerpt || "No text"}
                      </Text>
                    </View>
                    <Text style={{ flex: 1, paddingRight: 8, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>
                      {item.author.full_name || item.author.username || "Unknown"}
                    </Text>
                    <Text style={{ flex: 1, paddingRight: 8, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>
                      {item.department_name || "—"}
                    </Text>
                    <View style={{ width: 96 }}>
                      <View
                        style={{
                          alignSelf: "flex-start",
                          borderRadius: 9999,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          backgroundColor: badgeStyle.bg,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "700", color: badgeStyle.text, textTransform: "capitalize" }}>
                          {item.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ width: 112, fontSize: 12, color: colors.textTertiary }}>
                      {formatDate(item.created_at)}
                    </Text>
                    <View style={{ width: 128, flexDirection: "row", justifyContent: "flex-end", gap: 6 }}>
                      <TouchableOpacity
                        onPress={() =>
                          openContentAction(
                            { id: item.id, type: item.type, title: item.title },
                            item.status === "approved" ? "hide" : "restore"
                          )
                        }
                        style={{
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: colors.borderStrong,
                          backgroundColor: colors.surfaceSunken,
                          padding: 8,
                        }}
                      >
                        {item.status === "approved" ? (
                          <EyeOff size={13} color={colors.textSecondary} />
                        ) : (
                          <CheckCircle2 size={13} color={colors.successText} />
                        )}
                      </TouchableOpacity>
                      {superadmin ? (
                        <TouchableOpacity
                          onPress={() =>
                            openContentAction(
                              { id: item.id, type: item.type, title: item.title },
                              "delete"
                            )
                          }
                          style={{
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: colors.destructive,
                            backgroundColor: colors.destructiveSurface,
                            padding: 8,
                          }}
                        >
                          <Trash2 size={13} color={colors.destructiveText} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {cursor ? (
            <TouchableOpacity
              onPress={() => void loadLibrary(cursor, true)}
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
        </>
      )}

      <ActionDialog
        key={pending ? `${pending.id}-${pending.action}` : "closed"}
        visible={!!pending}
        title={pending?.title || ""}
        description={pending?.description}
        confirmLabel={pending?.confirmLabel}
        destructive={pending?.destructive}
        confirmationPhrase={pending?.confirmationPhrase}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={(input) => void confirmPending(input)}
      />
    </ScrollView>
  );
}

