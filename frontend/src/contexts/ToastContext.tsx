import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react-native";
import { useTheme } from "./ThemeContext";
import { useAuth } from "./AuthContext";
import { onNotification, onMessage, type NotificationEvent, type MessageEvent } from "../lib/realtime";
import { presentLocalNotification } from "../lib/push";

export type ToastTone = "success" | "info" | "error" | "warning";

export interface ToastOptions {
  title?: string;
  message: string;
  tone?: ToastTone;
  icon?: React.ReactNode;
  duration?: number;
  onPress?: () => void;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [activeToast, setActiveToast] = useState<ToastOptions | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hideToast = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setActiveToast(null);
    });
  }, [anim]);

  const showToast = useCallback(
    (options: ToastOptions) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setActiveToast(options);
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 4,
        speed: 12,
      }).start();

      const duration = options.duration ?? 5000;
      if (duration > 0) {
        timeoutRef.current = setTimeout(() => {
          hideToast();
        }, duration);
      }
    },
    [anim, hideToast]
  );

  // Listen to realtime notifications from Supabase
  // Web: shows in-app floating toast banner
  // Mobile: triggers native device OS notification (heads-up / status-bar drawer)
  useEffect(() => {
    const unsubNotif = onNotification((evt: NotificationEvent) => {
      if (evt.action === "INSERT" && !evt.notification.is_read) {
        const notif = evt.notification;
        const isAnnouncement = notif.type === "announcement";
        const title = isAnnouncement ? "Campus Announcement" : "LCCB Connect";
        const body = notif.message || (isAnnouncement ? "New campus announcement" : "New notification");

        if (Platform.OS === "web") {
          // Web: In-app toast banner
          showToast({
            title: isAnnouncement ? "Campus Announcement" : undefined,
            message: body,
            tone: isAnnouncement ? "success" : "info",
            onPress: () => {
              hideToast();
              if (isAnnouncement && notif.target_id) {
                router.push(`/post/${notif.target_id}` as any);
              } else {
                router.push("/(tabs)/notifications" as any);
              }
            },
          });
        } else {
          // Mobile: Native OS notification that pops down and sits in phone drawer
          void presentLocalNotification({
            title,
            body,
            data: {
              type: notif.type,
              targetId: notif.target_id,
            },
          });
        }
      }
    });

    const unsubMsg = onMessage((evt: MessageEvent) => {
      if (Platform.OS === "web") return;
      // On mobile, pop a native notification for incoming messages from others
      if (evt.action === "INSERT" && evt.message && evt.message.sender_id !== session?.user?.id) {
        const rawBody = evt.message.body || "Sent an attachment";
        const preview = rawBody.length > 80 ? `${rawBody.slice(0, 80)}…` : rawBody;
        void presentLocalNotification({
          title: "New Message",
          body: preview,
          data: {
            conversationId: evt.message.conversation_id,
            type: "new_message",
          },
        });
      }
    });

    return () => {
      unsubNotif();
      unsubMsg();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [showToast, hideToast, router, session?.user?.id]);

  const tone = activeToast?.tone || "success";

  // Visual tokens tailored to tone & matching the banner style
  const toneStyle = {
    success: {
      border: colors.success,
      surface: colors.successSurface || "rgba(79, 211, 172, 0.12)",
      text: colors.successText || "#6FE3C0",
      defaultIcon: <CheckCircle2 size={18} color={colors.success} />,
    },
    info: {
      border: colors.primary,
      surface: colors.primarySurface || "rgba(110, 155, 255, 0.14)",
      text: colors.primary,
      defaultIcon: <Bell size={18} color={colors.primary} />,
    },
    error: {
      border: colors.destructive,
      surface: colors.destructiveSurface || "rgba(255, 139, 126, 0.12)",
      text: colors.destructiveText || "#FF9F94",
      defaultIcon: <AlertCircle size={18} color={colors.destructive} />,
    },
    warning: {
      border: colors.badgeProjectText || "#F2B21B",
      surface: colors.badgeProjectBg || "rgba(242, 178, 27, 0.14)",
      text: colors.badgeProjectText || "#F2B21B",
      defaultIcon: <AlertCircle size={18} color={colors.badgeProjectText || "#F2B21B"} />,
    },
  }[tone];

  const topOffset = Math.max(insets.top, 12) + (Platform.OS === "web" ? 12 : 6);
  const maxWidth = Math.min(640, width - 32);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {activeToast && (
        <Animated.View
          style={[
            styles.container,
            {
              top: topOffset,
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-30, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={activeToast.onPress}
            disabled={!activeToast.onPress}
            style={[
              styles.toast,
              {
                width: maxWidth,
                backgroundColor: isDark ? "#0A1726" : colors.surfaceElevated,
                borderColor: toneStyle.border,
              },
            ]}
          >
            <View style={styles.iconContainer}>
              {activeToast.icon ?? toneStyle.defaultIcon}
            </View>

            <View style={styles.content}>
              {activeToast.title ? (
                <Text
                  style={[styles.title, { color: toneStyle.text }]}
                  numberOfLines={1}
                >
                  {activeToast.title}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.message,
                  { color: activeToast.title ? colors.textPrimary : toneStyle.text },
                ]}
                numberOfLines={3}
              >
                {activeToast.message}
              </Text>
            </View>

            <TouchableOpacity
              onPress={hideToast}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeButton}
              accessibilityLabel="Dismiss notification"
            >
              <X size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 99999,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 18,
  },
  closeButton: {
    marginLeft: 12,
    marginTop: 2,
    padding: 2,
  },
});

