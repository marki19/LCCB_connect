import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X, Users, ShieldOff, Circle, Sun, Moon, Smartphone } from "lucide-react-native";
import Avatar, { PRESENCE_COLORS, PRESENCE_LABELS } from "../src/components/Avatar";
import { usePresence } from "../src/contexts/PresenceContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { fetchDepartments } from "../src/lib/catalog";
import { getMessagePolicy, setMessagePolicy, listBlocked, unblockUser } from "../src/lib/messages";
import type { BlockedUser } from "../src/lib/messages";
import { apiFetch } from "../src/lib/api";
import { safeBack } from "../src/lib/navigation";
import type { Department, MessagePolicy, PresenceMode } from "../src/types";

/**
 * Messaging settings (Messaging_plan.md §4, §8, §12):
 *   * presence mode,
 *   * "who can message you" policy + department allow-list,
 *   * blocked users (unblock).
 */

const POLICY_OPTIONS: { value: MessagePolicy; label: string; hint: string }[] = [
  { value: "everyone", label: "Everyone", hint: "Anyone on campus can message you directly." },
  { value: "department", label: "My department", hint: "Only people in your department." },
  { value: "selected", label: "Selected departments", hint: "Only the departments you choose below." },
  { value: "nobody", label: "Nobody", hint: "Others can only send a message request." },
];

const PRESENCE_ORDER: PresenceMode[] = ["online", "away", "busy", "dnd", "invisible"];

export default function MessagingSettings() {
  const router = useRouter();
  const { mode, setMode } = usePresence();
  const { colors, preference, setColorScheme, isDark, toggleTheme } = useTheme();

  const [policy, setPolicy] = useState<MessagePolicy>("department");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [policySetting, blockList, deptList, usersRes] = await Promise.all([
          getMessagePolicy(),
          listBlocked(),
          fetchDepartments(),
          apiFetch("/public/peers"),
        ]);
        if (cancelled) return;
        setPolicy(policySetting.message_policy);
        setSelectedDepts(policySetting.department_ids ?? []);
        setBlocked(blockList);
        setDepartments(deptList);
        if (usersRes.ok) {
          const users = (await usersRes.json()) as { id: string; full_name: string | null; username: string | null }[];
          if (cancelled) return;
          setNames(
            Object.fromEntries(users.map((u) => [u.id, u.full_name || u.username || "User"]))
          );
        }
      } catch {
        // Fall back to defaults.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistPolicy = async (next: MessagePolicy, depts: string[] = selectedDepts) => {
    setSaving(true);
    try {
      const saved = await setMessagePolicy(next, next === "selected" ? depts : undefined);
      setPolicy(saved.message_policy);
      setSelectedDepts(saved.department_ids ?? []);
    } catch {
      // Leave the local choice; the user can retry.
    } finally {
      setSaving(false);
    }
  };

  const choosePolicy = (next: MessagePolicy) => {
    setPolicy(next);
    void persistPolicy(next);
  };

  const toggleDept = (id: string) => {
    const next = selectedDepts.includes(id)
      ? selectedDepts.filter((d) => d !== id)
      : [...selectedDepts, id];
    setSelectedDepts(next);
    void persistPolicy("selected", next);
  };

  const handleUnblock = async (userId: string) => {
    try {
      await unblockUser(userId);
      setBlocked((prev) => prev.filter((b) => b.blocked_id !== userId));
    } catch {
      // Non-fatal.
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textPrimary }}>Settings</Text>
        {saving ? <ActivityIndicator size="small" color={colors.action} /> : (
          <TouchableOpacity onPress={() => safeBack("/(tabs)")} style={{ padding: 6 }}>
            <X size={22} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="small" color={colors.action} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Appearance */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textTertiary, letterSpacing: 0.6, marginBottom: 8, textTransform: "uppercase" }}>
            Appearance
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.surface,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.actionSurface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isDark ? <Moon size={16} color={colors.action} /> : <Sun size={16} color={colors.action} />}
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary }}>Dark Mode</Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>
                  {preference === "system" ? "Follows device theme" : isDark ? "Always dark" : "Always light"}
                </Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={() => void toggleTheme()}
              trackColor={{ true: colors.action, false: colors.borderStrong }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, overflow: "hidden", marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
            {([
              { value: "system", label: "System Default", hint: "Follow device theme", Icon: Smartphone },
              { value: "light", label: "Light", hint: "Always light theme", Icon: Sun },
              { value: "dark", label: "Dark", hint: "Always dark theme", Icon: Moon },
            ] as const).map((opt, index) => {
              const active = preference === opt.value;
              const OptIcon = opt.Icon;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => void setColorScheme(opt.value)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: active ? colors.actionSurface : colors.surfaceSunken,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <OptIcon size={16} color={active ? colors.action : colors.textTertiary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: active ? "700" : "500", color: colors.textPrimary }}>
                      {opt.label}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>
                      {opt.hint}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: active ? colors.action : colors.borderStrong,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {active && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.action }} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Presence */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textTertiary, letterSpacing: 0.6, marginBottom: 8, textTransform: "uppercase" }}>
            Presence
          </Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, overflow: "hidden", marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
            {PRESENCE_ORDER.map((value, index) => {
              const active = mode === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => void setMode(value)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Circle size={12} color={PRESENCE_COLORS[value]} fill={PRESENCE_COLORS[value]} />
                  <Text style={{ flex: 1, fontSize: 15, color: colors.textPrimary, marginLeft: 10, fontWeight: active ? "700" : "500" }}>
                    {PRESENCE_LABELS[value]}
                  </Text>
                  {active && <Text style={{ fontSize: 12, color: colors.action, fontWeight: "700" }}>Active</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Who can message me */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textTertiary, letterSpacing: 0.6, marginBottom: 8, textTransform: "uppercase" }}>
            Who can message you
          </Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, overflow: "hidden", marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
            {POLICY_OPTIONS.map((option, index) => {
              const active = policy === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => choosePolicy(option.value)}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: active ? colors.action : colors.borderStrong,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 1,
                    }}
                  >
                    {active && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.action }} />}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: active ? "700" : "600", color: colors.textPrimary }}>{option.label}</Text>
                    <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2, lineHeight: 16 }}>{option.hint}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Department allow-list (only for "selected") */}
          {policy === "selected" && (
            <>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textTertiary, letterSpacing: 0.6, marginBottom: 8, textTransform: "uppercase" }}>
                Allowed departments
              </Text>
              <View style={{ backgroundColor: colors.surface, borderRadius: 14, overflow: "hidden", marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
                {departments.length === 0 ? (
                  <Text style={{ padding: 14, fontSize: 13, color: colors.textTertiary }}>No departments available.</Text>
                ) : (
                  departments.map((dept, index) => {
                    const on = selectedDepts.includes(dept.id);
                    return (
                      <View
                        key={dept.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 14,
                          paddingVertical: 11,
                          borderTopWidth: index === 0 ? 0 : 1,
                          borderTopColor: colors.border,
                        }}
                      >
                        <Text style={{ flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: on ? "700" : "500" }}>
                          {dept.name}
                        </Text>
                        <Switch
                          value={on}
                          onValueChange={() => toggleDept(dept.id)}
                          trackColor={{ true: colors.action, false: colors.borderStrong }}
                          thumbColor="#FFFFFF"
                        />
                      </View>
                    );
                  })
                )}
              </View>
            </>
          )}

          {/* Friends shortcut */}
          <TouchableOpacity
            onPress={() => router.push("/friends")}
            style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}
          >
            <Users size={18} color={colors.action} />
            <Text style={{ flex: 1, marginLeft: 12, fontSize: 15, fontWeight: "600", color: colors.textPrimary }}>Friends & requests</Text>
            <Text style={{ fontSize: 13, color: colors.textTertiary }}>Open</Text>
          </TouchableOpacity>

          {/* Blocked */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textTertiary, letterSpacing: 0.6, marginBottom: 8, textTransform: "uppercase" }}>
            Blocked users
          </Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
            {blocked.length === 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center", padding: 14 }}>
                <ShieldOff size={16} color={colors.textTertiary} />
                <Text style={{ fontSize: 13, color: colors.textTertiary, marginLeft: 8 }}>No blocked users.</Text>
              </View>
            ) : (
              blocked.map((row, index) => (
                <View
                  key={row.blocked_id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Avatar name={names[row.blocked_id] || "User"} size={36} />
                  <Text style={{ flex: 1, marginLeft: 10, fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>
                    {names[row.blocked_id] || "User"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => void handleUnblock(row.blocked_id)}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.actionSurface }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.action }}>Unblock</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
