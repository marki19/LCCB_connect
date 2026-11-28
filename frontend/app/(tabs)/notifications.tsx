import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BookOpen,
  FileText,
  CheckCheck,
  AlertTriangle,
  ShieldCheck,
  Bell,
  Megaphone,
  AtSign,
  ArrowLeft,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useNotifications } from "../../src/contexts/NotificationsContext";
import { RADIUS, SPACE, TYPE } from "../../src/lib/tokens";
import {
  notificationActorName,
  notificationHref,
  notificationLabel,
} from "../../src/lib/notifications";
import Button from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import Reveal from "../../src/components/ui/Reveal";
import { Skeleton } from "../../src/components/ui/Skeleton";
import EmptyState from "../../src/components/admin/EmptyState";
import StatusBadge, { badgeTone, type BadgeTone } from "../../src/components/admin/StatusBadge";
import type { NotificationItem } from "../../src/types";

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    notifications,
    unreadCount,
    loading,
    refreshing,
    refresh,
    markAllRead,
    markRead,
  } = useNotifications();
  const [now, setNow] = useState(() => Date.now());

  // "time ago" labels need a render-independent clock; refresh once per minute
  useEffect(() => {
    const refreshClock = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(refreshClock);
  }, []);

  const handlePress = (item: NotificationItem) => {
    void markRead(item.id);
    const href = notificationHref(item);
    if (href) router.push(href as any);
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "LC";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const renderIcon = (type: string): { Icon: any; tone: BadgeTone } => {
    switch (type) {
      case "flagged_post":
      case "flagged_comment":
        return { Icon: AlertTriangle, tone: "danger" };
      case "post_action":
        return { Icon: ShieldCheck, tone: "warning" };
      case "new_thesis":
        return { Icon: BookOpen, tone: "accent" };
      case "announcement":
        return { Icon: Megaphone, tone: "brand" };
      case "mention":
        return { Icon: AtSign, tone: "brand" };
      case "new_post":
      default:
        return { Icon: FileText, tone: "brand" };
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const diffMinutes = Math.floor((now - date.getTime()) / 60000);
      if (diffMinutes < 1) return "Just now";
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString();
    } catch {
      return "";
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <View
        style={{
          width: "100%",
          maxWidth: 760,
          alignSelf: "center",
          paddingHorizontal: SPACE.x4,
          paddingTop: SPACE.x5,
          paddingBottom: SPACE.x3,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2, marginBottom: SPACE.x3 }}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/");
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surfaceSunken,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <ArrowLeft size={20} color={colors.ink} />
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: SPACE.x3,
            marginBottom: SPACE.x4,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>Inbox</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2 }}>
              <Text style={{ ...TYPE.h2, color: colors.ink }}>Notifications</Text>
              {unreadCount > 0 ? (
                <StatusBadge label={`${unreadCount} new`} tone="brand" />
              ) : null}
            </View>
            <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x1 }}>
              Replies, requests, deposits, and moderation updates.
            </Text>
          </View>

          {unreadCount > 0 ? (
            <Button
              label="Mark all read"
              variant="secondary"
              size="sm"
              icon={CheckCheck}
              onPress={() => void markAllRead()}
            />
          ) : null}
        </View>
      </View>

      {loading ? (
        <View
          style={{
            width: "100%",
            maxWidth: 760,
            alignSelf: "center",
            paddingHorizontal: SPACE.x4,
            gap: SPACE.x2,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                gap: SPACE.x3,
                backgroundColor: colors.panel,
                borderRadius: RADIUS.lg,
                borderWidth: 1,
                borderColor: colors.line,
                padding: SPACE.x4,
              }}
            >
              <Skeleton width={44} height={44} radius={22} />
              <View style={{ flex: 1, gap: SPACE.x2 }}>
                <Skeleton width="55%" height={12} radius={6} />
                <Skeleton height={11} radius={6} />
                <Skeleton width="72%" height={11} radius={6} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            width: "100%",
            maxWidth: 760,
            alignSelf: "center",
            paddingHorizontal: SPACE.x4,
            paddingBottom: SPACE.x10,
            gap: SPACE.x2,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <Card style={{ marginTop: SPACE.x4 }}>
              <EmptyState
                icon={Bell}
                tone="brand"
                title="No notifications yet"
                body="When classmates post updates, submit research, or moderation actions occur, you'll see them here."
              />
            </Card>
          }
          renderItem={({ item, index }) => {
            const { Icon, tone } = renderIcon(item.type);
            const palette = badgeTone(tone, colors);
            const actorName = notificationActorName(item);
            const initials = getInitials(actorName);

            return (
              <Reveal delay={Math.min(index, 8) * 35}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${notificationLabel(item.type)}. ${item.message}`}
                  onPress={() => handlePress(item)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    gap: SPACE.x3,
                    padding: SPACE.x4,
                    borderRadius: RADIUS.lg,
                    borderWidth: 1,
                    borderColor: item.is_read ? colors.line : colors.primarySurfaceAlt,
                    backgroundColor: item.is_read
                      ? colors.panel
                      : colors.primarySurface,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  {/* Avatar with type badge */}
                  <View style={{ position: "relative" }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: palette.bg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700", color: palette.fg }}>
                        {initials}
                      </Text>
                    </View>
                    <View
                      style={{
                        position: "absolute",
                        bottom: -2,
                        right: -2,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: palette.dot,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 2,
                        borderColor: item.is_read ? colors.panel : colors.primarySurface,
                      }}
                    >
                      <Icon size={10} color={colors.textOnPrimary} />
                    </View>
                  </View>

                  {/* Content */}
                  <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: SPACE.x2,
                        marginBottom: 2,
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          ...TYPE.bodyStrong,
                          fontWeight: item.is_read ? "600" : "700",
                          color: colors.ink,
                          flex: 1,
                        }}
                      >
                        {notificationLabel(item.type)}
                      </Text>
                      <Text
                        style={{
                          ...TYPE.caption,
                          color: item.is_read ? colors.textTertiary : colors.primary,
                          fontWeight: item.is_read ? "400" : "600",
                        }}
                      >
                        {formatTime(item.created_at)}
                      </Text>
                    </View>

                    <Text
                      numberOfLines={2}
                      style={{ ...TYPE.caption, color: colors.inkSoft, lineHeight: 18 }}
                    >
                      {item.message}
                    </Text>

                    {item.department && (
                      <Text
                        style={{
                          ...TYPE.caption,
                          color: colors.textTertiary,
                          marginTop: SPACE.x1,
                          fontWeight: "500",
                        }}
                      >
                        Dept: {item.department}
                      </Text>
                    )}
                  </View>

                  {!item.is_read && (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: colors.primary,
                        alignSelf: "center",
                      }}
                    />
                  )}
                </Pressable>
              </Reveal>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
