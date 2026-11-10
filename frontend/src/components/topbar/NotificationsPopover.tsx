/**
 * NotificationsPopover — Bell icon panel.
 * Shows notification list with "Mark all read" and link to full notifications page.
 */

import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { apiJson } from "../../lib/api";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";
import Avatar from "../Avatar";
import { TOP_BAR_HEIGHT } from "./DesktopTopBar";

interface NotificationsPopoverProps {
  onClose: () => void;
  onClearUnread?: () => void;
}

export default function NotificationsPopover({ onClose, onClearUnread }: NotificationsPopoverProps) {
  const { colors } = useTheme();
  const { profile, session } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isGuest = profile?.role === "guest";

  useEffect(() => {
    if (isGuest || !session?.user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiJson<any>("/notifications?limit=20")
      .then((data) => {
        if (!cancelled) {
          const list = Array.isArray(data) ? data : (data?.notifications || []);
          setNotifications(list);
        }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isGuest, session?.user?.id]);

  const markAllRead = async () => {
    try {
      await apiJson("/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read: true })));
      onClearUnread?.();
    } catch (e) {
      console.error(e);
    }
  };

  const handleItemPress = (notif: any) => {
    if (notif.is_read === false || notif.read === false) {
      if (notif.id) {
        apiJson(`/notifications/${notif.id}/read`, { method: "PUT" }).catch(() => {});
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true, read: true } : n))
      );
    }
    const targetUrl =
      notif.target_id && notif.type?.includes("post")
        ? `/post/${notif.target_id}`
        : notif.action_url ?? "/(tabs)/notifications";
    navigate(targetUrl);
  };

  const navigate = (href: string) => {
    onClose();
    router.push(href as any);
  };

  const popoverStyle =
    Platform.OS === "web"
      ? ({
          position: "fixed" as any,
          top: TOP_BAR_HEIGHT + 8,
          right: 104,
          zIndex: 1001,
        } as any)
      : { position: "absolute" as any, top: TOP_BAR_HEIGHT + 8, right: 104, zIndex: 1001 };

  const hasUnread = notifications.some((n) => n.is_read === false || n.read === false);

  return (
    <View
      style={[
        styles.container,
        popoverStyle,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.ink }]}>Notifications</Text>
        {hasUnread && (
          <Pressable
            onPress={markAllRead}
            accessibilityLabel="Mark all notifications as read"
            style={({ pressed }) => [
              styles.markBtn,
              { backgroundColor: pressed ? colors.hoverOverlay : "transparent" },
            ]}
          >
            <Text style={[styles.markBtnText, { color: colors.brand }]}>
              Mark all read
            </Text>
          </Pressable>
        )}
      </View>

      {/* List */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.center}>
            <Text style={[TYPE.body, { color: colors.inkFaint }]}>Loading…</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.empty}>
            <Bell size={32} color={colors.inkFaint} strokeWidth={1.5} />
            <Text style={[TYPE.body, { color: colors.inkFaint, marginTop: SPACE.x2 }]}>
              No notifications yet
            </Text>
          </View>
        ) : (
          notifications.map((notif, idx) => {
            const isUnread = notif.is_read === false || notif.read === false;
            const actorName = notif.actor?.full_name ?? notif.actor?.username ?? notif.actor_name ?? notif.actor_username;
            return (
              <Pressable
                key={notif.id ?? idx}
                onPress={() => handleItemPress(notif)}
                accessibilityRole="button"
                accessibilityLabel={notif.message ?? "Notification"}
                style={({ pressed }) => [
                  styles.item,
                  isUnread && { backgroundColor: colors.primarySurface },
                  pressed && { backgroundColor: colors.hoverOverlay },
                ]}
              >
                <View style={styles.avatarWrap}>
                  <Avatar
                    name={actorName}
                    size={40}
                  />
                  {isUnread && (
                    <View
                      style={[styles.unreadDot, { backgroundColor: colors.brand }]}
                    />
                  )}
                </View>
                <View style={styles.itemText}>
                  <Text
                    style={[styles.itemMessage, { color: colors.ink }]}
                    numberOfLines={2}
                  >
                    {notif.message ?? "You have a new notification"}
                  </Text>
                  {notif.created_at && (
                    <Text style={[styles.itemTime, { color: colors.inkFaint }]}>
                      {formatWhen(notif.created_at)}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Footer */}
      <Pressable
        onPress={() => navigate("/(tabs)/notifications")}
        accessibilityRole="link"
        accessibilityLabel="See all notifications"
        style={({ pressed }) => [
          styles.footer,
          {
            borderTopColor: colors.border,
            backgroundColor: pressed ? colors.hoverOverlay : "transparent",
          },
        ]}
      >
        <Text style={[styles.footerText, { color: colors.brand }]}>
          See all notifications
        </Text>
      </Pressable>
    </View>
  );
}

function formatWhen(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: {
    width: 360,
    maxHeight: 540,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 12,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.x4,
    paddingTop: SPACE.x4,
    paddingBottom: SPACE.x2,
  },
  title: {
    ...TYPE.title,
    fontSize: 20,
  },
  markBtn: {
    paddingHorizontal: SPACE.x2,
    paddingVertical: SPACE.x1,
    borderRadius: RADIUS.md,
  },
  markBtnText: {
    ...TYPE.caption,
    fontSize: 13,
    fontWeight: "600",
  },
  list: {
    flex: 1,
  },
  center: {
    paddingVertical: SPACE.x8,
    alignItems: "center",
  },
  empty: {
    paddingVertical: SPACE.x8,
    alignItems: "center",
    gap: SPACE.x2,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.x3,
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x2,
  },
  avatarWrap: {
    position: "relative",
    flexShrink: 0,
  },
  unreadDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemText: {
    flex: 1,
    minWidth: 0,
  },
  itemMessage: {
    ...TYPE.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  itemTime: {
    ...TYPE.caption,
    fontSize: 12,
  },
  footer: {
    paddingVertical: SPACE.x3,
    alignItems: "center",
    borderTopWidth: 1,
  },
  footerText: {
    ...TYPE.caption,
    fontSize: 13,
    fontWeight: "700",
  },
});
