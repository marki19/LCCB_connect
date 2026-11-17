import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Building2,
  Calendar,
  CheckCircle2,
  GraduationCap,
  IdCard,
  Inbox,
  Mail,
  Search,
  ShieldAlert,
} from "lucide-react-native";
import { apiJson, ApiError } from "../../src/lib/api";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { isModeratorRole } from "../../src/lib/roles";
import { focusRing, RADIUS, SPACE, type ThemeTokens } from "../../src/lib/tokens";
import PageHeader from "../../src/components/admin/PageHeader";
import StatusBadge, { type BadgeTone } from "../../src/components/admin/StatusBadge";
import EmptyState from "../../src/components/admin/EmptyState";
import { CONSOLE_TEXT, consoleCard } from "../../src/components/admin/consoleTheme";
import Button from "../../src/components/ui/Button";
import Modal from "../../src/components/ui/Modal";
import TextField from "../../src/components/ui/TextField";
import { Skeleton } from "../../src/components/ui/Skeleton";

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

const STATUS_FILTERS = [
  { value: "pending", label: "Pending" },
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
] as const;

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
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
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
    student_id: raw.student_id ?? "Not set",
    department_id: raw.department_id ?? "",
    department_name: raw.department_name ?? "No department",
    course_id: raw.course_id ?? "",
    course_name: raw.course_name ?? "Not set",
    year_level: raw.year_level ?? "Not set",
    birthdate: raw.birthdate ?? undefined,
    status: (raw.status ?? "pending") as ReviewStatus,
    note: raw.note ?? raw.review_note ?? undefined,
    submitted_at: raw.submitted_at ?? raw.created_at ?? "",
    decided_at: raw.decided_at ?? raw.reviewed_at ?? undefined,
    decided_by_name: raw.decided_by_name ?? undefined,
  };
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

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
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          minHeight: 34,
          justifyContent: "center",
          paddingHorizontal: SPACE.x4,
          borderRadius: RADIUS.pill,
          borderWidth: 1,
          borderColor: active ? colors.brandSolid : colors.line,
          backgroundColor: active
            ? colors.brandSolid
            : hovered
            ? colors.panelInset
            : colors.panel,
        },
        focusRing(colors, focused),
      ]}
    >
      <Text
        style={{
          ...CONSOLE_TEXT.caption,
          fontWeight: "700",
          color: active ? colors.textOnBrandSolid : colors.inkSoft,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Detail({
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
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: SPACE.x2,
        minWidth: 216,
        flexBasis: 216,
        flexGrow: 1,
      }}
    >
      <Icon size={14} color={colors.inkFaint} style={{ marginTop: 3 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...CONSOLE_TEXT.caption, fontSize: 11.5, color: colors.inkFaint }}>
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={{ ...CONSOLE_TEXT.caption, fontWeight: "600", color: colors.ink, marginTop: 1 }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function RequestCard({
  item,
  colors,
  approving,
  declining,
  onApprove,
  onDecline,
}: {
  item: VerificationRequest;
  colors: ThemeTokens;
  approving: string | null;
  declining: boolean;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const isPending = item.status === "pending";
  const busy = declining || approving === item.id;

  return (
    <View style={{ ...consoleCard(colors), marginBottom: SPACE.x4, overflow: "hidden" }}>
      <View style={{ padding: SPACE.x5 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: SPACE.x3 }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.brandWash,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ ...CONSOLE_TEXT.strong, fontSize: 13, color: colors.brand }}>
              {initials(item.full_name)}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ ...CONSOLE_TEXT.sectionTitle, fontSize: 15.5, color: colors.ink }}
            >
              {item.full_name}
            </Text>
            <Text
              numberOfLines={1}
              style={{ ...CONSOLE_TEXT.caption, color: colors.inkFaint, marginTop: 2 }}
            >
              @{item.username || "student"} · submitted {formatDate(item.submitted_at)}
            </Text>
          </View>
          <StatusBadge label={STATUS_LABEL[item.status]} tone={STATUS_TONE[item.status]} />
        </View>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: SPACE.x4,
            marginTop: SPACE.x5,
          }}
        >
          <Detail icon={Mail} label="Email" value={item.email || "No email on file"} colors={colors} />
          <Detail icon={IdCard} label="Student ID" value={item.student_id} colors={colors} />
          <Detail icon={Building2} label="Department" value={item.department_name} colors={colors} />
          <Detail
            icon={GraduationCap}
            label="Course and year"
            value={`${item.course_name} · ${item.year_level}`}
            colors={colors}
          />
          {item.birthdate ? (
            <Detail icon={Calendar} label="Birthdate" value={item.birthdate} colors={colors} />
          ) : null}
          {!isPending && item.decided_at ? (
            <Detail
              icon={CheckCircle2}
              label="Reviewed"
              value={
                item.decided_by_name
                  ? `${formatDate(item.decided_at)} by ${item.decided_by_name}`
                  : formatDate(item.decided_at)
              }
              colors={colors}
            />
          ) : null}
        </View>

        {item.note && item.status === "declined" ? (
          <View
            style={{
              marginTop: SPACE.x4,
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: colors.accent,
              backgroundColor: colors.accentWash,
              padding: SPACE.x3,
            }}
          >
            <Text
              style={{ ...CONSOLE_TEXT.eyebrow, fontSize: 10, color: colors.accentText }}
            >
              Reviewer note
            </Text>
            <Text
              style={{
                ...CONSOLE_TEXT.caption,
                color: colors.ink,
                marginTop: SPACE.x1,
              }}
            >
              {item.note}
            </Text>
          </View>
        ) : null}
      </View>

      {isPending ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            gap: SPACE.x3,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            backgroundColor: colors.panelInset,
            paddingHorizontal: SPACE.x5,
            paddingVertical: SPACE.x3,
          }}
        >
          <Button
            label="Decline"
            variant="secondary"
            size="sm"
            onPress={onDecline}
            disabled={busy}
          />
          <Button
            label="Approve"
            size="sm"
            icon={CheckCircle2}
            loading={approving === item.id}
            disabled={busy}
            onPress={onApprove}
          />
        </View>
      ) : null}
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function AdminVerificationScreen() {
  const { profile, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const canReview = isModeratorRole(profile?.role);

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

  const cursorRef = useRef<string | null>(null);
  const loadedInitialRef = useRef(false);
  const activeFilterRef = useRef(filterStatus);

  const horizontalPadding = width < 900 ? SPACE.x5 : width < 1400 ? SPACE.x6 : SPACE.x8;

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

  // The backend filters by status, so a filter change refetches from the top.
  // The ref keeps the mount pass from firing a second initial request.
  useEffect(() => {
    if (activeFilterRef.current === filterStatus) return;
    activeFilterRef.current = filterStatus;
    cursorRef.current = null;
    void loadQueue(false);
  }, [filterStatus, loadQueue]);

  const handleRefresh = () => {
    setRefreshing(true);
    cursorRef.current = null;
    void loadQueue(false);
  };

  const handleFilterChange = (status: "all" | ReviewStatus) => {
    setFilterStatus(status);
    cursorRef.current = null;
  };

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
      cursorRef.current = null;
      void loadQueue(false);
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
      cursorRef.current = null;
      void loadQueue(false);
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
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.surfacePage }}
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: width < 900 ? SPACE.x5 : SPACE.x8,
          paddingBottom: SPACE.x16,
          alignItems: "center",
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: "100%", maxWidth: 1080 }}>
          <PageHeader
            eyebrow="Admin console"
            title="Verification"
            description="Student identity requests wait here until a reviewer approves or declines them."
          />
          <View style={{ ...consoleCard(colors) }}>
            <EmptyState
              icon={ShieldAlert}
              tone="danger"
              title="Access denied"
              body="Only department admins and above can review verification requests."
            />
          </View>
        </View>
      </ScrollView>
    );
  }

  const statusWord = filterStatus === "all" ? "" : `${filterStatus} `;
  const meta = loading
    ? "Loading the queue"
    : `${filteredRequests.length} ${statusWord}request${
        filteredRequests.length === 1 ? "" : "s"
      } shown${hasMore ? ", more available" : ""}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <FlatList
        style={{ flex: 1 }}
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          width: "100%",
          maxWidth: 1120,
          alignSelf: "center",
          paddingHorizontal: horizontalPadding,
          paddingTop: width < 900 ? SPACE.x5 : SPACE.x8,
          paddingBottom: SPACE.x16,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <View>
            <PageHeader
              eyebrow="Admin console"
              title="Verification"
              description="Confirm that a student's details match their record. Approving grants full access; declining asks them to correct the submission."
              meta={meta}
              onRefresh={handleRefresh}
              refreshing={refreshing || (loading && requests.length > 0)}
            />

            <View
              style={{
                ...consoleCard(colors),
                padding: SPACE.x4,
                marginBottom: SPACE.x5,
              }}
            >
              <View
                style={[
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.x2,
                    minHeight: 44,
                    borderRadius: RADIUS.md,
                    borderWidth: 1,
                    borderColor: searchFocused ? colors.brand : colors.line,
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
                  placeholder="Search name, student ID or email"
                  placeholderTextColor={colors.inkFaint}
                  accessibilityLabel="Search verification requests"
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  style={
                    {
                      flex: 1,
                      minHeight: 42,
                      fontSize: 14,
                      color: colors.ink,
                      outlineStyle: "none",
                    } as any
                  }
                />
              </View>

              <View
                accessibilityRole="tablist"
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: SPACE.x2,
                  marginTop: SPACE.x3,
                }}
              >
                {STATUS_FILTERS.map((status) => (
                  <FilterChip
                    key={status.value}
                    label={status.label}
                    active={filterStatus === status.value}
                    onPress={() => handleFilterChange(status.value)}
                    colors={colors}
                  />
                ))}
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <RequestCard
            item={item}
            colors={colors}
            approving={approving}
            declining={declining}
            onApprove={() => void handleApprove(item)}
            onDecline={() => handleDeclinePress(item)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: SPACE.x4 }}>
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} height={196} radius={RADIUS.lg} />
              ))}
            </View>
          ) : (
            <View style={{ ...consoleCard(colors) }}>
              <EmptyState
                icon={searchQuery.trim() ? Search : Inbox}
                tone="neutral"
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
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: SPACE.x5, alignItems: "center" }}>
              <ActivityIndicator
                accessibilityLabel="Loading more requests"
                size="small"
                color={colors.brand}
              />
            </View>
          ) : hasMore && filteredRequests.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Load more requests"
              onPress={handleLoadMore}
              style={({ pressed }) => ({
                minHeight: 42,
                alignSelf: "center",
                justifyContent: "center",
                borderRadius: RADIUS.sm,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: pressed ? colors.panelInset : colors.panel,
                paddingHorizontal: SPACE.x6,
                marginTop: SPACE.x1,
              })}
            >
              <Text style={{ ...CONSOLE_TEXT.caption, fontWeight: "700", color: colors.inkSoft }}>
                Load more requests
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      {/* Decline dialog */}
      <Modal
        visible={showDeclineModal}
        onClose={closeDecline}
        maxWidth={500}
        accessibilityLabel="Decline verification request"
      >
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...CONSOLE_TEXT.sectionTitle, fontSize: 18, color: colors.ink }}>
            Decline request
          </Text>
          <Text style={{ ...CONSOLE_TEXT.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
            Give a reason the student can act on. They will see this note and can resubmit with
            corrected information.
          </Text>
          <View style={{ marginTop: SPACE.x5 }}>
            <TextField
              label="Reason"
              value={declineNote}
              onChangeText={setDeclineNote}
              placeholder="Reason for declining"
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
          <Text style={{ ...CONSOLE_TEXT.sectionTitle, fontSize: 18, color: colors.ink }}>
            {notice?.title}
          </Text>
          <Text style={{ ...CONSOLE_TEXT.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
            {notice?.message}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: SPACE.x5 }}>
            <Button label="Got it" onPress={() => setNotice(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
