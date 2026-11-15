import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Users,
  ShieldOff,
  Circle,
  Sun,
  Moon,
  Smartphone,
  ChevronRight,
} from "lucide-react-native";
import Avatar, { PRESENCE_COLORS, PRESENCE_LABELS } from "../src/components/Avatar";
import { usePresence } from "../src/contexts/PresenceContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { fetchDepartments } from "../src/lib/catalog";
import { getMessagePolicy, setMessagePolicy, listBlocked, unblockUser } from "../src/lib/messages";
import type { BlockedUser } from "../src/lib/messages";
import { apiFetch } from "../src/lib/api";
import { safeBack } from "../src/lib/navigation";
import type { Department, MessagePolicy, PresenceMode } from "../src/types";
import { RADIUS, SPACE, TYPE } from "../src/lib/tokens";
import { IconButton } from "../src/components/ui/Button";
import Card from "../src/components/ui/Card";

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

function SectionLabel({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        ...TYPE.micro,
        color: colors.inkFaint,
        marginBottom: SPACE.x2,
        marginTop: SPACE.x5,
      }}
    >
      {children}
    </Text>
  );
}

function Divider({ first }: { first?: boolean }) {
  const { colors } = useTheme();
  if (first) return null;
  return <View style={{ height: 1, backgroundColor: colors.divider }} />;
}

function Radio({ active }: { active: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: active ? colors.brand : colors.borderStrong,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 1,
      }}
    >
      {active ? (
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand }} />
      ) : null}
    </View>
  );
}

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
          const users = (await usersRes.json()) as {
            id: string;
            full_name: string | null;
            username: string | null;
          }[];
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
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.x3,
          paddingHorizontal: SPACE.x4,
          minHeight: 64,
          backgroundColor: colors.panel,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        <IconButton icon={ArrowLeft} label="Back" onPress={() => safeBack("/(tabs)")} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>Preferences</Text>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>Settings</Text>
        </View>
        {saving ? <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.brand} /> : null}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.brand} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: SPACE.x10 }} showsVerticalScrollIndicator={false}>
          <View
            style={{
              width: "100%",
              maxWidth: 720,
              alignSelf: "center",
              paddingHorizontal: SPACE.x4,
            }}
          >
            {/* Appearance */}
            <SectionLabel>Appearance</SectionLabel>
            <Card padding={0}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: SPACE.x3,
                  padding: SPACE.x4,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x3, flex: 1 }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: RADIUS.md,
                      backgroundColor: colors.brandWash,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isDark ? (
                      <Moon size={16} color={colors.brand} />
                    ) : (
                      <Sun size={16} color={colors.brand} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ ...TYPE.bodyStrong, fontWeight: "600", color: colors.ink }}>
                      Dark mode
                    </Text>
                    <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 1 }}>
                      {preference === "system"
                        ? "Follows device theme"
                        : isDark
                        ? "Always dark"
                        : "Always light"}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={() => void toggleTheme()}
                  accessibilityLabel="Dark mode"
                  trackColor={{ true: colors.brand, false: colors.borderStrong }}
                  thumbColor={colors.textOnBrandSolid}
                />
              </View>

              {(
                [
                  { value: "system", label: "System default", hint: "Follow device theme", Icon: Smartphone },
                  { value: "light", label: "Light", hint: "Always light theme", Icon: Sun },
                  { value: "dark", label: "Dark", hint: "Always dark theme", Icon: Moon },
                ] as const
              ).map((opt, index) => {
                const active = preference === opt.value;
                const OptIcon = opt.Icon;
                return (
                  <View key={opt.value}>
                    <Divider first={index === 0} />
                    <Pressable
                      onPress={() => void setColorScheme(opt.value)}
                      accessibilityRole="radio"
                      aria-checked={active}
                      onFocus={() => {}}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: SPACE.x3,
                        paddingHorizontal: SPACE.x4,
                        paddingVertical: SPACE.x3,
                        backgroundColor: pressed ? colors.surfaceSunken : "transparent",
                      })}
                    >
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: RADIUS.md,
                          backgroundColor: active ? colors.brandWash : colors.surfaceSunken,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <OptIcon size={16} color={active ? colors.brand : colors.inkFaint} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{
                            ...TYPE.bodyStrong,
                            fontWeight: active ? "700" : "500",
                            color: colors.ink,
                          }}
                        >
                          {opt.label}
                        </Text>
                        <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 1 }}>
                          {opt.hint}
                        </Text>
                      </View>
                      <Radio active={active} />
                    </Pressable>
                  </View>
                );
              })}
            </Card>

            {/* Presence */}
            <SectionLabel>Presence</SectionLabel>
            <Card padding={0}>
              {PRESENCE_ORDER.map((value, index) => {
                const active = mode === value;
                return (
                  <View key={value}>
                    <Divider first={index === 0} />
                    <Pressable
                      onPress={() => void setMode(value)}
                      accessibilityRole="radio"
                      aria-checked={active}
                      onFocus={() => {}}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: SPACE.x3,
                        paddingHorizontal: SPACE.x4,
                        paddingVertical: SPACE.x3,
                        backgroundColor: pressed ? colors.surfaceSunken : "transparent",
                      })}
                    >
                      <Circle size={12} color={PRESENCE_COLORS[value]} fill={PRESENCE_COLORS[value]} />
                      <Text
                        style={{
                          flex: 1,
                          ...TYPE.bodyStrong,
                          color: colors.ink,
                          fontWeight: active ? "700" : "500",
                        }}
                      >
                        {PRESENCE_LABELS[value]}
                      </Text>
                      {active ? (
                        <Text style={{ ...TYPE.caption, color: colors.brand, fontWeight: "700" }}>
                          Active
                        </Text>
                      ) : null}
                    </Pressable>
                  </View>
                );
              })}
            </Card>

            {/* Who can message me */}
            <SectionLabel>Who can message you</SectionLabel>
            <Card padding={0}>
              {POLICY_OPTIONS.map((option, index) => {
                const active = policy === option.value;
                return (
                  <View key={option.value}>
                    <Divider first={index === 0} />
                    <Pressable
                      onPress={() => choosePolicy(option.value)}
                      accessibilityRole="radio"
                      aria-checked={active}
                      onFocus={() => {}}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: SPACE.x3,
                        paddingHorizontal: SPACE.x4,
                        paddingVertical: SPACE.x3,
                        backgroundColor: pressed ? colors.surfaceSunken : "transparent",
                      })}
                    >
                      <Radio active={active} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{
                            ...TYPE.bodyStrong,
                            fontWeight: active ? "700" : "600",
                            color: colors.ink,
                          }}
                        >
                          {option.label}
                        </Text>
                        <Text
                          style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 2, lineHeight: 16 }}
                        >
                          {option.hint}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </Card>

            {/* Department allow-list (only for "selected") */}
            {policy === "selected" && (
              <>
                <SectionLabel>Allowed departments</SectionLabel>
                <Card padding={0}>
                  {departments.length === 0 ? (
                    <Text style={{ padding: SPACE.x4, ...TYPE.caption, color: colors.inkFaint }}>
                      No departments available.
                    </Text>
                  ) : (
                    departments.map((dept, index) => {
                      const on = selectedDepts.includes(dept.id);
                      return (
                        <View key={dept.id}>
                          <Divider first={index === 0} />
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingHorizontal: SPACE.x4,
                              paddingVertical: SPACE.x3,
                              gap: SPACE.x3,
                            }}
                          >
                            <Text
                              style={{
                                flex: 1,
                                ...TYPE.caption,
                                color: colors.ink,
                                fontWeight: on ? "700" : "500",
                              }}
                            >
                              {dept.name}
                            </Text>
                            <Switch
                              value={on}
                              onValueChange={() => toggleDept(dept.id)}
                              accessibilityLabel={`Notifications for ${dept.name}`}
                              trackColor={{ true: colors.brand, false: colors.borderStrong }}
                              thumbColor={colors.textOnBrandSolid}
                            />
                          </View>
                        </View>
                      );
                    })
                  )}
                </Card>
              </>
            )}

            {/* Friends shortcut */}
            <SectionLabel>Connections</SectionLabel>
            <Pressable
              onPress={() => router.push("/friends")}
              accessibilityRole="button"
              accessibilityLabel="Open friends and requests"
              onFocus={() => {}}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.x3,
                  backgroundColor: colors.panel,
                  borderRadius: RADIUS.xl,
                  borderWidth: 1,
                  borderColor: colors.line,
                  paddingHorizontal: SPACE.x4,
                  minHeight: 56,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: RADIUS.md,
                  backgroundColor: colors.brandWash,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Users size={17} color={colors.brand} />
              </View>
              <Text style={{ flex: 1, ...TYPE.bodyStrong, fontWeight: "600", color: colors.ink }}>
                Friends & requests
              </Text>
              <ChevronRight size={17} color={colors.inkFaint} />
            </Pressable>

            {/* Blocked */}
            <SectionLabel>Blocked users</SectionLabel>
            <Card padding={0}>
              {blocked.length === 0 ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.x2,
                    padding: SPACE.x4,
                  }}
                >
                  <ShieldOff size={16} color={colors.inkFaint} />
                  <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>No blocked users.</Text>
                </View>
              ) : (
                blocked.map((row, index) => (
                  <View key={row.blocked_id}>
                    <Divider first={index === 0} />
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: SPACE.x3,
                        paddingHorizontal: SPACE.x4,
                        paddingVertical: SPACE.x3,
                      }}
                    >
                      <Avatar name={names[row.blocked_id] || "User"} size={36} />
                      <Text
                        style={{
                          flex: 1,
                          ...TYPE.caption,
                          fontWeight: "600",
                          color: colors.ink,
                        }}
                      >
                        {names[row.blocked_id] || "User"}
                      </Text>
                      <Pressable
                        onPress={() => void handleUnblock(row.blocked_id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Unblock ${names[row.blocked_id] || "user"}`}
                        onFocus={() => {}}
                        style={({ pressed }) => ({
                          minHeight: 34,
                          justifyContent: "center",
                          paddingHorizontal: SPACE.x3,
                          borderRadius: RADIUS.pill,
                          backgroundColor: colors.brandWash,
                          opacity: pressed ? 0.8 : 1,
                        })}
                      >
                        <Text style={{ ...TYPE.caption, fontWeight: "700", color: colors.brand }}>
                          Unblock
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </Card>

            <View style={{ height: SPACE.x6 }} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
