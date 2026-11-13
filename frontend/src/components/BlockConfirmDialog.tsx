import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Animated, Easing } from "react-native";
import { UserX, Check, Undo2 } from "lucide-react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { RADIUS, SPACE } from "../lib/tokens";
import { blockUser, unblockUser } from "../lib/api";

interface BlockConfirmDialogProps {
  targetUserId: string;
  targetUserName: string;
  isOpen: boolean;
  onClose: () => void;
  onBlocked?: () => void;
  onUnblocked?: () => void;
  initiallyBlocked?: boolean;
}

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACE.x5,
    paddingVertical: SPACE.x5,
    width: "85%",
    maxWidth: 360,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: SPACE.x4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: SPACE.x2,
  },
  message: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: SPACE.x5,
  },
  buttonRow: {
    flexDirection: "row",
    gap: SPACE.x3,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACE.x3,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: SPACE.x3,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textOnPrimary,
  },
  // Toast styles
  toastContainer: {
    position: "absolute",
    bottom: SPACE.x6,
    left: SPACE.x4,
    right: SPACE.x4,
    zIndex: 1000,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x3,
    borderWidth: 1,
    borderColor: colors.border,
    ...(colors.shadow ? { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 } : {}),
  },
  toastIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACE.x3,
  },
  toastContent: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  toastSubtitle: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 1,
  },
  toastAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x2,
    paddingVertical: SPACE.x1,
    borderRadius: RADIUS.sm,
  },
  toastActionText: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: SPACE.x1,
  },
});

export default function BlockConfirmDialog({
  targetUserId,
  targetUserName,
  isOpen,
  onClose,
  onBlocked,
  onUnblocked,
  initiallyBlocked = false,
}: BlockConfirmDialogProps) {
  const { colors } = useTheme();
  const toast = useToast();
  const styles = createStyles(colors);

  const [isBlocked, setIsBlocked] = useState(initiallyBlocked);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<"blocked" | "unblocked" | null>(null);
  const toastAnim = useState(new Animated.Value(0))[0];
  const prevInitiallyBlocked = useRef(initiallyBlocked);

  useEffect(() => {
    if (prevInitiallyBlocked.current !== initiallyBlocked) {
      prevInitiallyBlocked.current = initiallyBlocked;
      setIsBlocked(initiallyBlocked);
    }
  }, [initiallyBlocked]);

  const showToastMessage = (type: "blocked" | "unblocked") => {
    setToastMessage(type);
    setShowToast(true);
    Animated.timing(toastAnim, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    setTimeout(() => hideToast(), 5000);
  };

  const hideToast = () => {
    Animated.timing(toastAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setShowToast(false);
      setToastMessage(null);
    });
  };

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (isBlocked) {
        await unblockUser(targetUserId);
        setIsBlocked(false);
        toast.showToast({ message: "User unblocked.", tone: "success" });
        showToastMessage("unblocked");
        onUnblocked?.();
      } else {
        await blockUser(targetUserId);
        setIsBlocked(true);
        toast.showToast({ message: "User blocked.", tone: "error" });
        showToastMessage("blocked");
        onBlocked?.();
      }
      onClose();
    } catch (e: any) {
      if (e.code === "CANNOT_BLOCK_SELF") {
        Alert.alert("Cannot block yourself", "You cannot block your own account.");
      } else if (e.code === "ALREADY_BLOCKED") {
        Alert.alert("Already blocked", "This user is already blocked.");
      } else if (e.code === "NOT_BLOCKED") {
        Alert.alert("Not blocked", "This user is not currently blocked.");
      } else {
        Alert.alert("Error", e.message || "An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const confirmColors = isBlocked
    ? { bg: colors.success, text: colors.textOnPrimary, iconBg: colors.successSurface }
    : { bg: colors.destructive, text: colors.textOnPrimary, iconBg: colors.destructiveSurface };

  const confirmLabel = isBlocked ? "Unblock" : "Block";
  const confirmDescription = isBlocked
    ? `This will unblock ${targetUserName}. They'll be able to see your posts and interact with you again.`
    : `This will block ${targetUserName}. They won't see your posts, and you won't see theirs. You also won't be able to message each other.`;

  return (
    <>
      <TouchableOpacity style={styles.overlay} onPress={onClose} accessible={false}>
        <TouchableOpacity style={styles.container} onPress={() => {}} accessible={false}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: isBlocked ? colors.successSurface : colors.destructiveSurface },
            ]}
          >
            <UserX size={28} color={isBlocked ? colors.success : colors.destructive} />
          </View>

          <Text style={styles.title}>{isBlocked ? "Unblock User" : "Block User"}</Text>

          <Text style={styles.message}>{confirmDescription}</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                { backgroundColor: confirmColors.bg },
                loading && { opacity: 0.7 },
              ]}
              onPress={handleConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.confirmButtonText,
                { color: confirmColors.text },
              ]}>
                {loading ? "..." : confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Toast */}
      <Animated.View
        style={[
          styles.toastContainer,
          {
            opacity: toastAnim,
            transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
          },
        ]}
      >
        {showToast && toastMessage && (
          <TouchableOpacity
            style={[
              styles.toast,
              {
                backgroundColor: toastMessage === "blocked" ? colors.destructiveSurface : colors.successSurface,
                borderColor: toastMessage === "blocked" ? colors.destructive : colors.success,
              },
            ]}
            onPress={hideToast}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.toastIconWrapper,
                { backgroundColor: toastMessage === "blocked" ? colors.destructiveSurface : colors.successSurface },
              ]}
            >
              {toastMessage === "blocked" ? (
                <UserX size={16} color={colors.destructive} />
              ) : (
                <Check size={16} color={colors.success} />
              )}
            </View>
            <View style={styles.toastContent}>
              <Text
                style={[
                  styles.toastTitle,
                  { color: toastMessage === "blocked" ? colors.destructive : colors.success },
                ]}
              >
                {toastMessage === "blocked" ? "User blocked" : "User unblocked"}
              </Text>
              <Text style={styles.toastSubtitle}>
                {toastMessage === "blocked"
                  ? `${targetUserName} can no longer see your posts.`
                  : `${targetUserName} can now see your posts again.`}
              </Text>
            </View>
            <TouchableOpacity style={styles.toastAction} onPress={() => {}}>
              <Undo2 size={14} color={toastMessage === "blocked" ? colors.destructive : colors.success} />
              <Text
                style={[
                  styles.toastActionText,
                  { color: toastMessage === "blocked" ? colors.destructive : colors.success },
                ]}
              >
                Undo
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      </Animated.View>
    </>
  );
}