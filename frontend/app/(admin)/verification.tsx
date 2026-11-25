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
  Globe,
  GraduationCap,
  IdCard,
  Inbox,
  Mail,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
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
  role?: string;
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
  is_guest?: boolean;
  affiliation_type?: string;
  affiliation_name?: string;
  purpose?: string;
  location?: string;
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
  const is_guest = Boolean(
    raw.role === "guest" ||
    raw.affiliation_type ||
    raw.affiliation_name ||
    raw.purpose
  );
  return {
    id: raw.id,
    user_id: raw.user_id,
    username: raw.username ?? (email ? email.split("@")[0] : ""),
    email,
    full_name: raw.full_name ?? (is_guest ? "Guest Applicant" : "Unnamed account"),
    role: raw.role ?? (is_guest ? "guest" : "user"),
    student_id: raw.student_id ?? "—",
    department_id: raw.department_id ?? "",
    department_name: raw.department_name ?? (is_guest ? (raw.affiliation_name || "Guest Access") : "No department"),
    course_id: raw.course_id ?? "",
    course_name: raw.course_name ?? "Not set",
    year_level: raw.year_level ?? "Not set",
    birthdate: raw.birthdate ?? undefined,
    status: (raw.status ?? "pending") as ReviewStatus,
    note: raw.note ?? raw.review_note ?? undefined,
    submitted_at: raw.submitted_at ?? raw.created_at ?? "",
    decided_at: raw.decided_at ?? raw.reviewed_at ?? undefined,
    decided_by_name: raw.decided_by_name ?? undefined,
    is_guest,
    affiliation_type: raw.affiliation_type ?? undefined,
    affiliation_name: raw.affiliation_name ?? undefined,
    purpose: raw.purpose ?? undefined,
    location: raw.location ?? undefined,
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
              backgroundColor: item.is_guest ? colors.accentWash : colors.brandWash,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ ...CONSOLE_TEXT.strong, fontSize: 13, color: item.is_guest ? colors.accentText : colors.brand }}>
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
              @{item.username || (item.is_guest ? "guest" : "student")} · {item.is_guest ? "Guest access declaration" : "Campus verification"} · submitted {formatDate(item.submitted_at)}
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
          {item.is_guest ? (
            <>
              <Detail
                icon={Building2}
                label="Affiliation"
                value={`${item.affiliation_name || "Not specified"} (${item.affiliation_type || "guest"})`}
                colors={colors}
              />
              <Detail
                icon={GraduationCap}
                label="Purpose"
                value={item.purpose || "Not specified"}
                colors={colors}
              />
              {item.location ? (
                <Detail icon={Globe} label="Location" value={item.location} colors={colors} />
              ) : null}
            </>
          ) : (
            <>
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
            </>
          )}
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
  const normRole = (profile?.role || "").toLowerCase().replace(/[-_]/g, "");
  const isFullAdmin = normRole === "admin" || normRole === "superadmin";

  const [queueKind, setQueueKind] = useState<"campus" | "guest">("campus");
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
  const activeFilterRef = useRef({ filterStatus, queueKind });

  const horizontalPadding = width < 900 ? SPACE.x5 : width < 1400 ? SPACE.x6 : SPACE.x8;

  const loadQueue = useCallback(
    async (append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (queueKind === "guest") params.append("kind", "guest");
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
    [filterStatus, queueKind]
  );

  useEffect(() => {
    if (!loadedInitialRef.current && canReview) {
      loadedInitialRef.current = true;
      void loadQueue(false);
    }
  }, [canReview, loadQueue]);

  // Refetches when filter status or queue kind changes.
  useEffect(() => {
    if (
      activeFilterRef.current.filterStatus === filterStatus &&
      activeFilterRef.current.queueKind === queueKind
    ) {
      return;
    }
    activeFilterRef.current = { filterStatus, queueKind };
    cursorRef.current = null;
    void loadQueue(false);
  }, [filterStatus, queueKind, loadQueue]);

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
      const query = request.is_guest ? "?kind=guest" : "";
      await apiJson(`/verification/${request.id}/approve${query}`, {
        method: "POST",
        body: request.is_guest ? JSON.stringify({ kind: "guest" }) : undefined,
      });
      setNotice({
        title: "Request approved",
        message: request.is_guest
          ? "The guest access declaration is approved."
          : "The student is verified and now has full access.",
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
        message: "Add a short reason so the applicant knows what to correct.",
      });
      return;
    }

    setDeclining(true);
    try {
      const query = selectedRequest.is_guest ? "?kind=guest" : "";
      await apiJson(`/verification/${selectedRequest.id}/decline${query}`, {
        method: "POST",
        body: JSON.stringify({
          note,
          kind: selectedRequest.is_guest ? "guest" : undefined,
        }),
      });
      setShowDeclineModal(false);
      setSelectedRequest(null);
      setDeclineNote("");
      setNotice({
        title: "Request declined",
        message: selectedRequest.is_guest
          ? "The guest application was declined."
          : "The student has been notified and can resubmit.",
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
      return [
        request.full_name,
        request.username,
        request.student_id,
        request.email,
        request.affiliation_name,
        request.purpose,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
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
              description={
                queueKind === "guest"
                  ? "Review guest access declarations. Approving grants guest privileges; declining asks them to resubmit."
                  : "Confirm that a student's details match their record. Approving grants full access; declining asks them to correct the submission."
              }
              meta={meta}
              onRefresh={handleRefresh}
              refreshing={refreshing || (loading && requests.length > 0)}
            />

            {isFullAdmin ? (
              <View
                style={{
                  flexDirection: "row",
                  gap: SPACE.x2,
                  marginBottom: SPACE.x4,
                }}
              >
                <Pressable
                  accessibilityRole="tab"
                  accessibilityLabel="Campus Members"
                  accessibilityState={{ selected: queueKind === "campus" }}
                  onPress={() => {
                    if (queueKind !== "campus") {
                      setQueueKind("campus");
                      cursorRef.current = null;
                    }
                  }}
                  style={[
                    {
                      minHeight: 38,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: SPACE.x2,
                      paddingHorizontal: SPACE.x4,
                      borderRadius: RADIUS.md,
                      borderWidth: 1,
                      borderColor: queueKind === "campus" ? colors.brandSolid : colors.line,
                      backgroundColor: queueKind === "campus" ? colors.brandSolid : colors.panel,
                    },
                  ]}
                >
                  <Users
                    size={16}
                    color={queueKind === "campus" ? colors.textOnBrandSolid : colors.inkSoft}
                  />
                  <Text
                    style={{
                      ...CONSOLE_TEXT.caption,
                      fontWeight: "700",
                      color: queueKind === "campus" ? colors.textOnBrandSolid : colors.ink,
                    }}
                  >
                    Campus Members
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="tab"
                  accessibilityLabel="Guest Access Requests"
                  accessibilityState={{ selected: queueKind === "guest" }}
                  onPress={() => {
                    if (queueKind !== "guest") {
                      setQueueKind("guest");
                      cursorRef.current = null;
                    }
                  }}
                  style={[
                    {
                      minHeight: 38,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: SPACE.x2,
                      paddingHorizontal: SPACE.x4,
                      borderRadius: RADIUS.md,
                      borderWidth: 1,
                      borderColor: queueKind === "guest" ? colors.brandSolid : colors.line,
                      backgroundColor: queueKind === "guest" ? colors.brandSolid : colors.panel,
                    },
                  ]}
                >
                  <Globe
                    size={16}
                    color={queueKind === "guest" ? colors.textOnBrandSolid : colors.inkSoft}
                  />
                  <Text
                    style={{
                      ...CONSOLE_TEXT.caption,
                      fontWeight: "700",
                      color: queueKind === "guest" ? colors.textOnBrandSolid : colors.ink,
                    }}
                  >
                    Guest Access Requests
                  </Text>
                </Pressable>
              </View>
            ) : null}

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
                  placeholder={
                    queueKind === "guest"
                      ? "Search name, affiliation or email"
                      : "Search name, student ID or email"
                  }
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
                    ? queueKind === "guest"
                      ? "All caught up. New guest access declarations will appear here."
                      : "All caught up. New verification requests will appear here."
                    : queueKind === "guest"
                    ? "Requests will appear here once guest applicants submit their details."
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
