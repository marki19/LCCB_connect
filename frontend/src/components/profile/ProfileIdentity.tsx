import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { GraduationCap, CheckCircle } from "lucide-react-native";
import Avatar from "../Avatar";
import NoteBubble from "./NoteBubble";
import { UserProfileData } from "../../lib/api";
import { useTheme } from "../../contexts/ThemeContext";
import { SPACE } from "../../lib/tokens";

interface ProfileIdentityProps {
  userData: UserProfileData;
  isDesktop?: boolean;
  actions?: React.ReactNode;
  onNoteUpdated?: (newNote: string | null) => void;
}

export default function ProfileIdentity({
  userData,
  isDesktop = true,
  actions,
  onNoteUpdated,
}: ProfileIdentityProps) {
  const { colors } = useTheme();

  const avatarSize = isDesktop ? 168 : 108;
  const avatarOverlap = isDesktop ? -84 : -54;

  const friendsCount = userData.stats?.friends_count ?? 0;
  const courseOrDept = userData.course_name || userData.department_name;
  const academicLine = courseOrDept
    ? `La Consolacion College Bacolod · ${courseOrDept}${userData.year_level ? ` (${userData.year_level})` : ""}`
    : "La Consolacion College Bacolod";

  return (
    <View style={[styles.container, isDesktop ? styles.desktopContainer : styles.mobileContainer]}>
      {/* Left side: Avatar + Identity Details */}
      <View style={[styles.mainIdentity, isDesktop && styles.mainIdentityDesktop]}>
        {/* Overlapping Avatar with Note bubble */}
        <View style={styles.avatarSection}>
          <View style={[styles.noteBubbleAnchor, { top: avatarOverlap - 38 }]}>
            <NoteBubble
              note={userData.note}
              isSelf={userData.is_self}
              onNoteUpdated={onNoteUpdated}
              variant="large"
            />
          </View>
          <View
            style={[
              styles.avatarWrap,
              {
                marginTop: avatarOverlap,
                borderColor: colors.surfacePage,
                backgroundColor: colors.surfacePage,
              },
            ]}
          >
            <Avatar
              name={userData.full_name || userData.username}
              avatarUrl={userData.avatar_url}
              size={avatarSize}
            />
          </View>
        </View>

        {/* Identity Details */}
        <View style={[styles.infoWrap, !isDesktop && { alignItems: "center" }]}>
          <View style={styles.nameRow}>
            <Text
              style={[
                styles.name,
                { color: colors.ink, fontSize: isDesktop ? 28 : 22 },
                !isDesktop && { textAlign: "center" },
              ]}
              numberOfLines={1}
            >
              {userData.full_name}
            </Text>
            {userData.verified_status === "verified" && (
              <CheckCircle size={20} color={colors.brand} style={{ marginLeft: 6 }} />
            )}
          </View>

          <Text style={[styles.friendsCount, { color: colors.inkFaint }]}>
            {`${friendsCount} ${friendsCount === 1 ? "friend" : "friends"}`}
          </Text>

          {userData.bio ? (
            <Text
              style={[
                styles.bio,
                { color: colors.inkSoft },
                !isDesktop && { textAlign: "center" },
              ]}
              numberOfLines={3}
            >
              {userData.bio}
            </Text>
          ) : null}

          <View style={styles.academicRow}>
            <GraduationCap size={15} color={colors.inkFaint} />
            <Text style={[styles.academicText, { color: colors.inkSoft }]} numberOfLines={1}>
              {academicLine}
            </Text>
          </View>
        </View>
      </View>

      {/* Right side (Desktop) or Bottom (Mobile): Actions */}
      {actions ? (
        <View style={[styles.actionsContainer, isDesktop ? styles.actionsDesktop : styles.actionsMobile]}>
          {actions}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACE.x4,
  },
  desktopContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  mobileContainer: {
    alignItems: "center",
    gap: SPACE.x3,
  },
  mainIdentity: {
    alignItems: "center",
  },
  mainIdentityDesktop: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACE.x5,
    flex: 1,
    marginRight: SPACE.x4,
  },
  avatarSection: {
    position: "relative",
    alignItems: "center",
  },
  noteBubbleAnchor: {
    position: "absolute",
    zIndex: 30,
    alignSelf: "center",
  },
  avatarWrap: {
    borderWidth: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  infoWrap: {
    gap: 4,
    marginBottom: SPACE.x2,
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  friendsCount: {
    fontSize: 14,
    fontWeight: "600",
  },
  bio: {
    fontSize: 13.5,
    lineHeight: 18,
    marginTop: 2,
  },
  academicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  academicText: {
    fontSize: 13,
    fontWeight: "500",
  },
  actionsContainer: {},
  actionsDesktop: {
    marginBottom: SPACE.x2,
  },
  actionsMobile: {
    width: "100%",
    alignItems: "center",
    marginTop: SPACE.x1,
  },
});
