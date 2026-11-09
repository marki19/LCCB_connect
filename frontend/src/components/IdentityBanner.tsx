import { useRouter } from "expo-router";
import { Text, Pressable, StyleSheet } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { SPACE, RADIUS, TYPE, elevation, type ThemeTokens } from "../lib/tokens";

/**
 * One-row banner prompting unverified students to complete their profile.
 * Only shows for students with identity_complete === false.
 */
export default function IdentityBanner() {
  const { profile } = useAuth();
  const router = useRouter();

  if (profile?.role !== "student" || profile?.identity_complete === true) {
    return null;
  }

  return (
    <Pressable
      onPress={() => router.push("/onboarding")}
      style={styles.banner}
      accessibilityRole="button"
      accessibilityLabel="Finish your profile to unlock posting and messaging"
    >
      <Text style={styles.text}>
        Finish your profile to post and message
      </Text>
      <Text style={styles.actionText}>Complete</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: SPACE.x4,
    marginVertical: SPACE.x2,
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    borderRadius: RADIUS.md,
    backgroundColor: "var(--brand-wash)",
    borderWidth: 1,
    borderColor: "var(--brand-wash-strong)",
    ...elevation("sm", {} as ThemeTokens),
  },
  text: {
    ...TYPE.body,
    fontSize: 13,
    color: "var(--brand)",
  },
  actionText: {
    ...TYPE.bodyStrong,
    fontSize: 13,
    color: "var(--brand)",
    textDecorationLine: "underline",
  },
});