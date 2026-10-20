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
import { useTheme } from "../../src/contexts/ThemeContext";
import type { Department, Course } from "../../src/types";

/**
 * Admin catalog management (Messaging_plan.md §3).
 *
 * Departments and courses are admin-managed runtime data — this is where they
 * are created. There is no delete: entries are deactivated so existing
 * profile/course references stay valid.
 */
export default function AdminDepartmentsScreen() {
  const { colors } = useTheme();
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
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 26, fontWeight: "900", letterSpacing: -0.5, color: colors.textPrimary }}>
          Departments &amp; Courses
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
          These drive registration and who can message whom. Entries are deactivated, never deleted.
        </Text>
      </View>

      {error ? (
        <View
          style={{
            marginBottom: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.destructive,
            backgroundColor: colors.destructiveSurface,
            padding: 14,
          }}
        >
          <Text style={{ fontWeight: "600", color: colors.destructiveText }}>{error}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        {/* Departments */}
        <View
          style={{
            width: 380,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 24,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <Building2 color={colors.primary} size={20} />
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary, marginLeft: 8 }}>
              Departments
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            <TextInput
              style={{
                flex: 1,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                backgroundColor: colors.inputBg,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 13,
                color: colors.textPrimary,
              }}
              placeholder="Department name"
              placeholderTextColor={colors.textMuted}
              value={newDept}
              onChangeText={setNewDept}
            />
            <TextInput
              style={{
                width: 80,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                backgroundColor: colors.inputBg,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 13,
                color: colors.textPrimary,
              }}
              placeholder="Code"
              placeholderTextColor={colors.textMuted}
              value={newDeptCode}
              onChangeText={setNewDeptCode}
            />
            <TouchableOpacity
              onPress={addDepartment}
              disabled={busy}
              style={{
                borderRadius: 12,
                backgroundColor: colors.primary,
                paddingHorizontal: 14,
                alignItems: "center",
                justifyContent: "center",
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Plus color={colors.textOnPrimary} size={18} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : departments.length === 0 ? (
            <Text style={{ fontSize: 13, fontStyle: "italic", color: colors.textTertiary }}>
              No departments yet.
            </Text>
          ) : (
            departments.map((d) => (
              <TouchableOpacity
                key={d.id}
                onPress={() => {
                  setSelectedId(d.id);
                  setCourses([]);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  marginBottom: 6,
                  borderWidth: 1,
                  borderColor: selectedId === d.id ? colors.primary : colors.divider,
                  backgroundColor: selectedId === d.id ? colors.primarySurface : colors.surfaceSunken,
                  opacity: d.is_active ? 1 : 0.5,
                }}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <TextInput
                    style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}
                    defaultValue={d.name}
                    onEndEditing={(e) => renameDepartment(d, e.nativeEvent.text)}
                  />
                  {d.code ? (
                    <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>{d.code}</Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => toggleDepartment(d)} style={{ padding: 6 }}>
                  <Power color={d.is_active ? colors.success : colors.textDisabled} size={17} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Courses of the selected department */}
        <View
          style={{
            flex: 1,
            minWidth: 420,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 24,
            minHeight: 400,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <GraduationCap color={colors.primary} size={20} />
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary, marginLeft: 8 }}>
              {selected ? `Courses — ${selected.name}` : "Courses"}
            </Text>
          </View>

          {!selected ? (
            <Text style={{ fontSize: 13, fontStyle: "italic", color: colors.textTertiary }}>
              Select a department to manage its courses.
            </Text>
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                <TextInput
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.inputBorder,
                    backgroundColor: colors.inputBg,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 13,
                    color: colors.textPrimary,
                  }}
                  placeholder="Course name (e.g. BS Information Technology)"
                  placeholderTextColor={colors.textMuted}
                  value={newCourse}
                  onChangeText={setNewCourse}
                />
                <TextInput
                  style={{
                    width: 80,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.inputBorder,
                    backgroundColor: colors.inputBg,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 13,
                    color: colors.textPrimary,
                  }}
                  placeholder="Code"
                  placeholderTextColor={colors.textMuted}
                  value={newCourseCode}
                  onChangeText={setNewCourseCode}
                />
                <TouchableOpacity
                  onPress={addCourse}
                  disabled={busy}
                  style={{
                    borderRadius: 12,
                    backgroundColor: colors.primary,
                    paddingHorizontal: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  <Plus color={colors.textOnPrimary} size={18} />
                </TouchableOpacity>
              </View>

              {courses.length === 0 ? (
                <Text style={{ fontSize: 13, fontStyle: "italic", color: colors.textTertiary }}>
                  No courses yet.
                </Text>
              ) : (
                courses.map((c) => (
                  <View
                    key={c.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      marginBottom: 6,
                      borderWidth: 1,
                      borderColor: colors.divider,
                      backgroundColor: colors.surfaceSunken,
                      opacity: c.is_active ? 1 : 0.5,
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <TextInput
                        style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}
                        defaultValue={c.name}
                        onEndEditing={(e) => renameCourse(c, e.nativeEvent.text)}
                      />
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                        {c.code ? (
                          <Text style={{ fontSize: 11, color: colors.textTertiary, marginRight: 8 }}>
                            {c.code}
                          </Text>
                        ) : null}
                        {c.is_active ? <Check color={colors.success} size={12} /> : null}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => toggleCourse(c)} style={{ padding: 6 }}>
                      <Power color={c.is_active ? colors.success : colors.textDisabled} size={17} />
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

