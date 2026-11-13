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
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  GraduationCap,
  IdCard,
  Inbox,
  Mail,
  Search,
  ShieldCheck,
  User,
  UserCheck,
  XCircle,
} from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useToast } from "../../src/contexts/ToastContext";
import { apiJson, ApiError } from "../../src/lib/api";
import { isAdminRole } from "../../src/lib/roles";
import { RADIUS, SPACE, TYPE, type ThemeTokens } from "../../src/lib/tokens";
import ActionDialog from "../../src/components/admin/ActionDialog";
import EmptyState from "../../src/components/admin/EmptyState";
import PageHeader from "../../src/components/admin/PageHeader";
import StatusBadge, { type BadgeTone } from "../../src/components/admin/StatusBadge";
import Button from "../../src/components/ui/Button";

type ReviewStatus = "pending" | "approved" | "declined";

interface VerificationRequest {
  id: string;
  user_id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
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

const PAGE_SIZE = 50;

const STATUS_TONE: Record<ReviewStatus, BadgeTone> = {
  pending: "warning",
  approved: "success",
  declined: "danger",
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  declined: "Declined",
};

function initials(name?: string | null) {
  if (!name) return "??";
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeRequest(raw: any): VerificationRequest {
  const email: string = raw.email ?? raw.user_email ?? "";
  return {
    id: raw.id,
    user_id: raw.user_id,
    username: raw.username ?? (email ? email.split("@")[0] : ""),
    email,
    full_name: raw.full_name ?? "Unnamed student",
    role: raw.role ?? "student",
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

function FilterChip({
  label,
  count,
  active,
  onPress,
  colors,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
  colors: ThemeTokens;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primarySurface : colors.surface,
        paddingHorizontal: SPACE.x4,
        paddingVertical: 7,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          color: active ? colors.primary : colors.textSecondary,
        }}
      >
        {label}
      </Text>
      {typeof count === "number" && count > 0 ? (
        <View
          style={{
            marginLeft: 7,
            borderRadius: RADIUS.pill,
            backgroundColor: active ? colors.primary : colors.surfaceSunken,
            paddingHorizontal: 7,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: active ? colors.surface : colors.textSecondary,
            }}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function RequestDetailRow({
  icon: Icon,
  label,
  value,
  colors,
}: {
  icon: any;
  label: string;
  value: string;
  colors: ThemeTokens;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Icon size={14} color={colors.textTertiary} />
      <Text style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>
        <Text style={{ color: colors.textTertiary, fontWeight: "500" }}>{label}: </Text>
        <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{value}</Text>
      </Text>
    </View>
  );
}

export default function AdminVerificationScreen() {
  const { profile, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | ReviewStatus>("pending");

  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const isAdmin = isAdminRole(profile?.role);
  const cursorRef = useRef<string | null>(null);
  const loadedInitialRef = useRef(false);

  const loadQueue = useCallback(
    async (append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setErrorNotice(null);

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
      } catch (err: any) {
        setErrorNotice(
          err instanceof ApiError
            ? err.message
            : "The verification queue is temporarily unavailable. Try again shortly."
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filterStatus]
  );

  useEffect(() => {
    if (!loadedInitialRef.current && isAdmin) {
      loadedInitialRef.current = true;
      void loadQueue(false);
    }
  }, [isAdmin, loadQueue]);

  useEffect(() => {
    if (!loadedInitialRef.current) return;
    cursorRef.current = null;
    void loadQueue(false);
  }, [loadQueue]);

  const reload = () => {
    cursorRef.current = null;
    void loadQueue(false);
  };

  const handleApprove = async (request: VerificationRequest) => {
    setApprovingId(request.id);
    setErrorNotice(null);
    try {
      await apiJson(`/verification/${request.id}/approve`, { method: "POST" });
      showToast({
        message: `${request.full_name} is now verified.`,
        tone: "success",
      });
      await refreshProfile();
      reload();
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Failed to approve the request.";
      setErrorNotice(msg);
      showToast({ message: msg, tone: "error" });
    } finally {
      setApprovingId(null);
    }
  };

  const handleDeclinePress = (request: VerificationRequest) => {
    setSelectedRequest(request);
    setShowDeclineModal(true);
  };

  const handleDeclineConfirm = async (reason: string) => {
    if (!selectedRequest) return;
    setDeclining(true);
    setErrorNotice(null);
    try {
      await apiJson(`/verification/${selectedRequest.id}/decline`, {
        method: "POST",
        body: JSON.stringify({ note: reason.trim() }),
      });
      showToast({
        message: `Verification declined for ${selectedRequest.full_name}.`,
        tone: "info",
      });
      setShowDeclineModal(false);
      setSelectedRequest(null);
      await refreshProfile();
      reload();
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Failed to decline the request.";
      setErrorNotice(msg);
      showToast({ message: msg, tone: "error" });
    } finally {
      setDeclining(false);
    }
  };

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((req) => {
      if (filterStatus !== "all" && req.status !== filterStatus) return false;
      if (!q) return true;
      return (
        req.full_name.toLowerCase().includes(q) ||
        req.username.toLowerCase().includes(q) ||
        req.student_id.toLowerCase().includes(q) ||
        req.email.toLowerCase().includes(q) ||
        req.department_name.toLowerCase().includes(q)
      );
    });
  }, [requests, filterStatus, searchQuery]);

  const pendingCount = useMemo(() => {
    return requests.filter((r) => r.status === "pending").length;
  }, [requests]);

  if (!isAdmin) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: SPACE.x8,
          backgroundColor: colors.surfacePage,
        }}
      >
        <EmptyState
          icon={AlertCircle}
          tone="danger"
          title="Access restricted"
          body="Only administrators can review campus-wide verification requests."
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        eyebrow="Governance / verification"
        title="Verification"
        description="Review student identity verification requests. Approvals grant full community and campus access."
        onRefresh={reload}
        refreshing={loading}
      />

      {errorNotice ? (
        <View
          style={{
            marginBottom: SPACE.x4,
            flexDirection: "row",
            alignItems: "center",
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: colors.destructive,
            backgroundColor: colors.destructiveSurface,
            padding: SPACE.x4,
          }}
        >
          <AlertCircle size={18} color={colors.destructiveText} />
          <Text style={{ marginLeft: SPACE.x3, flex: 1, fontWeight: "600", color: colors.destructiveText }}>
            {errorNotice}
          </Text>
        </View>
      ) : null}

      {/* Filter and Search Bar */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SPACE.x3,
          marginBottom: SPACE.x6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <FilterChip
            label="Pending"
            count={filterStatus === "pending" ? filteredRequests.length : pendingCount}
            active={filterStatus === "pending"}
            onPress={() => setFilterStatus("pending")}
            colors={colors}
          />
          <FilterChip
            label="All"
            active={filterStatus === "all"}
            onPress={() => setFilterStatus("all")}
            colors={colors}
          />
          <FilterChip
            label="Approved"
            active={filterStatus === "approved"}
            onPress={() => setFilterStatus("approved")}
            colors={colors}
          />
          <FilterChip
            label="Declined"
            active={filterStatus === "declined"}
            onPress={() => setFilterStatus("declined")}
            colors={colors}
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: SPACE.x3,
            minWidth: 260,
            maxWidth: 360,
            flex: 1,
            height: 40,
          }}
        >
          <Search size={16} color={colors.textTertiary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name, ID, or email..."
            placeholderTextColor={colors.textDisabled}
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 13,
              color: colors.textPrimary,
            }}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Queue Body */}
      {loading ? (
        <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
          <ActivityIndicator accessibilityLabel="Loading" size="large" color={colors.primary} />
          <Text style={{ marginTop: 12, fontSize: 13, color: colors.textSecondary }}>
            Loading verification queue...
          </Text>
        </View>
      ) : filteredRequests.length === 0 ? (
        <View
          style={{
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingVertical: 64,
            paddingHorizontal: 24,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <EmptyState
            icon={filterStatus === "pending" ? ShieldCheck : Inbox}
            tone={filterStatus === "pending" ? "success" : "neutral"}
            title={
              searchQuery
                ? "No matching requests"
                : filterStatus === "pending"
                ? "No pending requests"
                : "No requests in this filter"
            }
            body={
              searchQuery
                ? "Check your spelling or clear the search to see all items."
                : filterStatus === "pending"
                ? "All caught up! New student verification requests will appear here."
                : "No verification records found."
            }
            compact
          />
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {filteredRequests.map((request) => {
            const isPending = request.status === "pending";
            return (
              <View
                key={request.id}
                style={{
                  minWidth: 360,
                  flex: 1,
                  borderRadius: RADIUS.lg,
                  borderWidth: 1,
                  borderColor: isPending ? colors.border : colors.divider,
                  backgroundColor: colors.surface,
                  overflow: "hidden",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ padding: SPACE.x5 }}>
                  {/* Student Header */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: SPACE.x4,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: colors.brandWash,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 15, fontWeight: "800", color: colors.brand }}>
                          {initials(request.full_name)}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 15,
                            fontWeight: "700",
                            color: colors.textPrimary,
                          }}
                        >
                          {request.full_name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 12,
                            color: colors.textTertiary,
                            marginTop: 2,
                          }}
                        >
                          @{request.username || "student"} · Submitted {formatDate(request.submitted_at)}
                        </Text>
                      </View>
                    </View>

                    <StatusBadge
                      label={STATUS_LABEL[request.status]}
                      tone={STATUS_TONE[request.status]}
                    />
                  </View>

                  {/* Details Grid */}
                  <View style={{ gap: 10, marginTop: SPACE.x2 }}>
                    <RequestDetailRow
                      icon={IdCard}
                      label="Student ID"
                      value={request.student_id}
                      colors={colors}
                    />
                    <RequestDetailRow
                      icon={Mail}
                      label="Email"
                      value={request.email || "—"}
                      colors={colors}
                    />
                    <RequestDetailRow
                      icon={Building2}
                      label="Department"
                      value={request.department_name}
                      colors={colors}
                    />
                    <RequestDetailRow
                      icon={GraduationCap}
                      label="Course & Year"
                      value={`${request.course_name} (${request.year_level})`}
                      colors={colors}
                    />
                    {request.birthdate ? (
                      <RequestDetailRow
                        icon={Calendar}
                        label="Birthdate"
                        value={request.birthdate}
                        colors={colors}
                      />
                    ) : null}
                  </View>

                  {/* Decision / Reviewer Note */}
                  {request.status === "declined" && request.note ? (
                    <View
                      style={{
                        marginTop: SPACE.x4,
                        padding: SPACE.x3,
                        borderRadius: RADIUS.md,
                        backgroundColor: colors.destructiveSurface,
                        borderWidth: 1,
                        borderColor: colors.destructive,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                          color: colors.destructiveText,
                          marginBottom: 4,
                        }}
                      >
                        Declined Reason
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.destructiveText, lineHeight: 18 }}>
                        {request.note}
                      </Text>
                    </View>
                  ) : null}

                  {request.decided_at && request.status !== "pending" ? (
                    <View style={{ marginTop: SPACE.x4, paddingTop: SPACE.x3, borderTopWidth: 1, borderTopColor: colors.divider }}>
                      <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                        {request.status === "approved" ? "Approved" : "Reviewed"} on {formatDateTime(request.decided_at)}
                        {request.decided_by_name ? ` by ${request.decided_by_name}` : ""}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Card Actions for Pending */}
                {isPending ? (
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      padding: SPACE.x4,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      backgroundColor: colors.surfaceSunken,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Decline"
                        variant="secondary"
                        size="sm"
                        fullWidth
                        icon={XCircle}
                        onPress={() => handleDeclinePress(request)}
                        disabled={declining || approvingId === request.id}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Approve"
                        variant="primary"
                        size="sm"
                        fullWidth
                        icon={CheckCircle2}
                        loading={approvingId === request.id}
                        disabled={declining || approvingId === request.id}
                        onPress={() => void handleApprove(request)}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {/* Pagination "Load More" */}
      {hasMore && !loading ? (
        <View style={{ alignItems: "center", marginTop: 28 }}>
          <Button
            label={loadingMore ? "Loading more..." : "Load more requests"}
            variant="secondary"
            size="sm"
            onPress={() => void loadQueue(true)}
            loading={loadingMore}
            disabled={loadingMore}
          />
        </View>
      ) : null}

      {/* Reason Dialog for Decline */}
      <ActionDialog
        visible={showDeclineModal}
        title="Decline verification request"
        description={`Provide a reason for declining ${
          selectedRequest?.full_name || "this student"
        }'s verification request. The student will see this note and can resubmit with corrected information.`}
        confirmLabel="Decline Request"
        destructive={true}
        showReason={true}
        busy={declining}
        onCancel={() => {
          if (!declining) {
            setShowDeclineModal(false);
            setSelectedRequest(null);
          }
        }}
        onConfirm={async ({ reason }) => {
          await handleDeclineConfirm(reason);
        }}
      />
    </ScrollView>
  );
}
