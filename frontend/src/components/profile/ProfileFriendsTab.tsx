import React from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Users } from "lucide-react-native";
import Avatar from "../Avatar";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";

interface ProfileFriendsTabProps {
  friends: any[];
  loading: boolean;
}

export default function ProfileFriendsTab({
  friends,
  loading,
}: ProfileFriendsTabProps) {
  const router = useRouter();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (friends.length === 0) {
    return (
      <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceSunken }]}>
          <Users size={32} color={colors.inkFaint} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.ink }]}>No friends yet</Text>
        <Text style={[styles.emptySubtitle, { color: colors.inkFaint }]}>
          When this user connects with classmates, their friends will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.ink }]}>
        Friends ({friends.length})
      </Text>

      <View style={styles.grid}>
        {friends.map((item) => {
          const peer = item.peer || item.user || item;
          const name = peer.full_name || peer.username || "Friend";
          return (
            <Pressable
              key={peer.id}
              onPress={() => router.push(`/profile/${peer.id}`)}
              accessibilityRole="link"
              accessibilityLabel={`View ${name}'s profile`}
              style={({ pressed, hovered }: any) => [
                styles.friendCard,
                {
                  backgroundColor: colors.surfaceSunken,
                  borderColor: colors.border,
                  cursor: "pointer",
                  opacity: pressed ? 0.8 : hovered ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Avatar name={name} avatarUrl={peer.avatar_url} size={64} />
              <View style={styles.friendInfo}>
                <Text style={[styles.friendName, { color: colors.ink }]} numberOfLines={1}>
                  {name}
                </Text>
                {peer.course_name ? (
                  <Text style={[styles.friendMeta, { color: colors.inkFaint }]} numberOfLines={1}>
                    {peer.course_name}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    paddingVertical: SPACE.x8,
    alignItems: "center",
  },
  emptyBox: {
    padding: SPACE.x8,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.x3,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 320,
    marginTop: 4,
  },
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.x3,
  },
  friendCard: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    padding: SPACE.x3,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACE.x3,
  },
  friendInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  friendName: {
    fontSize: 14.5,
    fontWeight: "700",
  },
  friendMeta: {
    fontSize: 12,
  },
});
