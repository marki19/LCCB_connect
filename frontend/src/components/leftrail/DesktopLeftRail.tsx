import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter, useSegments } from "expo-router";
import {
  Users,
  BookOpen,
  GraduationCap,
  Bell,
  Bookmark,
  Building2,
} from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { listFriendRequests } from "../../lib/messages";
import Avatar from "../Avatar";

export default function DesktopLeftRail() {
  const router = useRouter();
  const segments = useSegments();
  const { profile, isGuest } = useAuth();
  const { colors } = useTheme();

  const [friendRequestCount, setFriendRequestCount] = useState(0);

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
        style={styles.scroll}
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
        </View>
      </ScrollView>

      {/* Meta footer — pinned to the bottom of the rail */}
      <View style={[styles.footerContainer, { borderTopColor: colors.border }]}>
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
          Privacy · Terms · Advertising · Cookies · More
        </Text>
        <Text style={[styles.footerCopyright, { color: colors.textTertiary }]}>
          LCCB Connect © 2026
        </Text>
      </View>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingBottom: 16,
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
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
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

