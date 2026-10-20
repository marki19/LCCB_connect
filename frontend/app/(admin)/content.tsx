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
  RefreshCw,
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
import { isSuperAdminRole } from "../../src/lib/roles";
import type { Department } from "../../src/types";
import ActionDialog from "../../src/components/admin/ActionDialog";

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

function statusStyle(status: string) {
  if (status === "hidden") return "bg-red-50 text-red-600";
  if (status === "flagged") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function FilterChip({
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
        active ? "border-[#1D4ED8] bg-blue-50" : "border-slate-200 bg-white"
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

export default function AdminContentScreen() {
  const router = useRouter();
  const { profile } = useAuth();
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
          title: `Reported message from ${
            report.sender?.full_name || report.sender?.username || "Unknown"
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
          `${pending.type[0].toUpperCase()}${pending.type.slice(1)} ${
            pending.action === "restore" ? "restored" : pending.action === "hide" ? "hidden" : "deleted"
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
      className="flex-1 bg-[#F8FAFC] p-8"
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-6 flex-row flex-wrap items-start justify-between gap-4">
        <View>
          <Text className="text-3xl font-black tracking-tight text-slate-900">
            Reports & Content
          </Text>
          <Text className="mt-1 text-base text-slate-500">
            Work the moderation queue or audit the full content library.
          </Text>
        </View>
        <TouchableOpacity
          onPress={refresh}
          className="flex-row items-center rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm"
        >
          <RefreshCw size={16} color="#475569" />
          <Text className="ml-2 text-sm font-semibold text-slate-700">Refresh</Text>
        </TouchableOpacity>
      </View>

      {notice ? (
        <View className="mb-4 flex-row items-center rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <CheckCircle2 size={18} color="#059669" />
          <Text className="ml-2 flex-1 font-semibold text-emerald-700">{notice}</Text>
        </View>
      ) : null}
      {actionError ? (
        <View className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4">
          <Text className="font-semibold text-red-600">{actionError}</Text>
        </View>
      ) : null}

      <View className="mb-5 flex-row items-center gap-2 border-b border-slate-200">
        {[
          { value: "queue" as const, label: `Moderation queue (${queue.length})` },
          { value: "library" as const, label: "Content library" },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            onPress={() => setTab(option.value)}
            className={`-mb-px border-b-2 px-4 py-3 ${
              tab === option.value
                ? "border-[#1D4ED8]"
                : "border-transparent"
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                tab === option.value ? "text-[#1D4ED8]" : "text-slate-500"
              }`}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "queue" ? (
        <>
          {queueError ? (
            <View className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4">
              <Text className="font-semibold text-red-600">{queueError}</Text>
            </View>
          ) : null}
          <View className="mb-4 flex-row flex-wrap gap-3">
            <View className="flex-row items-center rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
              <AlertTriangle size={16} color="#D97706" />
              <Text className="ml-2 text-sm text-amber-700">
                Content <Text className="font-bold">{queueCounts.content}</Text>
              </Text>
            </View>
            <View className="flex-row items-center rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <Flag size={16} color="#DC2626" />
              <Text className="ml-2 text-sm text-red-700">
                Message reports <Text className="font-bold">{queueCounts.reports}</Text>
              </Text>
            </View>
          </View>

          {queueLoading ? (
            <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" color="#1D4ED8" />
            </View>
          ) : queue.length === 0 ? (
            <View className="items-center justify-center rounded-2xl border border-slate-100 bg-white py-20">
              <ShieldCheck size={32} color="#CBD5E1" />
              <Text className="mt-3 text-base font-semibold text-slate-500">
                The queue is clear.
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-4">
              {queue.map((item) => (
                <View
                  key={item.key}
                  className="min-w-[340px] flex-1 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <View className="mb-3 flex-row items-start justify-between">
                    <View className="flex-row items-center">
                      <View
                        className={`mr-3 h-9 w-9 items-center justify-center rounded-lg ${
                          item.kind === "report" ? "bg-red-50" : "bg-amber-50"
                        }`}
                      >
                        {item.kind === "report" ? (
                          <Flag size={16} color="#DC2626" />
                        ) : item.kind === "comment" ? (
                          <MessageSquare size={16} color="#D97706" />
                        ) : (
                          <FileText size={16} color="#D97706" />
                        )}
                      </View>
                      <View>
                        <Text className="text-sm font-bold text-slate-800">
                          {item.kind === "report" ? "Reported message" : `${item.kind}`}
                        </Text>
                        <Text className="text-xs text-slate-400">
                          {formatDate(item.createdAt)}
                        </Text>
                      </View>
                    </View>
                    {item.kind !== "report" && item.postId ? (
                      <TouchableOpacity
                        onPress={() => router.push(`/post/${item.postId}` as any)}
                      >
                        <ArrowUpRight size={16} color="#64748B" />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <Text className="text-sm font-bold text-slate-800" numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text className="mt-1 text-sm leading-5 text-slate-500" numberOfLines={3}>
                    {item.excerpt || "No text content."}
                  </Text>
                  {item.reason ? (
                    <Text className="mt-2 text-xs font-semibold text-red-500">
                      Report reason: {item.reason}
                    </Text>
                  ) : null}
                  <Text className="mt-2 text-xs text-slate-400">
                    By {item.author}
                    {item.reporter ? ` · Reported by ${item.reporter}` : ""}
                  </Text>

                  <View className="mt-4 flex-row flex-wrap gap-2 border-t border-slate-100 pt-3">
                    {item.kind === "report" ? (
                      <>
                        <TouchableOpacity
                          onPress={() => openReportAction(item, "reviewed")}
                          className="flex-row items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"
                        >
                          <CheckCircle2 size={14} color="#059669" />
                          <Text className="ml-1.5 text-xs font-bold text-emerald-700">
                            Reviewed
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => openReportAction(item, "dismissed")}
                          className="rounded-lg border border-slate-200 px-3 py-2"
                        >
                          <Text className="text-xs font-bold text-slate-600">
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
                          className="flex-row items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"
                        >
                          <CheckCircle2 size={14} color="#059669" />
                          <Text className="ml-1.5 text-xs font-bold text-emerald-700">
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
                          className="flex-row items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                        >
                          <EyeOff size={14} color="#D97706" />
                          <Text className="ml-1.5 text-xs font-bold text-amber-700">
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
                            className="flex-row items-center rounded-lg border border-red-200 bg-red-50 px-3 py-2"
                          >
                            <Trash2 size={14} color="#DC2626" />
                            <Text className="ml-1.5 text-xs font-bold text-red-600">
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
          <View className="mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <View className="flex-row flex-wrap items-center gap-3">
              <View className="min-w-[260px] flex-1 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3">
                <Search size={18} color="#94A3B8" />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search titles and text…"
                  placeholderTextColor="#94A3B8"
                  className="ml-2 flex-1 py-2.5 text-slate-900"
                  autoCapitalize="none"
                />
              </View>
              <Text className="text-sm text-slate-400">
                {libraryLoading ? "Loading…" : `${total} item${total === 1 ? "" : "s"}`}
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
              {TYPE_OPTIONS.map((option) => (
                <FilterChip
                  key={`type-${option.value}`}
                  label={option.label}
                  active={type === option.value}
                  onPress={() => setType(option.value)}
                />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
              {STATUS_OPTIONS.map((option) => (
                <FilterChip
                  key={`status-${option.value}`}
                  label={option.label}
                  active={status === option.value}
                  onPress={() => setStatus(option.value)}
                />
              ))}
              <View className="mx-2 my-1 w-px bg-slate-200" />
              <FilterChip
                label="All departments"
                active={!departmentId}
                onPress={() => setDepartmentId("")}
              />
              {departments.map((department) => (
                <FilterChip
                  key={department.id}
                  label={department.name}
                  active={departmentId === department.id}
                  onPress={() => setDepartmentId(department.id)}
                />
              ))}
            </ScrollView>
          </View>

          {libraryError ? (
            <View className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4">
              <Text className="font-semibold text-red-600">{libraryError}</Text>
            </View>
          ) : null}

          <View className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <View className="flex-row items-center border-b border-slate-100 bg-slate-50 px-5 py-3">
              <Text className="w-20 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Type
              </Text>
              <Text className="flex-[2] text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Content
              </Text>
              <Text className="flex-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Author
              </Text>
              <Text className="flex-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Department
              </Text>
              <Text className="w-24 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Status
              </Text>
              <Text className="w-28 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Created
              </Text>
              <Text className="w-32 text-right text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Actions
              </Text>
            </View>

            {libraryLoading ? (
              <View className="items-center justify-center py-16">
                <ActivityIndicator size="large" color="#1D4ED8" />
              </View>
            ) : items.length === 0 ? (
              <View className="items-center justify-center py-16">
                <FileText size={30} color="#CBD5E1" />
                <Text className="mt-3 text-slate-500">No content matches these filters.</Text>
              </View>
            ) : (
              items.map((item) => (
                <View
                  key={`${item.type}-${item.id}`}
                  className="flex-row items-center border-b border-slate-50 px-5 py-3.5"
                >
                  <View className="w-20 flex-row items-center">
                    {item.type === "comment" ? (
                      <MessageSquare size={15} color="#64748B" />
                    ) : (
                      <FileText size={15} color="#64748B" />
                    )}
                    <Text className="ml-1.5 text-xs font-semibold text-slate-500">
                      {item.type}
                    </Text>
                  </View>
                  <View className="flex-[2] pr-4">
                    <Text className="text-sm font-semibold text-slate-800" numberOfLines={1}>
                      {item.title || "Untitled"}
                    </Text>
                    <Text className="text-xs text-slate-400" numberOfLines={1}>
                      {item.excerpt || "No text"}
                    </Text>
                  </View>
                  <Text className="flex-1 pr-2 text-xs text-slate-600" numberOfLines={1}>
                    {item.author.full_name || item.author.username || "Unknown"}
                  </Text>
                  <Text className="flex-1 pr-2 text-xs text-slate-600" numberOfLines={1}>
                    {item.department_name || "—"}
                  </Text>
                  <View className="w-24">
                    <View
                      className={`self-start rounded-full px-2.5 py-1 ${statusStyle(item.status)}`}
                    >
                      <Text className="text-[11px] font-bold">{item.status}</Text>
                    </View>
                  </View>
                  <Text className="w-28 text-xs text-slate-500">
                    {formatDate(item.created_at)}
                  </Text>
                  <View className="w-32 flex-row justify-end gap-1">
                    <TouchableOpacity
                      onPress={() =>
                        openContentAction(
                          { id: item.id, type: item.type, title: item.title },
                          item.status === "approved" ? "hide" : "restore"
                        )
                      }
                      className="rounded-lg border border-slate-200 p-2"
                    >
                      {item.status === "approved" ? (
                        <EyeOff size={13} color="#64748B" />
                      ) : (
                        <CheckCircle2 size={13} color="#059669" />
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
                        className="rounded-lg border border-red-100 bg-red-50 p-2"
                      >
                        <Trash2 size={13} color="#DC2626" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>

          {cursor ? (
            <TouchableOpacity
              onPress={() => void loadLibrary(cursor, true)}
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
