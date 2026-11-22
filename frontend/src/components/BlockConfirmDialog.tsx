import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from "react-native";
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
  const containerRef = useRef<any>(null);
  const previouslyFocused = useRef<any>(null);

  const [isBlocked, setIsBlocked] = useState(initiallyBlocked);
  const [loading, setLoading] = useState(false);
  const prevInitiallyBlocked = useRef(initiallyBlocked);

  // Focus management for accessibility
  useEffect(() => {
    if (!isOpen) return;

    if (Platform.OS === "web") {
      const doc: any = (globalThis as any).document;
      previouslyFocused.current = doc?.activeElement ?? null;
    }

    const timeout = setTimeout(() => {
      containerRef.current?.focus?.();
    }, 50);

    return () => {
      clearTimeout(timeout);
      if (Platform.OS === "web" && previouslyFocused.current) {
        try {
          previouslyFocused.current.focus?.();
        } catch {}
      }
    };
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen || Platform.OS !== "web") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (prevInitiallyBlocked.current !== initiallyBlocked) {
      prevInitiallyBlocked.current = initiallyBlocked;
      setIsBlocked(initiallyBlocked);
    }
  }, [initiallyBlocked]);

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (isBlocked) {
        await unblockUser(targetUserId);
        setIsBlocked(false);
        toast.showToast({ message: "User unblocked.", tone: "success" });
        onUnblocked?.();
      } else {
        await blockUser(targetUserId);
        setIsBlocked(true);
        toast.showToast({ message: "User blocked.", tone: "error" });
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
    <TouchableOpacity
      style={styles.overlay}
      onPress={onClose}
      accessible={false}
      accessibilityRole="button"
      accessibilityLabel="Close block dialog"
    >
      <TouchableOpacity
        ref={containerRef}
        style={[styles.container, { elevation: 20 }]}
        onPress={() => {}}
        accessible={false}
        accessibilityViewIsModal
        accessibilityRole="dialog"
        accessibilityLabel={isBlocked ? "Unblock user confirmation" : "Block user confirmation"}
        importantForAccessibility="yes"
      >
        <View
          style={[
            styles.iconWrapper,
            { backgroundColor: isBlocked ? colors.successSurface : colors.destructiveSurface },
          ]}
          accessible={false}
          accessibilityElementsHidden={true}
          importantForAccessibility="no-hide-descendants"
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
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            accessibilityState={{ disabled: loading }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.confirmButtonText, { color: confirmColors.text }]}>
              {loading ? "..." : confirmLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}