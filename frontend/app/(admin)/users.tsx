import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { ChevronDown, ChevronUp, Trash2, Save, UserCog } from "lucide-react-native";
import { apiFetch } from "../../src/lib/api";
import { fetchDepartments, fetchCourses } from "../../src/lib/catalog";
import SelectField from "../../src/components/SelectField";
import { useAuth } from "../../src/contexts/AuthContext";
import type { Department, Course } from "../../src/types";

/**
 * Users & Roles (admin).
 *
 * Reads are a plain table; writes are rank-gated client-side to mirror the
 * server's `canManage` rule (admins only, strictly higher rank). This filtering
 * is convenience only — the backend re-checks role escalation, catalog
 * references and rank on every request. Department/course here are ACTIVE
 * catalog entries because that is exactly what the server accepts.
 */

const ROLE_RANK: Record<string, number> = {
  student: 0,
  guest: 0,
  faculty: 1,
  departmentadmin: 2,
  admin: 3,
  superadmin: 4,
};

const ROLE_OPTIONS = [
  { label: "Student", value: "student" },
  { label: "Faculty", value: "faculty" },
  { label: "Department Admin", value: "departmentAdmin" },
  { label: "Admin", value: "admin" },
  { label: "Super Admin", value: "superadmin" },
];

/** "department_admin" / "superAdmin" / "superadmin" all map to the same rank. */
const normalizeRole = (role?: string | null) =>
  (role || "").toLowerCase().replace(/[-_]/g, "");

const rankOf = (role?: string | null) => {
  const rank = ROLE_RANK[normalizeRole(role)];
  return typeof rank === "number" ? rank : -1;
};

const canonicalRole = (role?: string | null) =>
  ROLE_OPTIONS.find((o) => normalizeRole(o.value) === normalizeRole(role))?.value ||
  "student";

export default function AdminUsersScreen() {
  const { profile } = useAuth();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Row currently expanded for management, plus its draft values.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftRole, setDraftRole] = useState("student");
  const [draftDepartment, setDraftDepartment] = useState<string | null>(null);
  const [draftCourse, setDraftCourse] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const myRank = rankOf(profile?.role);
  const isAdmin = myRank >= 3; // admin or superadmin

  const loadUsers = useCallback(async () => {
    try {
      const res = await apiFetch(`/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
        setError("");
      } else {
        setError(`Could not load users (${res.status}).`);
      }
    } catch (e: any) {
      setError(e.message || "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Mount read in the effect body so state updates happen in the promise
  // callbacks (list refreshes after writes reuse `loadUsers` directly).
  useEffect(() => {
    let active = true;
    apiFetch(`/users`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load users (${res.status}).`);
        return res.json();
      })
      .then((data) => {
        if (active) setUsers(Array.isArray(data) ? data : []);
      })
      .catch((e: any) => {
        if (active) setError(e.message || "Could not load users.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Active catalog entries — the same set the server accepts for reassignment.
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    fetchDepartments()
      .then((list) => {
        if (active) setDepartments(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAdmin]);

  const canManage = (user: any) =>
    isAdmin && user.id !== profile?.id && myRank > rankOf(user.role);

  // Roles strictly below the caller's own rank; only a superadmin may hand out
  // the superadmin role itself (mirrors the server's escalation rules).
  const roleOptions = useMemo(
    () =>
      ROLE_OPTIONS.filter((o) =>
        o.value === "superadmin" ? myRank >= 4 : rankOf(o.value) < myRank
      ),
    [myRank]
  );

  const loadCourses = useCallback(async (departmentId: string | null) => {
    if (!departmentId) {
      setCourses([]);
      return;
    }
    setCoursesLoading(true);
    try {
      setCourses(await fetchCourses(departmentId));
    } catch {
      setCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  const toggleManage = (user: any) => {
    if (expandedId === user.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(user.id);
    setDraftRole(canonicalRole(user.role));
    setDraftDepartment(user.department_id || null);
    setDraftCourse(user.course_id || null);
    loadCourses(user.department_id || null);
    setError("");
  };

  const changeDepartment = (departmentId: string) => {
    setDraftDepartment(departmentId);
    setDraftCourse(null);
    loadCourses(departmentId);
  };

  const handleSave = async (user: any) => {
    const payload: Record<string, any> = {};

    if (draftRole !== canonicalRole(user.role)) {
      payload.role = draftRole;
    }

    const departmentChanged =
      !!draftDepartment && draftDepartment !== (user.department_id || null);

    if (departmentChanged) {
      if (!draftCourse) {
        setError("Select a course for the new department before saving.");
        return;
      }
      payload.department_id = draftDepartment;
      payload.course_id = draftCourse;
    } else if (draftCourse && draftCourse !== (user.course_id || null)) {
      payload.course_id = draftCourse;
    }

    if (Object.keys(payload).length === 0) {
      setExpandedId(null);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const res = await apiFetch(`/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || body.message || `Request failed (${res.status})`);
      }
      setExpandedId(null);
      await loadUsers();
    } catch (e: any) {
      setError(e.message || "Could not update the user.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (user: any) => {
    Alert.alert(
      "Delete User",
      `Permanently delete ${user.full_name || user.username || "this account"}? All of their posts, theses, comments and messages are removed. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            setError("");
            try {
              const res = await apiFetch(`/users/${user.id}`, { method: "DELETE" });
              const body = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(body.error || body.message || `Request failed (${res.status})`);
              }
              if (expandedId === user.id) setExpandedId(null);
              await loadUsers();
            } catch (e: any) {
              setError(e.message || "Could not delete the user.");
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView className="flex-1 p-8" showsVerticalScrollIndicator={false}>
      <View className="mb-8">
        <Text className="text-3xl font-black text-slate-900 tracking-tight">Users & Roles</Text>
        <Text className="text-slate-500 text-lg mt-1">
          Manage roles, department assignment, and accounts. You can only manage accounts ranked
          below you — the server enforces this too.
        </Text>
      </View>

      {error ? (
        <View className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <Text className="text-red-600 font-semibold">{error}</Text>
        </View>
      ) : null}

      <View className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm min-h-[500px]">
        {loading ? (
          <ActivityIndicator size="large" color="#1D4ED8" />
        ) : users.length === 0 ? (
          <Text className="text-slate-500 text-sm italic">No users found in database.</Text>
        ) : (
          <View>
            <View className="flex-row border-b border-slate-200 pb-3 mb-3">
              <Text className="font-bold text-slate-700 w-48">Name</Text>
              <Text className="font-bold text-slate-700 w-48">Username</Text>
              <Text className="font-bold text-slate-700 w-32">Role</Text>
              <Text className="font-bold text-slate-700 w-40">Department</Text>
              <Text className="font-bold text-slate-700 w-24">Actions</Text>
            </View>

            {users.map((u) => {
              const manageable = canManage(u);
              const expanded = expandedId === u.id;
              return (
                <View key={u.id}>
                  <View className="flex-row items-center py-3 border-b border-slate-100">
                    <Text className="text-slate-800 font-medium w-48">{u.full_name || "—"}</Text>
                    <Text className="text-slate-500 text-sm w-48">{u.username || "—"}</Text>
                    <Text className="text-blue-600 font-semibold text-xs w-32 uppercase">
                      {u.role || "student"}
                    </Text>
                    <Text className="text-slate-500 text-sm w-40">
                      {u.department_name || "—"}
                      {u.course_name ? (
                        <Text className="text-slate-400 text-xs"> · {u.course_name}</Text>
                      ) : null}
                    </Text>
                    <View className="w-24">
                      {manageable ? (
                        <TouchableOpacity
                          onPress={() => toggleManage(u)}
                          className="flex-row items-center"
                        >
                          <UserCog size={15} color="#1D4ED8" />
                          <Text className="text-[#1D4ED8] font-semibold text-xs ml-1">
                            {expanded ? "Close" : "Manage"}
                          </Text>
                          {expanded ? (
                            <ChevronUp size={14} color="#1D4ED8" />
                          ) : (
                            <ChevronDown size={14} color="#1D4ED8" />
                          )}
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {manageable && expanded && (
                    <View className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-3">
                      <View className="flex-row gap-4">
                        <View className="flex-1">
                          <Text className="text-slate-600 font-bold text-xs uppercase mb-2">
                            Role
                          </Text>
                          <SelectField
                            value={draftRole}
                            options={roleOptions}
                            onChange={setDraftRole}
                            placeholder="Select role…"
                          />
                        </View>

                        <View className="flex-1">
                          <Text className="text-slate-600 font-bold text-xs uppercase mb-2">
                            Department
                          </Text>
                          <SelectField
                            value={draftDepartment}
                            options={departments.map((d) => ({ label: d.name, value: d.id }))}
                            onChange={changeDepartment}
                            placeholder="Select department…"
                            emptyText="No active departments yet."
                          />
                        </View>

                        <View className="flex-1">
                          <Text className="text-slate-600 font-bold text-xs uppercase mb-2">
                            Course
                          </Text>
                          <SelectField
                            value={draftCourse}
                            options={courses.map((c) => ({ label: c.name, value: c.id }))}
                            onChange={setDraftCourse}
                            placeholder="Select course…"
                            disabled={!draftDepartment}
                            loading={coursesLoading}
                            emptyText="No active courses for this department."
                          />
                        </View>
                      </View>

                      <View className="flex-row justify-end items-center mt-5">
                        <TouchableOpacity
                          onPress={() => handleDelete(u)}
                          disabled={busy}
                          className="flex-row items-center px-4 py-3 rounded-xl bg-red-50 border border-red-100 mr-3"
                        >
                          <Trash2 size={15} color="#EF4444" />
                          <Text className="text-red-500 font-bold text-sm ml-2">Delete User</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleSave(u)}
                          disabled={busy}
                          className={`flex-row items-center px-5 py-3 rounded-xl ${
                            busy ? "bg-blue-300" : "bg-[#1D4ED8]"
                          }`}
                        >
                          {busy ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Save size={15} color="#FFFFFF" />
                              <Text className="text-white font-bold text-sm ml-2">Save Changes</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
