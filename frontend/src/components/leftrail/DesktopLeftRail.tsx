import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter, useSegments } from "expo-router";
import {
  Users,
  MessageCircle,
  BookOpen,
  GraduationCap,
  Bell,
  Bookmark,
  Building2,
  Shield,
  Settings,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { isAdminRole, isDepartmentAdminRole } from "../../lib/roles";
import { setAdminAppPreview } from "../../lib/panelMode";
import { listFriendRequests } from "../../lib/messages";
import { checkAdminSessionStatus } from "../../lib/adminApi";
import Avatar from "../Avatar";
import AdminMfaPromptModal from "../admin/AdminMfaPromptModal";
import { useSettingsSidebar } from "../../contexts/SettingsSidebarContext";

interface DesktopLeftRailProps {
  unreadCount?: number;
}

export default function DesktopLeftRail({ unreadCount = 0 }: DesktopLeftRailProps) {
  const router = useRouter();
  const segments = useSegments();
  const { profile, isGuest } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { openSettingsSidebar } = useSettingsSidebar();

  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [showMoreShortcuts, setShowMoreShortcuts] = useState(false);
  const [mfaModalVisible, setMfaModalVisible] = useState(false);

  const adminUser = isAdminRole(profile?.role);
  const departmentAdmin = isDepartmentAdminRole(profile?.role);

  // Fetch incoming friend requests count for live badge
  useEffect(() => {
    if (isGuest || !profile?.id) return;
    let cancelled = false;

    listFriendRequests(20)
      .then((res) => {
        if (!cancelled && res?.incoming) {
          setFriendRequestCount(res.incoming.length);
        }
      })
      .catch(() => {
        // Non-blocking
      });

    return () => {
      cancelled = true;
    };
  }, [isGuest, profile?.id]);

  const seg = segments as string[];
  const activeSegment = seg[1] || seg[0] || "index";

  const isProfileActive = activeSegment === "profile";
  const isSearchActive = activeSegment === "search";
  const isNotificationsActive = activeSegment === "notifications";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfacePage,
          borderRightColor: colors.border,
        },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. User Profile Shortcut (Facebook style top item) */}
        {!isGuest && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View your profile"
            onPress={() => router.push("/(tabs)/profile")}
            style={({ pressed }) => [
              styles.itemRow,
              isProfileActive && { backgroundColor: colors.actionSurface },
              pressed && { backgroundColor: colors.surfaceSunken },
            ]}
          >
            <Avatar
              name={profile?.full_name ?? profile?.username}
              size={36}
            />
            <Text
              style={[
                styles.itemLabel,
                { color: colors.textPrimary, fontWeight: "700" },
              ]}
              numberOfLines={1}
            >
              {profile?.full_name || profile?.username || "Your Profile"}
            </Text>
          </Pressable>
        )}

        {/* 2. Main Navigation Shortcuts */}
        <View style={styles.sectionGroup}>
          {/* Friends */}
          {!isGuest && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Friends"
              onPress={() => router.push("/friends")}
              style={({ pressed }) => [
                styles.itemRow,
                pressed && { backgroundColor: colors.surfaceSunken },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: "#1877F2" }]}>
                <Users size={20} color="#FFFFFF" />
              </View>
              <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>
                Friends
              </Text>
              {friendRequestCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.action }]}>
                  <Text style={styles.badgeText}>
                    {friendRequestCount > 9 ? "9+" : friendRequestCount} new
                  </Text>
                </View>
              )}
            </Pressable>
          )}

          {/* Messages */}
          {!isGuest && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Messages"
              onPress={() => router.push("/messages")}
              style={({ pressed }) => [
                styles.itemRow,
                pressed && { backgroundColor: colors.surfaceSunken },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: "#06B6D4" }]}>
                <MessageCircle size={20} color="#FFFFFF" />
              </View>
              <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>
                Messages
              </Text>
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: "#EF4444" }]}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          )}

          {/* Repository (Student Theses & Projects) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Repository"
            onPress={() => router.push("/(tabs)/search")}
            style={({ pressed }) => [
              styles.itemRow,
              isSearchActive && { backgroundColor: colors.actionSurface },
              pressed && { backgroundColor: colors.surfaceSunken },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: "#10B981" }]}>
              <BookOpen size={20} color="#FFFFFF" />
            </View>
            <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>
              Repository
            </Text>
          </Pressable>

          {/* Capstones */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Capstones"
            onPress={() => router.push({ pathname: "/(tabs)/search", params: { type: "capstone" } })}
            style={({ pressed }) => [
              styles.itemRow,
              pressed && { backgroundColor: colors.surfaceSunken },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: "#F59E0B" }]}>
              <GraduationCap size={20} color="#FFFFFF" />
            </View>
            <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>
              Capstones
            </Text>
          </Pressable>

          {/* Notifications */}
          {!isGuest && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              onPress={() => router.push("/(tabs)/notifications")}
              style={({ pressed }) => [
                styles.itemRow,
                isNotificationsActive && { backgroundColor: colors.actionSurface },
                pressed && { backgroundColor: colors.surfaceSunken },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: "#8B5CF6" }]}>
                <Bell size={20} color="#FFFFFF" />
              </View>
              <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>
                Notifications
              </Text>
            </Pressable>
          )}

          {/* Admin / Moderation Console */}
          {(adminUser || departmentAdmin) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={adminUser ? "Admin Console" : "Moderation Console"}
              onPress={async () => {
                if (adminUser) {
                  try {
                    const status = await checkAdminSessionStatus();
                    if (status.isAdmin && !status.valid) {
                      setMfaModalVisible(true);
                      return;
                    }
                  } catch {
                    // Non-blocking fallback
                  }
                  setAdminAppPreview(false);
                  router.push("/(admin)");
                } else {
                  router.push("/(moderation)" as any);
                }
              }}
              style={({ pressed }) => [
                styles.itemRow,
                pressed && { backgroundColor: colors.surfaceSunken },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: "#F43F5E" }]}>
                <Shield size={20} color="#FFFFFF" />
              </View>
              <Text
                style={[
                  styles.itemLabel,
                  { color: adminUser ? colors.brand : colors.action, fontWeight: "700" },
                ]}
              >
                {adminUser ? "Admin Console" : "Moderation"}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* 3. Your Shortcuts / Campus Communities */}
        <View style={styles.sectionGroup}>
          <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
            Your Shortcuts
          </Text>

          {/* Department Community */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={profile?.department_name || "Campus Community"}
            onPress={() => router.push("/(tabs)/search")}
            style={({ pressed }) => [
              styles.itemRow,
              pressed && { backgroundColor: colors.surfaceSunken },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.surfaceSunken }]}>
              <Building2 size={20} color={colors.action} />
            </View>
            <Text style={[styles.itemLabel, { color: colors.textPrimary }]} numberOfLines={1}>
              {profile?.department_name || "Campus Community"}
            </Text>
          </Pressable>

          {/* Saved Posts */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Saved posts"
            onPress={() => router.push("/saved")}
            style={({ pressed }) => [
              styles.itemRow,
              pressed && { backgroundColor: colors.surfaceSunken },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: "rgba(139, 92, 246, 0.15)" }]}>
              <Bookmark size={20} color="#8B5CF6" />
            </View>
            <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>
              Saved Posts
            </Text>
          </Pressable>

          {/* Toggle More / Less */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowMoreShortcuts((v) => !v)}
            style={({ pressed }) => [
              styles.itemRow,
              pressed && { backgroundColor: colors.surfaceSunken },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.surfaceSunken }]}>
              {showMoreShortcuts ? (
                <ChevronUp size={20} color={colors.textSecondary} />
              ) : (
                <ChevronDown size={20} color={colors.textSecondary} />
              )}
            </View>
            <Text style={[styles.itemLabel, { color: colors.textSecondary }]}>
              {showMoreShortcuts ? "See less" : "See more"}
            </Text>
          </Pressable>

          {showMoreShortcuts && (
            <View style={{ marginTop: 2 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Settings"
                onPress={openSettingsSidebar}
                style={({ pressed }) => [
                  styles.itemRow,
                  pressed && { backgroundColor: colors.surfaceSunken },
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: colors.surfaceSunken }]}>
                  <Settings size={20} color={colors.textSecondary} />
                </View>
                <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>
                  Settings & Privacy
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Switch theme"
                onPress={() => void toggleTheme()}
                style={({ pressed }) => [
                  styles.itemRow,
                  pressed && { backgroundColor: colors.surfaceSunken },
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: colors.surfaceSunken }]}>
                  {isDark ? (
                    <Sun size={20} color="#F59E0B" />
                  ) : (
                    <Moon size={20} color="#6366F1" />
                  )}
                </View>
                <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>
                  Display & Dark Mode ({isDark ? "Dark" : "Light"})
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* 4. Facebook-Style Meta Footer */}
        <View style={styles.footerContainer}>
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            Privacy · Terms · Advertising · Cookies · More
          </Text>
          <Text style={[styles.footerCopyright, { color: colors.textTertiary }]}>
            LCCB Connect © 2026
          </Text>
        </View>
      </ScrollView>

      <AdminMfaPromptModal
        visible={mfaModalVisible}
        onClose={() => setMfaModalVisible(false)}
        onSuccess={() => {
          setMfaModalVisible(false);
          setAdminAppPreview(false);
          router.push("/(admin)");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    height: "100%",
    paddingTop: 12,
    borderRightWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingBottom: 24,
  },
  sectionGroup: {
    marginVertical: 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginVertical: 1,
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabel: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  footerContainer: {
    marginTop: 20,
    paddingHorizontal: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  footerText: {
    fontSize: 12,
    lineHeight: 18,
  },
  footerCopyright: {
    fontSize: 12,
    marginTop: 4,
  },
});

