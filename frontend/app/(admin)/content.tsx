import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import {
  AlertTriangle,
  CheckCircle,
  EyeOff,
  Trash2,
  Filter,
  ShieldCheck,
  MessageSquare,
  FileText,
  RefreshCw,
  Flag,
} from "lucide-react-native";
import { apiFetch } from "../../src/lib/api";
import { fetchDepartments } from "../../src/lib/catalog";
import { useAuth } from "../../src/contexts/AuthContext";
import type { Department, MessageReport } from "../../src/types";

type ModerationTab = "queue" | "posts" | "comments" | "reports";

export default function AdminContentScreen() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ModerationTab>("queue");
  const [loading, setLoading] = useState(true);

  // Data state
  const [flaggedPosts, setFlaggedPosts] = useState<any[]>([]);
  const [flaggedComments, setFlaggedComments] = useState<any[]>([]);
  const [messageReports, setMessageReports] = useState<MessageReport[]>([]);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  // Reason modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<{ id: string; type: "post" | "comment" } | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Check role
  const role = (profile?.role || "").toLowerCase();
  const isDeptAdmin = role.includes("department");
  const userDeptId = profile?.department_id || null;
  const userDeptName = profile?.department_name || "";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load Moderation Queue. Scope is the catalog UUID, never a label.
      //    Department admins are scoped server-side; campus admins may filter.
      const queueUrl =
        !isDeptAdmin && departmentFilter !== "all"
          ? `/moderation/queue?department_id=${encodeURIComponent(departmentFilter)}`
          : `/moderation/queue`;

      const queueRes = await apiFetch(queueUrl);
      if (queueRes.ok) {
        const queueData = await queueRes.json();
        setFlaggedPosts(queueData.flaggedPosts || []);
        setFlaggedComments(queueData.flaggedComments || []);
        setMessageReports(queueData.messageReports || []);
      }

      // 2. Load all posts for general moderation
      const postsRes = await apiFetch(`/posts?limit=50`);
      if (postsRes.ok) {
        const postsData = await postsRes.json();
        const list = Array.isArray(postsData) ? postsData : [];
        if (isDeptAdmin) {
          // A department admin sees only their own department (or nothing if
          // they have no department assigned — fail closed).
          setAllPosts(userDeptId ? list.filter((p: any) => p.author?.department_id === userDeptId) : []);
        } else if (departmentFilter !== "all") {
          setAllPosts(list.filter((p: any) => p.author?.department_id === departmentFilter));
        } else {
          setAllPosts(list);
        }
      }
    } catch (err) {
      console.error("Failed to load moderation data:", err);
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, isDeptAdmin, userDeptId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Campus admins pick from the live catalog; department admins are fixed.
  useEffect(() => {
    if (isDeptAdmin) return;
    fetchDepartments()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, [isDeptAdmin]);

  // Actions
  const handleApprove = async (id: string, type: "post" | "comment") => {
    try {
      const endpoint = type === "post" ? `/moderation/posts/${id}` : `/moderation/comments/${id}`;
      const res = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      });
      if (res.ok) {
        loadData();
      } else {
        Alert.alert("Action Failed", "Could not approve item.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleOpenHideModal = (id: string, type: "post" | "comment") => {
    setSelectedTarget({ id, type });
    setActionReason("Violation of community and academic guidelines.");
    setModalVisible(true);
  };

  const handleConfirmHide = async () => {
    if (!selectedTarget) return;
    setSubmitting(true);
    try {
      const endpoint = selectedTarget.type === "post"
        ? `/moderation/posts/${selectedTarget.id}`
        : `/moderation/comments/${selectedTarget.id}`;

      const res = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ action: "hide", reason: actionReason }),
      });
      if (res.ok) {
        setModalVisible(false);
        setSelectedTarget(null);
        loadData();
      } else {
        Alert.alert("Action Failed", "Could not hide item.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveReport = async (id: string, action: "reviewed" | "dismissed") => {
    try {
      const res = await apiFetch(`/moderation/message-reports/${id}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        loadData();
      } else {
        Alert.alert("Action Failed", "Could not update the report.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleDelete = (id: string, type: "post" | "comment") => {
    Alert.alert(
      "Confirm Permanent Delete",
      "Are you sure you want to permanently delete this item? This action removes it directly from PostgreSQL and cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const endpoint = type === "post"
                ? `/moderation/posts/${id}`
                : `/moderation/comments/${id}`;

              const res = await apiFetch(endpoint, {
                method: "POST",
                body: JSON.stringify({ action: "delete", reason: "Permanently purged by moderator" }),
              });
              if (res.ok) {
                loadData();
              }
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  const totalFlaggedCount = flaggedPosts.length + flaggedComments.length + messageReports.length;

  return (
    <ScrollView className="flex-1 p-8 bg-[#F8FAFC]" showsVerticalScrollIndicator={false}>
      {/* Header & Department Scope Banner */}
      <View className="mb-6 flex-row justify-between items-start flex-wrap gap-4">
        <View>
          <Text className="text-3xl font-black text-slate-900 tracking-tight">Content Moderation</Text>
          <Text className="text-slate-500 text-sm mt-1">
            Review student broadcasts, comments, and AI-flagged violations in PostgreSQL.
          </Text>
        </View>

        <TouchableOpacity
          onPress={loadData}
          className="flex-row items-center bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm"
        >
          <RefreshCw size={16} color="#475569" />
          <Text className="ml-2 font-semibold text-slate-700 text-sm">Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Role Scoping Notice */}
      <View className="mb-6 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <ShieldCheck size={24} color="#4F46E5" />
          <View className="ml-3">
            <Text className="font-bold text-indigo-950 text-sm">
              Moderator Authority: <Text className="uppercase">{profile?.role || "Staff"}</Text>
            </Text>
            <Text className="text-indigo-700 text-xs mt-0.5">
              {isDeptAdmin
                ? `Scoped strictly to ${userDeptName || "your assigned department"}.`
                : "Campus-wide moderation access across all departments."}
            </Text>
          </View>
        </View>

        {!isDeptAdmin && (
          <View className="flex-row gap-2 flex-wrap max-w-[60%]">
            {[{ id: "all", name: "All" }, ...departments].map((dept) => (
              <TouchableOpacity
                key={dept.id}
                onPress={() => setDepartmentFilter(dept.id)}
                className={`px-3 py-1.5 rounded-lg border ${
                  departmentFilter === dept.id
                    ? "bg-indigo-600 border-indigo-600"
                    : "bg-white border-slate-200"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    departmentFilter === dept.id ? "text-white" : "text-slate-600"
                  }`}
                >
                  {dept.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-slate-200 mb-6 gap-6">
        <TouchableOpacity
          onPress={() => setActiveTab("queue")}
          className={`pb-3 flex-row items-center border-b-2 ${
            activeTab === "queue" ? "border-red-600" : "border-transparent"
          }`}
        >
          <AlertTriangle size={18} color={activeTab === "queue" ? "#DC2626" : "#64748B"} />
          <Text
            className={`ml-2 font-bold text-sm ${
              activeTab === "queue" ? "text-red-600" : "text-slate-600"
            }`}
          >
            AI Flagged Queue
          </Text>
          {totalFlaggedCount > 0 && (
            <View className="ml-2 bg-red-600 px-2 py-0.5 rounded-full">
              <Text className="text-white text-xs font-black">{totalFlaggedCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("posts")}
          className={`pb-3 flex-row items-center border-b-2 ${
            activeTab === "posts" ? "border-indigo-600" : "border-transparent"
          }`}
        >
          <FileText size={18} color={activeTab === "posts" ? "#4F46E5" : "#64748B"} />
          <Text
            className={`ml-2 font-bold text-sm ${
              activeTab === "posts" ? "text-indigo-600" : "text-slate-600"
            }`}
          >
            All Broadcasts ({allPosts.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("comments")}
          className={`pb-3 flex-row items-center border-b-2 ${
            activeTab === "comments" ? "border-indigo-600" : "border-transparent"
          }`}
        >
          <MessageSquare size={18} color={activeTab === "comments" ? "#4F46E5" : "#64748B"} />
          <Text
            className={`ml-2 font-bold text-sm ${
              activeTab === "comments" ? "text-indigo-600" : "text-slate-600"
            }`}
          >
            Foul Comments ({flaggedComments.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("reports")}
          className={`pb-3 flex-row items-center border-b-2 ${
            activeTab === "reports" ? "border-rose-600" : "border-transparent"
          }`}
        >
          <Flag size={18} color={activeTab === "reports" ? "#E11D48" : "#64748B"} />
          <Text
            className={`ml-2 font-bold text-sm ${
              activeTab === "reports" ? "text-rose-600" : "text-slate-600"
            }`}
          >
            Reported Messages ({messageReports.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Container */}
      <View className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[450px]">
        {loading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text className="mt-3 text-slate-500 text-sm">Scanning database for moderation items...</Text>
          </View>
        ) : activeTab === "queue" ? (
          // TAB 1: AI FLAGGED QUEUE
          totalFlaggedCount === 0 ? (
            <View className="py-20 items-center justify-center">
              <CheckCircle size={48} color="#10B981" />
              <Text className="text-lg font-bold text-slate-800 mt-4">All Clear!</Text>
              <Text className="text-slate-500 text-sm mt-1">No AI-flagged violations in your department.</Text>
            </View>
          ) : (
            <View>
              {flaggedPosts.map((p) => (
                <View
                  key={p.id}
                  className="mb-4 p-4 rounded-xl border border-red-200 bg-red-50/40 flex-row justify-between items-start flex-wrap gap-4"
                >
                  <View className="flex-1 min-w-[280px]">
                    <View className="flex-row items-center gap-2 mb-1">
                      <View className="bg-red-600 px-2.5 py-0.5 rounded-full flex-row items-center">
                        <AlertTriangle size={12} color="#FFFFFF" />
                        <Text className="text-white text-xs font-black ml-1 uppercase">AI Flagged Post</Text>
                      </View>
                      <Text className="text-xs text-slate-500 font-semibold">
                        {p.author?.department_name || "—"} • {p.author?.full_name || p.author?.username}
                      </Text>
                    </View>

                    <Text className="font-bold text-slate-900 text-base mt-1">
                      {p.title || "Broadcast Post"}
                    </Text>
                    <Text className="text-slate-700 text-sm mt-1">{p.content}</Text>

                    {p.moderation_reason && (
                      <View className="mt-2.5 p-2.5 bg-red-100 rounded-lg border border-red-200">
                        <Text className="text-red-900 text-xs font-semibold">
                          Reason: {p.moderation_reason}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Action Buttons */}
                  <View className="flex-row gap-2 self-center">
                    <TouchableOpacity
                      onPress={() => handleApprove(p.id, "post")}
                      className="px-3 py-2 bg-emerald-600 rounded-xl flex-row items-center"
                    >
                      <CheckCircle size={15} color="#FFFFFF" />
                      <Text className="text-white text-xs font-bold ml-1.5">Approve</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleOpenHideModal(p.id, "post")}
                      className="px-3 py-2 bg-amber-500 rounded-xl flex-row items-center"
                    >
                      <EyeOff size={15} color="#FFFFFF" />
                      <Text className="text-white text-xs font-bold ml-1.5">Hide</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDelete(p.id, "post")}
                      className="px-3 py-2 bg-rose-600 rounded-xl flex-row items-center"
                    >
                      <Trash2 size={15} color="#FFFFFF" />
                      <Text className="text-white text-xs font-bold ml-1.5">Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {flaggedComments.map((c) => (
                <View
                  key={c.id}
                  className="mb-4 p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex-row justify-between items-start flex-wrap gap-4"
                >
                  <View className="flex-1 min-w-[280px]">
                    <View className="flex-row items-center gap-2 mb-1">
                      <View className="bg-amber-600 px-2.5 py-0.5 rounded-full flex-row items-center">
                        <MessageSquare size={12} color="#FFFFFF" />
                        <Text className="text-white text-xs font-black ml-1 uppercase">Foul Comment</Text>
                      </View>
                      <Text className="text-xs text-slate-500 font-semibold">
                        On: &quot;{c.post_title || "Discussion"}&quot; • by {c.author?.full_name || c.author?.username}
                      </Text>
                    </View>

                    <Text className="text-slate-800 text-sm mt-1 italic">&quot;{c.content}&quot;</Text>

                    {c.moderation_reason && (
                      <View className="mt-2 p-2 bg-amber-100 rounded-lg">
                        <Text className="text-amber-900 text-xs font-semibold">
                          Reason: {c.moderation_reason}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="flex-row gap-2 self-center">
                    <TouchableOpacity
                      onPress={() => handleApprove(c.id, "comment")}
                      className="px-3 py-2 bg-emerald-600 rounded-xl flex-row items-center"
                    >
                      <CheckCircle size={15} color="#FFFFFF" />
                      <Text className="text-white text-xs font-bold ml-1.5">Approve</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleOpenHideModal(c.id, "comment")}
                      className="px-3 py-2 bg-amber-500 rounded-xl flex-row items-center"
                    >
                      <EyeOff size={15} color="#FFFFFF" />
                      <Text className="text-white text-xs font-bold ml-1.5">Hide</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDelete(c.id, "comment")}
                      className="px-3 py-2 bg-rose-600 rounded-xl flex-row items-center"
                    >
                      <Trash2 size={15} color="#FFFFFF" />
                      <Text className="text-white text-xs font-bold ml-1.5">Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : activeTab === "posts" ? (
          // TAB 2: ALL POSTS
          allPosts.length === 0 ? (
            <Text className="text-slate-500 text-sm italic">No posts found.</Text>
          ) : (
            <View>
              <View className="flex-row border-b border-slate-200 pb-3 mb-3">
                <Text className="w-24 font-bold text-slate-700 text-xs uppercase">Status</Text>
                <Text className="w-48 font-bold text-slate-700 text-xs uppercase">Author</Text>
                <Text className="flex-1 font-bold text-slate-700 text-xs uppercase">Title / Content</Text>
                <Text className="w-44 text-right font-bold text-slate-700 text-xs uppercase">Actions</Text>
              </View>
              {allPosts.map((p) => {
                const isHidden = p.moderation_status === "hidden";
                const isFlagged = p.moderation_status === "flagged";
                return (
                  <View key={p.id} className="flex-row items-center py-3 border-b border-slate-100">
                    <View className="w-24">
                      <Text
                        className={`text-xs font-bold uppercase ${
                          isHidden ? "text-slate-400" : isFlagged ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {p.moderation_status || "approved"}
                      </Text>
                    </View>
                    <View className="w-48">
                      <Text className="text-slate-900 font-semibold text-sm">
                        {p.author?.full_name || p.author?.username || "—"}
                      </Text>
                      <Text className="text-slate-400 text-xs">{p.author?.department_name || "—"}</Text>
                    </View>
                    <Text numberOfLines={1} className="flex-1 text-slate-700 text-sm pr-4">
                      {p.title || p.content}
                    </Text>
                    <View className="w-44 flex-row justify-end gap-2">
                      <TouchableOpacity
                        onPress={() => handleOpenHideModal(p.id, "post")}
                        className="px-2.5 py-1.5 bg-amber-50 rounded-lg border border-amber-200"
                      >
                        <Text className="text-amber-800 text-xs font-bold">
                          {isHidden ? "Edit Reason" : "Hide"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(p.id, "post")}
                        className="px-2.5 py-1.5 bg-rose-50 rounded-lg border border-rose-200"
                      >
                        <Trash2 size={14} color="#E11D48" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )
        ) : activeTab === "reports" ? (
          // TAB 4: REPORTED MESSAGES (Messaging_plan.md §7)
          messageReports.length === 0 ? (
            <View className="py-20 items-center justify-center">
              <CheckCircle size={48} color="#10B981" />
              <Text className="text-lg font-bold text-slate-800 mt-4">No reported messages</Text>
              <Text className="text-slate-500 text-sm mt-1">
                Direct messages reported by students will appear here.
              </Text>
            </View>
          ) : (
            <View>
              {messageReports.map((r) => (
                <View
                  key={r.id}
                  className="mb-4 p-4 rounded-xl border border-rose-200 bg-rose-50/40 flex-row justify-between items-start flex-wrap gap-4"
                >
                  <View className="flex-1 min-w-[280px]">
                    <View className="flex-row items-center gap-2 mb-1">
                      <View className="bg-rose-600 px-2.5 py-0.5 rounded-full flex-row items-center">
                        <Flag size={12} color="#FFFFFF" />
                        <Text className="text-white text-xs font-black ml-1 uppercase">Reported Message</Text>
                      </View>
                      <Text className="text-xs text-slate-500 font-semibold">
                        {r.sender?.department_name || "—"} • {r.sender?.full_name || r.sender?.username || "Unknown"}
                      </Text>
                    </View>

                    <Text className="text-slate-800 text-sm mt-1 italic">&quot;{r.message_body}&quot;</Text>

                    <Text className="text-slate-500 text-xs mt-2">
                      Reason: <Text className="font-semibold text-slate-700">{r.reason || "Not specified"}</Text>
                      {"  ·  "}Reported by {r.reporter?.full_name || r.reporter?.username || "a user"}
                    </Text>
                  </View>

                  <View className="flex-row gap-2 self-center">
                    <TouchableOpacity
                      onPress={() => handleResolveReport(r.id, "reviewed")}
                      className="px-3 py-2 bg-emerald-600 rounded-xl flex-row items-center"
                    >
                      <CheckCircle size={15} color="#FFFFFF" />
                      <Text className="text-white text-xs font-bold ml-1.5">Reviewed</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleResolveReport(r.id, "dismissed")}
                      className="px-3 py-2 bg-slate-500 rounded-xl flex-row items-center"
                    >
                      <EyeOff size={15} color="#FFFFFF" />
                      <Text className="text-white text-xs font-bold ml-1.5">Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : (
          // TAB 3: FOUL COMMENTS QUEUE
          flaggedComments.length === 0 ? (
            <View className="py-20 items-center justify-center">
              <CheckCircle size={48} color="#10B981" />
              <Text className="text-lg font-bold text-slate-800 mt-4">No Inappropriate Comments</Text>
              <Text className="text-slate-500 text-sm mt-1">All student discussion threads are clean.</Text>
            </View>
          ) : (
            <View>
              {flaggedComments.map((c) => (
                <View key={c.id} className="p-4 mb-3 border border-slate-200 rounded-xl flex-row justify-between items-center">
                  <View className="flex-1 mr-4">
                    <Text className="text-xs text-slate-400 font-bold mb-1">
                      {c.author?.full_name || c.author?.username} ({c.author?.department_name || "—"}) on &quot;{c.post_title}&quot;
                    </Text>
                    <Text className="text-slate-800 text-sm font-medium">{c.content}</Text>
                    {c.moderation_reason && (
                      <Text className="text-red-600 text-xs mt-1 font-semibold">Flag: {c.moderation_reason}</Text>
                    )}
                  </View>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => handleApprove(c.id, "comment")}
                      className="px-3 py-1.5 bg-emerald-600 rounded-lg"
                    >
                      <Text className="text-white text-xs font-bold">Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(c.id, "comment")}
                      className="px-3 py-1.5 bg-rose-600 rounded-lg"
                    >
                      <Text className="text-white text-xs font-bold">Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )
        )}
      </View>

      {/* Hide Post Reason Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <Text className="text-xl font-bold text-slate-900 mb-2">Hide Content</Text>
            <Text className="text-slate-500 text-sm mb-4">
              Enter the reason this content is being hidden. The student author will receive an in-app notice with this explanation.
            </Text>

            <TextInput
              multiline
              numberOfLines={3}
              value={actionReason}
              onChangeText={setActionReason}
              placeholder="e.g. Inappropriate language, foul remarks, or off-topic content."
              className="border border-slate-200 rounded-xl p-3 text-slate-800 text-sm mb-6 bg-slate-50"
              style={{ textAlignVertical: "top" }}
            />

            <View className="flex-row justify-end gap-3">
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200"
              >
                <Text className="font-bold text-slate-600 text-sm">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmHide}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-amber-600 flex-row items-center"
              >
                {submitting && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />}
                <Text className="font-bold text-white text-sm">Confirm Hide</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
