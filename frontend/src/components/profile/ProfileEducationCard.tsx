import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { GraduationCap } from "lucide-react-native";
import ProfileCard from "./ProfileCard";
import { UserProfileData } from "../../lib/api";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";

interface ProfileEducationCardProps {
  userData: UserProfileData;
}

export default function ProfileEducationCard({ userData }: ProfileEducationCardProps) {
  const { colors } = useTheme();

  if (!userData.course_name && !userData.department_name) {
    return null;
  }

  return (
    <ProfileCard title="Education">
      <View style={styles.eduRow}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
          <GraduationCap size={20} color={colors.brand} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={[styles.schoolName, { color: colors.ink }]}>
            La Consolacion College Bacolod
          </Text>
          {userData.course_name ? (
            <Text style={[styles.courseName, { color: colors.inkSoft }]} numberOfLines={1}>
              {userData.course_name}
            </Text>
          ) : null}
          {userData.department_name ? (
            <Text style={[styles.deptName, { color: colors.inkFaint }]} numberOfLines={1}>
              {userData.department_name}
            </Text>
          ) : null}
        </View>
      </View>
    </ProfileCard>
  );
}

const styles = StyleSheet.create({
  eduRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  schoolName: {
    fontSize: 14.5,
    fontWeight: "700",
  },
  courseName: {
    fontSize: 13,
  },
  deptName: {
    fontSize: 12,
  },
});
