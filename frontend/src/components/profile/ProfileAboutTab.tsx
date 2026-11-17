import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Building2, GraduationCap, Calendar, UserCheck } from "lucide-react-native";
import { UserProfileData } from "../../lib/api";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";

interface ProfileAboutTabProps {
  userData: UserProfileData;
}

export default function ProfileAboutTab({ userData }: ProfileAboutTabProps) {
  const { colors } = useTheme();

  const joinedDate = userData.created_at
    ? new Date(userData.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.ink }]}>Academic Profile</Text>

      <View style={styles.section}>
        <View style={styles.detailRow}>
          <Building2 size={20} color={colors.brand} style={styles.rowIcon} />
          <View style={styles.textCol}>
            <Text style={[styles.label, { color: colors.inkFaint }]}>Department</Text>
            <Text style={[styles.value, { color: colors.ink }]}>
              {userData.department_name || "La Consolacion College Bacolod"}
            </Text>
          </View>
        </View>

        {userData.course_name ? (
          <View style={styles.detailRow}>
            <GraduationCap size={20} color={colors.brand} style={styles.rowIcon} />
            <View style={styles.textCol}>
              <Text style={[styles.label, { color: colors.inkFaint }]}>Program / Degree</Text>
              <Text style={[styles.value, { color: colors.ink }]}>
                {userData.course_name}
                {userData.year_level ? ` · Year ${userData.year_level}` : ""}
              </Text>
            </View>
          </View>
        ) : null}

        {joinedDate ? (
          <View style={styles.detailRow}>
            <Calendar size={20} color={colors.brand} style={styles.rowIcon} />
            <View style={styles.textCol}>
              <Text style={[styles.label, { color: colors.inkFaint }]}>Member Since</Text>
              <Text style={[styles.value, { color: colors.ink }]}>{joinedDate}</Text>
            </View>
          </View>
        ) : null}

        {userData.verified_status === "verified" && (
          <View style={styles.detailRow}>
            <UserCheck size={20} color={colors.brand} style={styles.rowIcon} />
            <View style={styles.textCol}>
              <Text style={[styles.label, { color: colors.inkFaint }]}>Verification Status</Text>
              <Text style={[styles.value, { color: colors.ink }]}>Verified Student / Faculty</Text>
            </View>
          </View>
        )}
      </View>

      {userData.skills && userData.skills.length > 0 && (
        <View style={[styles.section, { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: SPACE.x4 }]}>
          <Text style={[styles.subheading, { color: colors.ink }]}>Skills & Expertise</Text>
          <View style={styles.skillsWrap}>
            {userData.skills.map((skill) => (
              <View
                key={skill}
                style={[
                  styles.skillBadge,
                  { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.skillText, { color: colors.inkSoft }]}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SPACE.x5,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },
  heading: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: SPACE.x4,
  },
  subheading: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: SPACE.x3,
  },
  section: {
    gap: SPACE.x4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  rowIcon: {
    marginRight: SPACE.x3,
    marginTop: 2,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 2,
  },
  skillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.x2,
  },
  skillBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  skillText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
