import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
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
  Sparkles,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../src/contexts/ThemeContext";
import { apiFetch } from "../../src/lib/api";

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
  const { colors, isDark } = useTheme();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    fetchNotifications();
  }, [fetchNotifications]);

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

  const renderIcon = (type: string) => {
    switch (type) {
      case "flagged_post":
      case "flagged_comment":
        return {
          Icon: AlertTriangle,
          color: "#DC2626",
          bg: "#FEE2E2",
          badgeColor: "#EF4444",
        };
      case "post_action":
        return {
          Icon: ShieldCheck,
          color: "#D97706",
          bg: "#FEF3C7",
          badgeColor: "#F59E0B",
        };
      case "new_thesis":
        return {
          Icon: BookOpen,
          color: "#7C3AED",
          bg: "#EDE9FE",
          badgeColor: "#8B5CF6",
        };
      case "new_post":
      default:
        return {
          Icon: FileText,
          color: "#1A56DB",
          bg: "#DBEAFE",
          badgeColor: "#3B82F6",
        };
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
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
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.textPrimary }}>
            Notifications
          </Text>
          {unreadCount > 0 && (
            <View
              style={{
                marginLeft: 8,
                backgroundColor: colors.destructive,
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>
                {unreadCount}
              </Text>
            </View>
          )}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 8,
              backgroundColor: colors.actionSurface,
            }}
          >
            <CheckCheck size={15} color={colors.action} />
            <Text
              style={{
                color: colors.action,
                fontWeight: "700",
                fontSize: 13,
                marginLeft: 5,
              }}
            >
              Mark all read
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="small" color={colors.action} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.action]}
              tintColor={colors.action}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 80, paddingHorizontal: 32 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: colors.surfaceSunken,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Bell size={26} color={colors.textTertiary} />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: colors.textPrimary,
                  marginBottom: 6,
                }}
              >
                No notifications yet
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textTertiary,
                  textAlign: "center",
                  lineHeight: 18,
                }}
              >
                When classmates post updates, submit research, or moderation actions occur, you'll see them here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const { Icon, color, bg, badgeColor } = renderIcon(item.type);
            const initials = getInitials(item.actor_name);

            return (
              <TouchableOpacity
                onPress={() => handleMarkAsRead(item)}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  padding: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  backgroundColor: item.is_read ? colors.surface : (isDark ? "hsl(215, 30%, 20%)" : "#EFF6FF"),
                }}
              >
                {/* Avatar with Type Icon Badge */}
                <View style={{ position: "relative", marginRight: 12 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: bg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "700", color }}>
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
                      backgroundColor: badgeColor,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 2,
                      borderColor: colors.surface,
                    }}
                  >
                    <Icon size={10} color="#FFFFFF" />
                  </View>
                </View>

                {/* Content */}
                <View style={{ flex: 1, justifyContent: "center" }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 2,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 14,
                        fontWeight: item.is_read ? "600" : "700",
                        color: colors.textPrimary,
                        flex: 1,
                        marginRight: 6,
                      }}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: item.is_read ? colors.textTertiary : colors.action,
                        fontWeight: item.is_read ? "400" : "600",
                      }}
                    >
                      {formatTime(item.created_at)}
                    </Text>
                  </View>

                  <Text
                    numberOfLines={2}
                    style={{
                      fontSize: 13,
                      color: colors.textSecondary,
                      lineHeight: 18,
                    }}
                  >
                    {item.message}
                  </Text>

                  {item.actor_department && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.textTertiary,
                        marginTop: 4,
                        fontWeight: "500",
                      }}
                    >
                      Dept: {item.actor_department}
                    </Text>
                  )}
                </View>

                {/* Unread indicator dot */}
                {!item.is_read && (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.action,
                      marginLeft: 8,
                      alignSelf: "center",
                    }}
                  />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}