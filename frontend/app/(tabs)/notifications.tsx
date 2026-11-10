import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";
import { apiFetch } from "../../src/lib/api";
import { RADIUS, SPACE, TYPE } from "../../src/lib/tokens";
import Button from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import Reveal from "../../src/components/ui/Reveal";
import { Skeleton } from "../../src/components/ui/Skeleton";
import EmptyState from "../../src/components/admin/EmptyState";
import StatusBadge, { badgeTone, type BadgeTone } from "../../src/components/admin/StatusBadge";

type NotificationItem = {
  id: string;
  user_id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_department?: string | null;
  type: string;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
  target_id?: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // "time ago" labels need a render-independent clock; refresh once per minute
  useEffect(() => {
    const refreshClock = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(refreshClock);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiFetch("/moderation/notifications");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.notifications || [];
        setNotifications(list);
        setUnreadCount(
          typeof data.unread === "number"
            ? data.unread
            : list.filter((n: NotificationItem) => !n.is_read).length
        );
      } else {
        // Fallback: If unauthenticated or no moderation records yet
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.warn("Failed to fetch notifications from backend:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Canonical fetch-on-mount: all state updates happen after await, and the
    // ignore flag makes unmounting safe. onRefresh reuses fetchNotifications.
    let ignore = false;
    (async () => {
      try {
        const res = await apiFetch("/moderation/notifications");
        if (ignore) return;
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.notifications || [];
          setNotifications(list);
          setUnreadCount(
            typeof data.unread === "number"
              ? data.unread
              : list.filter((n: NotificationItem) => !n.is_read).length
          );
        } else {
          // Fallback: If unauthenticated or no moderation records yet
          setNotifications([]);
          setUnreadCount(0);
        }
      } catch (err) {
        console.warn("Failed to fetch notifications from backend:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkAsRead = async (item: NotificationItem) => {
    if (!item.is_read) {
      try {
        await apiFetch(`/moderation/notifications/${item.id}/read`, {
          method: "PUT",
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.warn("Failed to mark notification read:", err);
      }
    }

    // Navigate to target if applicable
    if (item.type === "new_message" || item.type === "message_request") {
      if (item.target_id) router.push(`/messages/${item.target_id}` as any);
      else router.push("/messages" as any);
    } else if (item.type === "friend_request" || item.type === "friend_accepted") {
      router.push("/friends" as any);
    } else if (item.entity_type === "post" && item.entity_id) {
      router.push(`/post/${item.entity_id}` as any);
    } else if (item.type === "flagged_post" || item.type === "flagged_comment") {
      router.push("/(admin)/content" as any);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch("/moderation/notifications/read-all", {
        method: "POST",
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn("Failed to mark all notifications read:", err);
    }
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
              <Text style={{ ...TYPE.h1, color: colors.ink }}>Notifications</Text>
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
              onPress={handleMarkAllRead}
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
              onRefresh={onRefresh}
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
            const initials = getInitials(item.actor_name);

            return (
              <Reveal delay={Math.min(index, 8) * 35}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}. ${item.message}`}
                  onPress={() => handleMarkAsRead(item)}
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
                        {item.title}
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

                    {item.actor_department && (
                      <Text
                        style={{
                          ...TYPE.caption,
                          color: colors.textTertiary,
                          marginTop: SPACE.x1,
                          fontWeight: "500",
                        }}
                      >
                        Dept: {item.actor_department}
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
