import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { AlertCircle, ArrowRight } from "lucide-react-native";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
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
  const { colors, isDark } = useTheme();

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
    <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 24 }}>
        <View style={{ width: "100%", maxWidth: 500, alignSelf: "center", padding: 24 }}>
          <View 
            style={{ 
              backgroundColor: colors.surface, 
              borderRadius: 28, 
              padding: 32, 
              borderWidth: 1, 
              borderColor: colors.border, 
              shadowColor: colors.shadow, 
              shadowOffset: { width: 0, height: 10 }, 
              shadowOpacity: isDark ? 0.35 : 0.08, 
              shadowRadius: 20, 
              elevation: 6 
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 28 }}>
              {/* Official Seal Logo */}
              <View 
                style={{ 
                  width: 76, 
                  height: 76, 
                  borderRadius: 38, 
                  backgroundColor: colors.actionSurfaceAlt, 
                  alignItems: "center", 
                  justifyContent: "center", 
                  marginBottom: 14,
                  borderWidth: 1.5,
                  borderColor: isDark ? "rgba(76, 132, 255, 0.3)" : "#DBEAFE",
                  padding: 6,
                }}
              >
                <Image 
                  source={require("../assets/images/logo-seal.png")} 
                  style={{ width: 56, height: 56 }} 
                  resizeMode="contain" 
                />
              </View>

              <View 
                style={{ 
                  paddingHorizontal: 12, 
                  paddingVertical: 4, 
                  borderRadius: 12, 
                  backgroundColor: isDark ? "rgba(76, 132, 255, 0.1)" : "#EBF1FF", 
                  borderWidth: 1, 
                  borderColor: isDark ? "rgba(76, 132, 255, 0.2)" : "#DBEAFE",
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary, letterSpacing: 1.2, textTransform: "uppercase" }}>
                  La Consolacion College Bacolod
                </Text>
              </View>

              <Text style={{ fontSize: 24, fontWeight: "800", color: colors.textPrimary, textAlign: "center", letterSpacing: -0.4 }}>
                Complete Your Profile
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 6, textAlign: "center", lineHeight: 18 }}>
                Choose your department and course. This connects you with faculty and peers across campus.
              </Text>
            </View>

            {error ? (
              <View 
                style={{ 
                  backgroundColor: colors.destructiveSurface, 
                  borderRadius: 12, 
                  padding: 12, 
                  flexDirection: "row", 
                  alignItems: "center", 
                  marginBottom: 18,
                  borderWidth: 1,
                  borderColor: colors.destructiveSurfaceAlt,
                }}
              >
                <AlertCircle color={colors.destructive} size={18} />
                <Text style={{ color: colors.destructiveText, fontWeight: "600", fontSize: 13, marginLeft: 10, flex: 1 }}>{error}</Text>
              </View>
            ) : null}

            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginLeft: 4 }}>
              Department
            </Text>
            <View style={{ marginBottom: 16 }}>
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

            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginLeft: 4 }}>
              Course
            </Text>
            <View style={{ marginBottom: 24 }}>
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
              activeOpacity={0.85}
              style={{
                height: 52,
                borderRadius: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: (saving || loading) ? colors.surfaceSunken : colors.primary,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.35 : 0.22,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginRight: 8 }}>
                    Save and Continue
                  </Text>
                  <ArrowRight color="#FFFFFF" size={18} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
