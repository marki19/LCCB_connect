import { View, Text, TouchableOpacity, FlatList, Modal, ActivityIndicator, Alert, TextInput, RefreshControl } from "react-native";
import { useState, useEffect, useCallback, useRef } from "react";
import { AlertCircle, User, Mail, IdCard, Building2, GraduationCap, Calendar } from "lucide-react-native";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { apiJson, ApiError } from "../src/lib/api";
import { focusRing } from "../src/lib/tokens";

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
  status: "pending" | "approved" | "declined";
  note?: string;
  submitted_at: string;
  decided_at?: string;
  decided_by_name?: string;
}

interface QueueResponse {
  items: VerificationRequest[];
  total: number;
  page: number;
  pageSize: number;
}

export default function VerifyRequestsScreen() {
  const { profile, refreshProfile } = useAuth();
  const { colors } = useTheme();

  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "declined">("pending");

  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineNote, setDeclineNote] = useState("");
  const [declining, setDeclining] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  const isDepartmentAdmin = profile?.role === "departmentAdmin";
  const isAdminOrAbove = ["admin", "superadmin"].includes(profile?.role || "");
  const canReview = isDepartmentAdmin || isAdminOrAbove;

  const loadQueue = useCallback(async (pageNum: number = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const params = new URLSearchParams({
        page: pageNum.toString(),
        pageSize: "20",
      });
      if (searchQuery) params.append("search", searchQuery);
      if (filterStatus !== "all") params.append("status", filterStatus);

      const data = await apiJson<QueueResponse>(`/verification/queue?${params.toString()}`);
      if (append) {
        setRequests((prev) => [...prev, ...data.items]);
      } else {
        setRequests(data.items);
      }
      setHasMore(data.items.length === data.pageSize);
      setPage(data.page);
    } catch (error) {
      console.error("Failed to load verification queue:", error);
      Alert.alert("Error", "Failed to load verification requests");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, filterStatus]);

  const loadedInitialRef = useRef(false);

  useEffect(() => {
    if (!loadedInitialRef.current && canReview) {
      loadedInitialRef.current = true;
      loadQueue(1, false);
    }
  }, [canReview, loadQueue]);

  const handleRefresh = () => {
    loadQueue(1, false);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadQueue(page + 1, true);
    }
  };

  const handleApprove = async (request: VerificationRequest) => {
    setApproving(request.id);
    try {
      await apiJson(`/verification/queue/${request.id}/approve`, { method: "POST" });
      Alert.alert("Approved", "The student has been verified and now has full access.");
      await refreshProfile();
      loadQueue(1, false);
    } catch (error: any) {
      if (error instanceof ApiError) {
        Alert.alert("Error", error.message || "Failed to approve");
      } else {
        Alert.alert("Error", "Failed to approve request");
      }
    } finally {
      setApproving(null);
    }
  };

  const handleDeclinePress = (request: VerificationRequest) => {
    setSelectedRequest(request);
    setDeclineNote("");
    setShowDeclineModal(true);
  };

  const handleDeclineConfirm = async () => {
    if (!selectedRequest) return;
    if (!declineNote.trim()) {
      Alert.alert("Required", "Please provide a reason for declining");
      return;
    }

    setDeclining(true);
    try {
      await apiJson(`/verification/queue/${selectedRequest.id}/decline`, {
        method: "POST",
        body: JSON.stringify({ note: declineNote.trim() }),
      });
      Alert.alert("Declined", "The student has been notified and can resubmit.");
      await refreshProfile();
      loadQueue(1, false);
      setShowDeclineModal(false);
      setSelectedRequest(null);
    } catch (error: any) {
      if (error instanceof ApiError) {
        Alert.alert("Error", error.message || "Failed to decline");
      } else {
        Alert.alert("Error", "Failed to decline request");
      }
    } finally {
      setDeclining(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return colors.warning;
      case "approved":
        return colors.success;
      case "declined":
        return colors.destructive;
      default:
        return colors.textMuted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "approved":
        return "Approved";
      case "declined":
        return "Declined";
      default:
        return status;
    }
  };

  const renderRequest = ({ item }: { item: VerificationRequest }) => (
    <TouchableOpacity
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
      onPress={() => {}}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <View style={{ backgroundColor: colors.actionSurface, borderRadius: 12, padding: 8, marginRight: 12 }}>
            <User size={20} color={colors.action} />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textPrimary }}>{item.full_name}</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>@{item.username}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{
            backgroundColor: getStatusColor(item.status) + "20",
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderWidth: 1,
            borderColor: getStatusColor(item.status),
          }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: getStatusColor(item.status), textTransform: "uppercase" }}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Mail size={14} color={colors.textMuted} style={{ width: 20 }} />
          <Text style={{ fontSize: 13, color: colors.textMuted }}>{item.email}</Text>
        </View>
        {item.birthdate && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Calendar size={14} color={colors.textMuted} style={{ width: 20 }} />
            <Text style={{ fontSize: 13, color: colors.textMuted }}>Birthdate: {item.birthdate}</Text>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <IdCard size={14} color={colors.textMuted} style={{ width: 20 }} />
          <Text style={{ fontSize: 13, color: colors.textMuted }}>Student ID: {item.student_id}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Building2 size={14} color={colors.textMuted} style={{ width: 20 }} />
          <Text style={{ fontSize: 13, color: colors.textMuted }}>{item.department_name}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <GraduationCap size={14} color={colors.textMuted} style={{ width: 20 }} />
          <Text style={{ fontSize: 13, color: colors.textMuted }}>{item.course_name} — {item.year_level}</Text>
        </View>
        {item.note && item.status === "declined" && (
          <View style={{ marginTop: 8, padding: 10, backgroundColor: colors.warningSurface, borderRadius: 8, borderWidth: 1, borderColor: colors.warning }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.warning, marginBottom: 4 }}>Admin Note</Text>
            <Text style={{ fontSize: 12, color: colors.textPrimary }}>{item.note}</Text>
          </View>
        )}
      </View>

      {item.status === "pending" && (
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: colors.successSurfaceAlt,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.success,
            }}
            onPress={() => handleApprove(item)}
            disabled={approving === item.id}
          >
            {approving === item.id ? (
              <ActivityIndicator size="small" color={colors.success} />
            ) : (
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.success }}>Approve</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: colors.warningSurface,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.warning,
            }}
            onPress={() => handleDeclinePress(item)}
            disabled={declining}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.warning }}>Decline</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  if (!canReview) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.surfacePage, padding: 24 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 28, padding: 32, borderWidth: 1, borderColor: colors.border, width: "100%", maxWidth: 400, alignSelf: "center" }}>
          <View style={{ backgroundColor: colors.actionSurface, borderRadius: 24, padding: 12, marginBottom: 16, alignSelf: "center" }}>
            <AlertCircle size={48} color={colors.action} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.textPrimary, textAlign: "center", marginBottom: 8 }}>Access Denied</Text>
          <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: "center", lineHeight: 24 }}>
            Only department admins and above can review verification requests.
          </Text>
        </View>
      </View>
    );
  }

  const filteredRequests = requests.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      r.full_name.toLowerCase().includes(query) ||
      r.username.toLowerCase().includes(query) ||
      r.student_id.toLowerCase().includes(query) ||
      r.email.toLowerCase().includes(query)
    );
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <View style={{ padding: 24, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: colors.textPrimary }}>Review Requests</Text>
        </View>

        <View style={{ gap: 12 }}>
          <TextInput
            placeholder="Search name, ID, email..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 16,
              color: colors.textPrimary,
              borderWidth: 1,
              borderColor: colors.border,
              ...focusRing(colors, true),
            }}
            placeholderTextColor={colors.textMuted}
          />

          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["all", "pending", "approved", "declined"] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={{
                  flex: 1,
                  backgroundColor: filterStatus === status ? colors.action : colors.surface,
                  borderRadius: 12,
                  paddingVertical: 10,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: filterStatus === status ? colors.action : colors.border,
                }}
                onPress={() => {
                  setFilterStatus(status);
                  loadQueue(1, false);
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: filterStatus === status ? colors.textOnPrimary : colors.textPrimary }}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <FlatList
        data={filteredRequests}
        renderItem={renderRequest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            colors={[colors.action]}
            progressBackgroundColor={colors.surface}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !loading && filteredRequests.length === 0 ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 48 }}>
              <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 24, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                <AlertCircle size={48} color={colors.textMuted} style={{ marginBottom: 16 }} />
                <Text style={{ fontSize: 18, fontWeight: "600", color: colors.textPrimary, textAlign: "center", marginBottom: 8 }}>
                  {searchQuery || filterStatus !== "all" ? "No matches found" : "No pending requests"}
                </Text>
                <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: "center" }}>
                  {searchQuery || filterStatus !== "all"
                    ? "Try adjusting your search or filters"
                    : "All caught up! New requests will appear here."}
                </Text>
              </View>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.action} />
            </View>
          ) : undefined
        }
      />

      <Modal visible={showDeclineModal} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 28, padding: 24, maxHeight: "80%", width: "100%", maxWidth: 500 }}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: colors.textPrimary, marginBottom: 8 }}>Decline Request</Text>
            <Text style={{ fontSize: 15, color: colors.textMuted, marginBottom: 16, lineHeight: 22 }}>
              Provide a reason for declining. The student will see this note and can resubmit with corrected information.
            </Text>
            <TextInput
              multiline
              numberOfLines={4}
              placeholder="Reason for declining..."
              value={declineNote}
              onChangeText={setDeclineNote}
              style={{
                backgroundColor: colors.surfacePage,
                borderRadius: 16,
                padding: 16,
                fontSize: 15,
                color: colors.textPrimary,
                borderWidth: 1,
                borderColor: colors.border,
                ...focusRing(colors, true),
                marginBottom: 16,
              }}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  paddingVertical: 14,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                onPress={() => {
                  setShowDeclineModal(false);
                  setSelectedRequest(null);
                  setDeclineNote("");
                }}
                disabled={declining}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: colors.destructive,
                  borderRadius: 16,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
                onPress={handleDeclineConfirm}
                disabled={declining || !declineNote.trim()}
              >
                {declining ? (
                  <ActivityIndicator size="large" color={colors.textOnDanger} />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textOnDanger }}>Decline</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}