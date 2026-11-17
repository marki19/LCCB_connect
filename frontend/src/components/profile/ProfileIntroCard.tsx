import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Building2, GraduationCap, Calendar, Edit3 } from "lucide-react-native";
import ProfileCard from "./ProfileCard";
import { UserProfileData } from "../../lib/api";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";

interface ProfileIntroCardProps {
  userData: UserProfileData;
  isSelf: boolean;
}

export default function ProfileIntroCard({ userData, isSelf }: ProfileIntroCardProps) {
  const router = useRouter();
  const { colors } = useTheme();

  const joinedYear = userData.created_at
    ? new Date(userData.created_at).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <ProfileCard
      title="Intro"
      actionLabel={isSelf ? "Edit details" : undefined}
      onAction={isSelf ? () => router.push("/edit-profile") : undefined}
    >
      <View style={styles.content}>
        {userData.bio ? (
          <Text style={[styles.bioText, { color: colors.ink }]}>{userData.bio}</Text>
        ) : null}

        {userData.course_name ? (
          <View style={styles.detailRow}>
            <GraduationCap size={18} color={colors.inkFaint} />
            <Text style={[styles.detailText, { color: colors.ink }]}>
              Studies <Text style={{ fontWeight: "700" }}>{userData.course_name}</Text>
              {userData.year_level ? ` (${userData.year_level})` : ""}
            </Text>
          </View>
        ) : null}

        {userData.department_name ? (
          <View style={styles.detailRow}>
            <Building2 size={18} color={colors.inkFaint} />
            <Text style={[styles.detailText, { color: colors.ink }]}>
              Department: <Text style={{ fontWeight: "700" }}>{userData.department_name}</Text>
            </Text>
          </View>
        ) : null}

        {joinedYear ? (
          <View style={styles.detailRow}>
            <Calendar size={18} color={colors.inkFaint} />
            <Text style={[styles.detailText, { color: colors.inkSoft }]}>
              Joined {joinedYear}
            </Text>
          </View>
        ) : null}

        {isSelf && (
          <Pressable
            onPress={() => router.push("/edit-profile")}
            accessibilityRole="button"
            accessibilityLabel="Edit details"
            style={({ pressed, hovered }: any) => [
              styles.editDetailsBtn,
              {
                backgroundColor: colors.surfaceSunken,
                borderColor: colors.border,
                borderWidth: 1,
                cursor: "pointer",
                opacity: pressed ? 0.8 : hovered ? 0.92 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <Edit3 size={15} color={colors.ink} />
            <Text style={[styles.editBtnText, { color: colors.ink }]}>Edit details</Text>
          </Pressable>
        )}
      </View>
    </ProfileCard>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: SPACE.x3,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: SPACE.x1,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailText: {
    fontSize: 14,
    flex: 1,
  },
  editDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    marginTop: SPACE.x2,
  },
  editBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
  },
});
