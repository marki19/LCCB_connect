import { useRouter } from "expo-router";
import { Text, Pressable, View } from "react-native";
import { X } from "lucide-react-native";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { SPACE, RADIUS, TYPE, elevation } from "../lib/tokens";
import { dismissBanner } from "../lib/api";

/**
 * One-row banner prompting unverified students to complete their profile.
 * Only shows for students with identity_complete === false.
 * Can be dismissed (persisted via backend).
 */
export default function IdentityBanner() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  if (profile?.role !== "student" || profile?.identity_complete !== false) {
    return null;
  }

  // Don't show if already dismissed
  if (profile?.profile_banner_dismissed === true) {
    return null;
  }

  const bannerStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginHorizontal: SPACE.x4,
    marginVertical: SPACE.x2,
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    borderRadius: RADIUS.md,
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandWashStrong,
    ...elevation("sm", colors),
  };

  const handleDismiss = async () => {
    try {
      await dismissBanner();
      // Profile will be refreshed by parent or on next load
    } catch (e) {
      console.error("Failed to dismiss banner:", e);
    }
  };

  return (
    <View style={bannerStyle}>
      <Pressable
        onPress={() => router.push("/onboarding")}
        style={{ flex: 1 }}
        accessibilityRole="button"
        accessibilityLabel="Finish your profile to unlock posting and messaging"
      >
        <Text style={{ ...TYPE.body, fontSize: 13, color: colors.brand }}>
          Finish your profile to post and message
        </Text>
        <Text style={{ ...TYPE.bodyStrong, fontSize: 13, color: colors.brand, textDecorationLine: "underline" }}>
          Complete
        </Text>
      </Pressable>
      <Pressable
        onPress={handleDismiss}
        style={{ marginLeft: SPACE.x3, padding: SPACE.x1 }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss banner"
        hitSlop={10}
      >
        <X size={18} color={colors.brand} />
      </Pressable>
    </View>
  );
}