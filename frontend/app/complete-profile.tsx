import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { GraduationCap, AlertCircle, ArrowRight } from "lucide-react-native";
import { useAuth } from "../src/contexts/AuthContext";
import { apiFetch } from "../src/lib/api";
import { fetchDepartments, fetchCourses } from "../src/lib/catalog";
import type { Department, Course } from "../src/types";
import SelectField from "../src/components/SelectField";

/**
 * One-time profile-completion gate (Messaging_plan.md §3).
 *
 * Existing accounts registered before departments existed have no department.
 * Until they pick one they cannot message or post (the router keeps them here).
 * Department/course can be *claimed* once while unset; after this it is
 * admin-only to change.
 */
export default function CompleteProfileScreen() {
  const router = useRouter();
  const { session, refreshProfile } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDepartments()
      .then(setDepartments)
      .catch(() => setError("Could not load departments. Check your connection."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!departmentId) return;
    let active = true;
    fetchCourses(departmentId)
      .then((list) => {
        if (active) setCourses(list);
      })
      .catch(() => {
        if (active) setCourses([]);
      });
    return () => {
      active = false;
    };
  }, [departmentId]);

  const handleSave = async () => {
    if (!session?.user) return;
    if (!departmentId || !courseId) {
      setError("Select both your department and your course.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const courseName = courses.find((c) => c.id === courseId)?.name || null;
      const res = await apiFetch(`/users/${session.user.id}`, {
        method: "PUT",
        // `course` (free text) is mirrored for legacy displays; the access key
        // is `department_id`.
        body: JSON.stringify({
          department_id: departmentId,
          course_id: courseId,
          course: courseName,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Could not save your department");
      }

      await refreshProfile();
      router.replace("/(tabs)/");
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <View className="w-full max-w-lg self-center p-6">
          <View className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
            <View className="items-center mb-6">
              <View className="w-16 h-16 rounded-full bg-[#DBEAFE] items-center justify-center mb-4">
                <GraduationCap color="#1D4ED8" size={30} />
              </View>
              <Text className="text-2xl font-extrabold text-slate-900 text-center">
                Complete your profile
              </Text>
              <Text className="text-slate-500 text-sm mt-2 text-center leading-5">
                Choose your department and course. This is required to message
                classmates and appears on your profile.
              </Text>
            </View>

            {error ? (
              <View className="bg-red-50 rounded-xl p-3 flex-row items-center mb-4">
                <AlertCircle color="#EF4444" size={18} />
                <Text className="text-red-600 font-semibold ml-3 flex-1">{error}</Text>
              </View>
            ) : null}

            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
              Department
            </Text>
            <View className="mb-4">
              <SelectField
                value={departmentId}
                options={departments.map((d) => ({ label: d.name, value: d.id }))}
                onChange={(v) => {
                  setDepartmentId(v);
                  setCourseId(null);
                  setCourses([]);
                  setError("");
                }}
                placeholder={loading ? "Loading…" : "Select your department"}
                loading={loading}
              />
            </View>

            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
              Course
            </Text>
            <View className="mb-6">
              <SelectField
                value={courseId}
                options={courses.map((c) => ({ label: c.name, value: c.id }))}
                onChange={(v) => {
                  setCourseId(v);
                  setError("");
                }}
                placeholder={
                  departmentId ? "Select your course" : "Select a department first"
                }
                disabled={!departmentId || courses.length === 0}
                emptyText="No courses for this department yet"
              />
            </View>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || loading}
              activeOpacity={0.8}
              className={`h-14 rounded-2xl flex-row items-center justify-center ${
                saving || loading ? "bg-indigo-300" : "bg-[#4F46E5]"
              }`}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text className="text-white font-bold text-base mr-2">Save and continue</Text>
                  <ArrowRight color="#FFFFFF" size={20} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
