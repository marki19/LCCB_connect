import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Building2, GraduationCap, Plus, Power, Check } from "lucide-react-native";
import { apiFetch } from "../../src/lib/api";
import type { Department, Course } from "../../src/types";

/**
 * Admin catalog management (Messaging_plan.md §3).
 *
 * Departments and courses are admin-managed runtime data — this is where they
 * are created. There is no delete: entries are deactivated so existing
 * profile/course references stay valid.
 */
export default function AdminDepartmentsScreen() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [newDept, setNewDept] = useState("");
  const [newDeptCode, setNewDeptCode] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");

  const adminJson = async (path: string, init: RequestInit) => {
    const res = await apiFetch(path, init);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    return body;
  };

  const loadDepartments = useCallback(async () => {
    const res = await apiFetch("/admin/departments");
    if (res.ok) {
      const list = await res.json();
      setDepartments(Array.isArray(list) ? list : []);
    }
  }, []);

  const loadCourses = useCallback(async (deptId: string) => {
    const res = await apiFetch(`/admin/courses?department_id=${deptId}`);
    setCourses(res.ok ? await res.json() : []);
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch("/admin/departments")
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => {
        if (active) setDepartments(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (active) setError("Could not load the catalog.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    apiFetch(`/admin/courses?department_id=${selectedId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => {
        if (active) setCourses(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (active) setCourses([]);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selected = departments.find((d) => d.id === selectedId) || null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const addDepartment = () =>
    run(async () => {
      if (!newDept.trim()) return;
      await adminJson("/admin/departments", {
        method: "POST",
        body: JSON.stringify({ name: newDept.trim(), code: newDeptCode.trim() || null }),
      });
      setNewDept("");
      setNewDeptCode("");
      await loadDepartments();
    });

  const toggleDepartment = (d: Department) =>
    run(async () => {
      await adminJson(`/admin/departments/${d.id}/${d.is_active ? "deactivate" : "activate"}`, {
        method: "POST",
      });
      await loadDepartments();
    });

  const renameDepartment = (d: Department, name: string) =>
    run(async () => {
      const trimmed = name.trim();
      if (!trimmed || trimmed === d.name) return;
      await adminJson(`/admin/departments/${d.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: trimmed }),
      });
      await loadDepartments();
    });

  const addCourse = () =>
    run(async () => {
      if (!selectedId || !newCourse.trim()) return;
      await adminJson("/admin/courses", {
        method: "POST",
        body: JSON.stringify({
          department_id: selectedId,
          name: newCourse.trim(),
          code: newCourseCode.trim() || null,
        }),
      });
      setNewCourse("");
      setNewCourseCode("");
      await loadCourses(selectedId);
    });

  const toggleCourse = (c: Course) =>
    run(async () => {
      await adminJson(`/admin/courses/${c.id}/${c.is_active ? "deactivate" : "activate"}`, {
        method: "POST",
      });
      if (selectedId) await loadCourses(selectedId);
    });

  const renameCourse = (c: Course, name: string) =>
    run(async () => {
      const trimmed = name.trim();
      if (!trimmed || trimmed === c.name) return;
      await adminJson(`/admin/courses/${c.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: trimmed }),
      });
      if (selectedId) await loadCourses(selectedId);
    });

  return (
    <ScrollView className="flex-1 p-8" showsVerticalScrollIndicator={false}>
      <View className="mb-6">
        <Text className="text-3xl font-black text-slate-900 tracking-tight">
          Departments &amp; Courses
        </Text>
        <Text className="text-slate-500 text-lg mt-1">
          These drive registration and who can message whom. Entries are deactivated, never deleted.
        </Text>
      </View>

      {error ? (
        <View className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <Text className="text-red-600 font-semibold">{error}</Text>
        </View>
      ) : null}

      <View className="flex-row gap-6" style={{ alignItems: "flex-start" }}>
        {/* Departments */}
        <View className="w-96 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <View className="flex-row items-center mb-4">
            <Building2 color="#1D4ED8" size={20} />
            <Text className="text-lg font-bold text-slate-800 ml-2">Departments</Text>
          </View>

          <View className="flex-row gap-2 mb-4">
            <TextInput
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
              placeholder="Department name"
              placeholderTextColor="#94A3B8"
              value={newDept}
              onChangeText={setNewDept}
            />
            <TextInput
              className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
              placeholder="Code"
              placeholderTextColor="#94A3B8"
              value={newDeptCode}
              onChangeText={setNewDeptCode}
            />
            <TouchableOpacity
              onPress={addDepartment}
              disabled={busy}
              className="bg-[#1D4ED8] rounded-xl px-4 items-center justify-center"
            >
              <Plus color="#FFFFFF" size={20} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color="#1D4ED8" />
          ) : departments.length === 0 ? (
            <Text className="text-slate-500 text-sm italic">No departments yet.</Text>
          ) : (
            departments.map((d) => (
              <TouchableOpacity
                key={d.id}
                onPress={() => {
                  setSelectedId(d.id);
                  setCourses([]);
                }}
                className={`flex-row items-center justify-between rounded-xl px-3 py-3 mb-1 border ${
                  selectedId === d.id ? "border-[#1D4ED8] bg-blue-50" : "border-transparent"
                } ${d.is_active ? "" : "opacity-50"}`}
              >
                <View className="flex-1 pr-2">
                  <TextInput
                    className="text-slate-900 font-semibold"
                    defaultValue={d.name}
                    onEndEditing={(e) => renameDepartment(d, e.nativeEvent.text)}
                  />
                  {d.code ? (
                    <Text className="text-slate-400 text-xs">{d.code}</Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => toggleDepartment(d)} className="p-2">
                  <Power color={d.is_active ? "#22C55E" : "#94A3B8"} size={18} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Courses of the selected department */}
        <View className="flex-1 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm min-h-[400px]">
          <View className="flex-row items-center mb-4">
            <GraduationCap color="#1D4ED8" size={20} />
            <Text className="text-lg font-bold text-slate-800 ml-2">
              {selected ? `Courses — ${selected.name}` : "Courses"}
            </Text>
          </View>

          {!selected ? (
            <Text className="text-slate-500 text-sm italic">
              Select a department to manage its courses.
            </Text>
          ) : (
            <>
              <View className="flex-row gap-2 mb-4">
                <TextInput
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
                  placeholder="Course name (e.g. BS Information Technology)"
                  placeholderTextColor="#94A3B8"
                  value={newCourse}
                  onChangeText={setNewCourse}
                />
                <TextInput
                  className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
                  placeholder="Code"
                  placeholderTextColor="#94A3B8"
                  value={newCourseCode}
                  onChangeText={setNewCourseCode}
                />
                <TouchableOpacity
                  onPress={addCourse}
                  disabled={busy}
                  className="bg-[#1D4ED8] rounded-xl px-4 items-center justify-center"
                >
                  <Plus color="#FFFFFF" size={20} />
                </TouchableOpacity>
              </View>

              {courses.length === 0 ? (
                <Text className="text-slate-500 text-sm italic">No courses yet.</Text>
              ) : (
                courses.map((c) => (
                  <View
                    key={c.id}
                    className={`flex-row items-center justify-between rounded-xl px-3 py-3 mb-1 ${
                      c.is_active ? "" : "opacity-50"
                    }`}
                  >
                    <View className="flex-1 pr-2">
                      <TextInput
                        className="text-slate-900 font-semibold"
                        defaultValue={c.name}
                        onEndEditing={(e) => renameCourse(c, e.nativeEvent.text)}
                      />
                      <View className="flex-row items-center">
                        {c.code ? (
                          <Text className="text-slate-400 text-xs mr-2">{c.code}</Text>
                        ) : null}
                        {c.is_active ? (
                          <Check color="#22C55E" size={12} />
                        ) : null}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => toggleCourse(c)} className="p-2">
                      <Power color={c.is_active ? "#22C55E" : "#94A3B8"} size={18} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
