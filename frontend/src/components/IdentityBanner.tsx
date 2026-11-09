import { useRouter } from "expo-router";
import { Text, Pressable } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { SPACE, RADIUS, TYPE, elevation } from "../lib/tokens";

/**
 * One-row banner prompting unverified students to complete their profile.
 * Only shows for students with identity_complete === false.
 */
export default function IdentityBanner() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  if (profile?.role !== "student" || profile?.identity_complete !== false) {
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

  return (
    <Pressable
      onPress={() => router.push("/onboarding")}
      style={bannerStyle}
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
  );
}