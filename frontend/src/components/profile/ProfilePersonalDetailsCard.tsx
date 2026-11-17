import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Heart, User, Plus } from "lucide-react-native";
import { useRouter } from "expo-router";
import ProfileCard from "./ProfileCard";
import { UserProfileData } from "../../lib/api";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";

interface ProfilePersonalDetailsCardProps {
  userData: UserProfileData;
  isSelf?: boolean;
}

export default function ProfilePersonalDetailsCard({
  userData,
  isSelf,
}: ProfilePersonalDetailsCardProps) {
  const router = useRouter();
  const { colors } = useTheme();

  const relationship = userData.relationship_status?.trim();
  const gender = userData.gender?.trim();
  const hasDetails = Boolean(relationship || gender);

  return (
    <ProfileCard
      title="Personal details"
      actionLabel={isSelf ? "Edit" : undefined}
      onAction={isSelf ? () => router.push("/edit-profile") : undefined}
    >
      <View style={styles.container}>
        {/* Relationship row */}
        {relationship ? (
          <View style={styles.detailRow}>
            <Heart size={18} color={colors.inkFaint} />
            <Text style={[styles.detailText, { color: colors.ink }]}>{relationship}</Text>
          </View>
        ) : null}

        {/* Gender / Identity row */}
        {gender ? (
          <View style={styles.detailRow}>
            <User size={18} color={colors.inkFaint} />
            <Text style={[styles.detailText, { color: colors.ink }]}>{gender}</Text>
          </View>
        ) : null}

        {/* Empty state & prompt */}
        {!hasDetails && (
          isSelf ? (
            <Pressable
              onPress={() => router.push("/edit-profile")}
              accessibilityRole="button"
              accessibilityLabel="Add personal details"
              style={({ pressed, hovered }: any) => [
                styles.addPromptBtn,
                {
                  backgroundColor: colors.surfaceSunken,
                  borderColor: colors.border,
                  cursor: "pointer",
                  opacity: pressed ? 0.75 : hovered ? 0.9 : 1,
                },
              ]}
            >
              <Plus size={15} color={colors.brand} />
              <Text style={[styles.addPromptText, { color: colors.brand }]}>
                Add relationship & gender
              </Text>
            </Pressable>
          ) : (
            <Text style={[styles.detailText, { color: colors.inkFaint, fontStyle: "italic" }]}>
              No personal details added.
            </Text>
          )
        )}
      </View>
    </ProfileCard>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACE.x3,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
  },
  detailText: {
    fontSize: 14,
    fontWeight: "500",
  },
  addPromptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.x2,
    paddingVertical: SPACE.x2,
    paddingHorizontal: SPACE.x3,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: SPACE.x1,
  },
  addPromptText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
