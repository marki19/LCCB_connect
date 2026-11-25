/**
 * NotificationsPopover — Bell icon panel.
 * Shows the shared notification page with "Mark all read" and a link to the
 * full notifications screen.
 */

import { useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useNotifications } from "../../contexts/NotificationsContext";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";
import { notificationActorName, notificationHref } from "../../lib/notifications";
import Avatar from "../Avatar";
import { usePopoverPosition, getArrowStyle, getBorderArrowStyle } from "../../lib/popoverPosition";

interface NotificationsPopoverProps {
  onClose: () => void;
  /** Anchor element ref for positioning */
  anchorRef?: React.RefObject<any>;
}

export default function NotificationsPopover({
  onClose,
  anchorRef,
}: NotificationsPopoverProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { notifications, unreadCount, loading, markAllRead, markRead } =
    useNotifications();

  const navigate = (href: string) => {
    onClose();
    router.push(href as any);
  };

  const handleItemPress = (notif: (typeof notifications)[number]) => {
    void markRead(notif.id);
    const href = notificationHref(notif);
    if (href) navigate(href);
  };

  // Use the new popover positioning hook (anchored to the trigger button)
  const { position, arrowPosition, arrowOffset, updatePosition } = usePopoverPosition({
    preferredPosition: "bottom-end",
    popoverWidth: 360,
    popoverHeight: 540,
    enabled: true,
  }, anchorRef);

  // Trigger position update when anchor is ready
  useEffect(() => {
    updatePosition();
  }, [updatePosition, anchorRef]);

  if (!position) {
    // Return null or a loading state while position is calculated
    return null;
  }

  const popoverStyle = {
    position: "absolute" as const,
    top: position.top,
    left: position.left,
    zIndex: 1001,
  };

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
      {/* Arrow indicator */}
      {arrowPosition && (
        <>
          <View
            style={getBorderArrowStyle(arrowPosition, arrowOffset, colors.border)}
            accessible={false}
            accessibilityElementsHidden={true}
            importantForAccessibility="no-hide-descendants"
          />
          <View
            style={getArrowStyle(arrowPosition, arrowOffset, colors.surface)}
            accessible={false}
            accessibilityElementsHidden={true}
            importantForAccessibility="no-hide-descendants"
          />
        </>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.ink }]}>Notifications</Text>
        {unreadCount > 0 && (
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
          notifications.map((notif) => {
            const isUnread = !notif.is_read;
            const actorName = notificationActorName(notif);
            const actorAvatar = notif.actor?.avatar_url;
            return (
              <Pressable
                key={notif.id}
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
                    avatarUrl={actorAvatar}
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