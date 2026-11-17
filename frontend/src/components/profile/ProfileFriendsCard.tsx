import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import ProfileCard from "./ProfileCard";
import Avatar from "../Avatar";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";

interface ProfileFriendsCardProps {
  friends: any[];
  friendsCount?: number;
  onSeeAll?: () => void;
}

export default function ProfileFriendsCard({
  friends,
  friendsCount = 0,
  onSeeAll,
}: ProfileFriendsCardProps) {
  const router = useRouter();
  const { colors } = useTheme();

  const count = friendsCount || friends.length;

  const handleSeeAll = () => {
    if (onSeeAll) {
      onSeeAll();
    } else {
      router.push("/friends");
    }
  };

  const previewFriends = friends.slice(0, 9);

  return (
    <ProfileCard
      title="Friends"
      actionLabel="See all friends"
      onAction={handleSeeAll}
    >
      <Text style={[styles.subCount, { color: colors.inkFaint }]}>
        {`${count} ${count === 1 ? "friend" : "friends"}`}
      </Text>

      {previewFriends.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.inkFaint }]}>No friends to show yet.</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {previewFriends.map((f) => {
            const peer = f.peer || f.user || f;
            const name = peer.full_name || peer.username || "Friend";
            return (
              <Pressable
                key={peer.id}
                onPress={() => router.push(`/profile/${peer.id}`)}
                accessibilityRole="link"
                accessibilityLabel={`View ${name}'s profile`}
                style={({ pressed, hovered }: any) => [
                  styles.gridItem,
                  {
                    cursor: "pointer",
                    opacity: pressed ? 0.8 : hovered ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  },
                ]}
              >
                <View style={[styles.avatarWrap, { borderColor: colors.border, backgroundColor: colors.surfaceSunken }]}>
                  <Avatar
                    name={name}
                    avatarUrl={peer.avatar_url}
                    size={92}
                  />
                </View>
                <Text
                  style={[styles.friendName, { color: colors.ink }]}
                  numberOfLines={1}
                >
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ProfileCard>
  );
}

const styles = StyleSheet.create({
  subCount: {
    fontSize: 13,
    marginTop: -SPACE.x2,
    marginBottom: SPACE.x3,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.x2,
    justifyContent: "space-between",
  },
  gridItem: {
    width: "31%",
    alignItems: "center",
    marginBottom: SPACE.x2,
  },
  avatarWrap: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  friendName: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
    width: "100%",
  },
  emptyState: {
    paddingVertical: SPACE.x4,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
  },
});
