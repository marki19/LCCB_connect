import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  Mail,
  IdCard,
  Building2,
  GraduationCap,
  Calendar,
  Inbox,
  Search,
} from "lucide-react-native";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { apiJson, ApiError } from "../src/lib/api";
import { safeBack } from "../src/lib/navigation";
import { focusRing, RADIUS, SPACE, TYPE } from "../src/lib/tokens";
import Button, { IconButton } from "../src/components/ui/Button";
import Card from "../src/components/ui/Card";
import Modal from "../src/components/ui/Modal";
import TextField from "../src/components/ui/TextField";
import EmptyState from "../src/components/admin/EmptyState";
import StatusBadge, { type BadgeTone } from "../src/components/admin/StatusBadge";

type ReviewStatus = "pending" | "approved" | "declined";

interface VerificationRequest {
  id: string;
  user_id: string;
  username: string;
  email: string;
  full_name: string;
  student_id: string;
  department_id: string;
  department_name: string;
  course_id: string;
  course_name: string;
  year_level: string;
  birthdate?: string;
  status: ReviewStatus;
  note?: string;
  submitted_at: string;
  decided_at?: string;
  decided_by_name?: string;
}

const PAGE_SIZE = 20;

const STATUS_TONE: Record<ReviewStatus, BadgeTone> = {
  pending: "warning",
  approved: "success",
  declined: "danger",
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
};

function initials(name?: string | null) {
  if (!name) return "??";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * The server's `/verification/queue` returns `{ requests: rows }` with cursor
 * pagination. Older clients expected `{ items, total, page, pageSize }`; accept
 * either shape and normalise the field names so the screen cannot crash on a
 * contract change.
 */
function normalizeRequest(raw: any): VerificationRequest {
  const email: string = raw.email ?? raw.user_email ?? "";
  return {
    id: raw.id,
    user_id: raw.user_id,
    username: raw.username ?? (email ? email.split("@")[0] : ""),
    email,
    full_name: raw.full_name ?? "Unnamed student",
    student_id: raw.student_id ?? "—",
    department_id: raw.department_id ?? "",
    department_name: raw.department_name ?? "No department",
    course_id: raw.course_id ?? "",
    course_name: raw.course_name ?? "—",
    year_level: raw.year_level ?? "—",
    birthdate: raw.birthdate ?? undefined,
    status: (raw.status ?? "pending") as ReviewStatus,
    note: raw.note ?? raw.review_note ?? undefined,
    submitted_at: raw.submitted_at ?? raw.created_at ?? "",
    decided_at: raw.decided_at ?? raw.reviewed_at ?? undefined,
    decided_by_name: raw.decided_by_name ?? undefined,
  };
}

export default function VerifyRequestsScreen() {
  const { profile, refreshProfile } = useAuth();
  const { colors } = useTheme();

  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | ReviewStatus>("pending");

  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineNote, setDeclineNote] = useState("");
  const [declining, setDeclining] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  const isDepartmentAdmin = profile?.role === "departmentAdmin";
  const isAdminOrAbove = ["admin", "superadmin"].includes(profile?.role || "");
  const canReview = isDepartmentAdmin || isAdminOrAbove;

  const cursorRef = useRef<string | null>(null);
  const loadedInitialRef = useRef(false);

  const loadQueue = useCallback(
    async (append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (filterStatus !== "all") params.append("status", filterStatus);
        if (append && cursorRef.current) params.append("cursor", cursorRef.current);

        const data = await apiJson<any>(`/verification/queue?${params.toString()}`);
        const rawRows: any[] = Array.isArray(data) ? data : data?.requests ?? data?.items ?? [];
        const rows = rawRows.map(normalizeRequest);

        setRequests((prev) => (append ? [...prev, ...rows] : rows));
        const last = rawRows[rawRows.length - 1];
        cursorRef.current = last?.submitted_at ?? null;
        setHasMore(rawRows.length === PAGE_SIZE);
      } catch (error: any) {
        setNotice({
          title: "Could not load requests",
          message:
            error instanceof ApiError
              ? error.message
              : "The verification queue is unavailable right now. Try again in a moment.",
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [filterStatus]
  );

  useEffect(() => {
    if (!loadedInitialRef.current && canReview) {
      loadedInitialRef.current = true;
      void loadQueue(false);
    }
  }, [canReview, loadQueue]);

  const reload = () => {
    cursorRef.current = null;
    void loadQueue(false);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    reload();
  };

  const handleFilterChange = (status: "all" | ReviewStatus) => {
    setFilterStatus(status);
    cursorRef.current = null;
  };

  // The backend filters by status; the refetch runs when the filter changes.
  useEffect(() => {
    if (!loadedInitialRef.current) return;
    cursorRef.current = null;
    void loadQueue(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) void loadQueue(true);
  };

  const handleApprove = async (request: VerificationRequest) => {
    setApproving(request.id);
    try {
      await apiJson(`/verification/${request.id}/approve`, { method: "POST" });
      setNotice({
        title: "Request approved",
        message: "The student is verified and now has full access.",
      });
      await refreshProfile();
      reload();
    } catch (error: any) {
      setNotice({
        title: "Could not approve",
        message:
          error instanceof ApiError ? error.message : "Failed to approve the request.",
      });
    } finally {
      setApproving(null);
    }
  };

  const handleDeclinePress = (request: VerificationRequest) => {
    setSelectedRequest(request);
    setDeclineNote("");
    setShowDeclineModal(true);
  };

  const closeDecline = () => {
    if (declining) return;
    setShowDeclineModal(false);
    setSelectedRequest(null);
    setDeclineNote("");
  };

  const handleDeclineConfirm = async () => {
    if (!selectedRequest) return;
    const note = declineNote.trim();
    if (!note) {
      setNotice({
        title: "Reason required",
        message: "Add a short reason so the student knows what to correct.",
      });
      return;
    }

    setDeclining(true);
    try {
      await apiJson(`/verification/${selectedRequest.id}/decline`, {
        method: "POST",
        body: JSON.stringify({ note }),
      });
      setShowDeclineModal(false);
      setSelectedRequest(null);
      setDeclineNote("");
      setNotice({
        title: "Request declined",
        message: "The student has been notified and can resubmit.",
      });
      await refreshProfile();
      reload();
    } catch (error: any) {
      setNotice({
        title: "Could not decline",
        message:
          error instanceof ApiError ? error.message : "Failed to decline the request.",
      });
    } finally {
      setDeclining(false);
    }
  };

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return requests.filter((request) => {
      if (filterStatus !== "all" && request.status !== filterStatus) return false;
      if (!query) return true;
      return [request.full_name, request.username, request.student_id, request.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [requests, filterStatus, searchQuery]);

  if (!canReview) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }} edges={["top"]}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: SPACE.x6,
          }}
        >
          <Card style={{ width: "100%", maxWidth: 420, padding: SPACE.x8 }}>
            <EmptyState
              icon={AlertCircle}
              tone="danger"
              title="Access denied"
              body="Only department admins and above can review verification requests."
              actionLabel="Go back"
              onAction={() => safeBack("/(tabs)")}
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const renderRequest = ({ item }: { item: VerificationRequest }) => {
    const isPending = item.status === "pending";
    return (
      <Card padding={0} style={{ marginBottom: SPACE.x3, overflow: "hidden" }}>
        <View style={{ padding: SPACE.x4 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: SPACE.x3 }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: colors.brandWash,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.brand }}>
                {initials(item.full_name)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ ...TYPE.bodyStrong, fontWeight: "700", color: colors.ink }} numberOfLines={1}>
                {item.full_name}
              </Text>
              <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 2 }} numberOfLines={1}>
                @{item.username || "student"} · submitted {formatDate(item.submitted_at)}
              </Text>
            </View>
            <StatusBadge label={STATUS_LABEL[item.status]} tone={STATUS_TONE[item.status]} />
          </View>

          <View style={{ gap: SPACE.x2, marginTop: SPACE.x4 }}>
            <DetailRow icon={Mail} text={item.email || "No email on file"} />
            <DetailRow icon={IdCard} text={`Student ID: ${item.student_id}`} />
            <DetailRow icon={Building2} text={item.department_name} />
            <DetailRow icon={GraduationCap} text={`${item.course_name} — ${item.year_level}`} />
            {item.birthdate ? (
              <DetailRow icon={Calendar} text={`Birthdate: ${item.birthdate}`} />
            ) : null}
          </View>

          {item.note && item.status === "declined" ? (
            <View
              style={{
                marginTop: SPACE.x3,
                padding: SPACE.x3,
                borderRadius: RADIUS.md,
                backgroundColor: colors.accentWash,
                borderWidth: 1,
                borderColor: colors.accent,
              }}
            >
              <Text
                style={{
                  ...TYPE.micro,
                  color: colors.accentText,
                  marginBottom: SPACE.x1,
                }}
              >
                Reviewer note
              </Text>
              <Text style={{ ...TYPE.caption, color: colors.ink, lineHeight: 18 }}>
                {item.note}
              </Text>
            </View>
          ) : null}
        </View>

        {isPending ? (
          <View
            style={{
              flexDirection: "row",
              gap: SPACE.x3,
              padding: SPACE.x4,
              borderTopWidth: 1,
              borderTopColor: colors.line,
              backgroundColor: colors.panelInset,
            }}
          >
            <View style={{ flex: 1 }}>
              <Button
                label="Decline"
                variant="secondary"
                size="sm"
                fullWidth
                onPress={() => handleDeclinePress(item)}
                disabled={declining || approving === item.id}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Approve"
                size="sm"
                fullWidth
                icon={CheckCircle2}
                loading={approving === item.id}
                disabled={approving === item.id}
                onPress={() => void handleApprove(item)}
              />
            </View>
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.x3,
          paddingHorizontal: SPACE.x4,
          minHeight: 64,
          backgroundColor: colors.panel,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        <IconButton icon={ArrowLeft} label="Back" onPress={() => safeBack("/(tabs)")} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>Verification</Text>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>Review requests</Text>
        </View>
        <IconButton
          icon={UserCheck}
          label="Refresh queue"
          variant="subtle"
          onPress={handleRefresh}
        />
      </View>

      <View style={{ width: "100%", maxWidth: 820, alignSelf: "center", flex: 1 }}>
        {/* Search + filters */}
        <View style={{ paddingHorizontal: SPACE.x4, paddingTop: SPACE.x4, gap: SPACE.x3 }}>
          <View
            style={[
              {
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.x2,
                minHeight: 46,
                borderRadius: RADIUS.md,
                borderWidth: 1,
                borderColor: searchFocused ? colors.brand : colors.inputBorder,
                backgroundColor: colors.inputBg,
                paddingHorizontal: SPACE.x3,
              },
              focusRing(colors, searchFocused),
            ]}
          >
            <Search size={16} color={colors.inkFaint} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search name, ID, or email…"
              placeholderTextColor={colors.inkFaint}
              accessibilityLabel="Search verification requests"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={
                {
                  flex: 1,
                  minHeight: 44,
                  fontSize: 14,
                  color: colors.ink,
                  outlineStyle: "none",
                } as any
              }
            />
          </View>

          <View
            accessibilityRole="tablist"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.x2 }}
          >
            {(["pending", "all", "approved", "declined"] as const).map((status) => {
              const active = filterStatus === status;
              const label = status === "all" ? "All" : STATUS_LABEL[status];
              return (
                <Pressable
                  key={status}
                  onPress={() => handleFilterChange(status)}
                  accessibilityRole="tab"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: active }}
                  onFocus={() => {}}
                  style={({ pressed }) => ({
                    minHeight: 36,
                    justifyContent: "center",
                    paddingHorizontal: SPACE.x4,
                    borderRadius: RADIUS.pill,
                    borderWidth: 1,
                    borderColor: active ? colors.brandSolid : colors.line,
                    backgroundColor: active
                      ? colors.brandSolid
                      : pressed
                      ? colors.surfaceSunken
                      : colors.panel,
                  })}
                >
                  <Text
                    style={{
                      ...TYPE.caption,
                      fontWeight: "700",
                      color: active ? colors.textOnBrandSolid : colors.inkSoft,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {loading && !refreshing ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.brand} />
          </View>
        ) : (
          <FlatList
            style={{ flex: 1, marginTop: SPACE.x4 }}
            data={filteredRequests}
            renderItem={renderRequest}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: SPACE.x4,
              paddingBottom: SPACE.x10,
              flexGrow: 1,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.brand}
                colors={[colors.brand]}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <Card style={{ marginTop: SPACE.x2 }}>
                <EmptyState
                  icon={searchQuery.trim() ? Search : Inbox}
                  tone="neutral"
                  compact
                  title={
                    searchQuery.trim()
                      ? "No matching requests"
                      : filterStatus === "pending"
                      ? "No pending requests"
                      : filterStatus === "all"
                      ? "No requests yet"
                      : `No ${STATUS_LABEL[filterStatus].toLowerCase()} requests`
                  }
                  body={
                    searchQuery.trim()
                      ? "Try a different search term or status filter."
                      : filterStatus === "pending"
                      ? "All caught up. New verification requests will appear here."
                      : "Requests will appear here once students submit their details."
                  }
                />
              </Card>
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={{ padding: SPACE.x4, alignItems: "center" }}>
                  <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.brand} />
                </View>
              ) : undefined
            }
          />
        )}
      </View>

      {/* Decline dialog */}
      <Modal
        visible={showDeclineModal}
        onClose={closeDecline}
        maxWidth={500}
        accessibilityLabel="Decline verification request"
      >
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>Decline request</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
            Give a reason the student can act on. They will see this note and can resubmit with
            corrected information.
          </Text>
          <View style={{ marginTop: SPACE.x5 }}>
            <TextField
              label="Reason"
              value={declineNote}
              onChangeText={setDeclineNote}
              placeholder="Reason for declining…"
              multiline
              minHeight={112}
              maxLength={300}
              hint={`${declineNote.trim().length}/300`}
              autoFocus
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: SPACE.x3,
              marginTop: SPACE.x4,
            }}
          >
            <Button
              label="Cancel"
              variant="secondary"
              onPress={closeDecline}
              disabled={declining}
            />
            <Button
              label="Decline"
              variant="danger"
              onPress={() => void handleDeclineConfirm()}
              loading={declining}
              disabled={!declineNote.trim() || declining}
            />
          </View>
        </View>
      </Modal>

      {/* Notice dialog */}
      <Modal
        visible={!!notice}
        onClose={() => setNotice(null)}
        maxWidth={440}
        accessibilityLabel={notice?.title ?? "Notice"}
      >
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>{notice?.title}</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
            {notice?.message}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: SPACE.x5 }}>
            <Button label="Got it" onPress={() => setNotice(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ icon: Icon, text }: { icon: any; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2 }}>
      <Icon size={14} color={colors.inkFaint} />
      <Text style={{ ...TYPE.caption, color: colors.inkSoft, flex: 1 }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}
