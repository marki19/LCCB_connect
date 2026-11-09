import { View, Text, Pressable, StyleSheet } from "react-native";
import { AlertCircle, X, RefreshCw } from "lucide-react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";

/**
 * EmailBounceBanner — shown when the current user's email has been marked as bounced
 * by the Brevo webhook (hard bounce 550). Persistent until the user dismisses or
 * triggers a re-verification flow (future enhancement).
 *
 * Placement: render near the top of a screen (e.g., Home, Profile, Settings).
 * The banner is self-contained and only renders when `profile?.email_bounced === true`.
 */
export function EmailBounceBanner({
  onDismiss,
  onRefresh,
  style,
}: {
  /** Called when user taps the dismiss (X) button */
  onDismiss?: () => void;
  /** Optional: called when user taps "Check again" — future re-verification trigger */
  onRefresh?: () => void;
  /** Additional style overrides */
  style?: any;
}) {
  const { profile } = useAuth();
  const { colors } = useTheme();

  if (!profile?.email_bounced) return null;

  const bounceReason = profile.bounce_reason ?? "Delivery failed";
  const bouncedAt = profile.bounced_at
    ? new Date(profile.bounced_at).toLocaleDateString()
    : "recently";

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.destructiveSurface,
          borderColor: colors.destructiveSurfaceAlt,
        },
        style,
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.content}>
        <AlertCircle
          color={colors.destructive}
          size={20}
          style={styles.icon}
          aria-hidden={true}
        />
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              { color: colors.destructiveText },
            ]}
          >
            Email delivery failed
          </Text>
          <Text
            style={[
              styles.message,
              { color: colors.destructiveText },
            ]}
            numberOfLines={3}
          >
            We couldn&apos;t deliver emails to your address ({profile.email}). Reason:{" "}
            {bounceReason} ({bouncedAt}). You may miss important notifications.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {onRefresh && (
          <Pressable
            onPress={onRefresh}
            accessibilityLabel="Check email status again"
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: pressed
                  ? colors.destructiveText
                  : colors.destructive,
              },
            ]}
          >
            <RefreshCw color={colors.destructiveText} size={16} />
            <Text
              style={[styles.actionText, { color: colors.destructiveText }]}
            >
              Check again
            </Text>
          </Pressable>
        )}

        {onDismiss && (
          <Pressable
            onPress={onDismiss}
            accessibilityLabel="Dismiss this banner"
            style={({ pressed }) => [
              styles.dismissButton,
              {
                backgroundColor: pressed
                  ? colors.destructiveSurfaceAlt
                  : "transparent",
              },
            ]}
          >
            <X color={colors.destructiveText} size={18} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  icon: {
    marginTop: 2,
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  dismissButton: {
    padding: 8,
    borderRadius: 8,
    minWidth: 36,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});