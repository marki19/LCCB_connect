import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Plus } from "lucide-react-native";
import { AppImage } from "../AppImage";
import Avatar from "../Avatar";
import { resolveFileUrl } from "../../lib/files";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";
import type { SnapGroup } from "../../lib/snaps";

interface SnapRailProps {
  groups: SnapGroup[];
  loading?: boolean;
  onAddStory: () => void;
  onOpenGroup: (group: SnapGroup) => void;
}

export default function SnapRail({
  groups,
  loading = false,
  onAddStory,
  onOpenGroup,
}: SnapRailProps) {
  const { user, profile } = useAuth();
  const { colors } = useTheme();

  const currentUserId = user?.id;

  // Separate current user's snaps group from peers
  const selfGroup = groups.find((g) => g.author_id === currentUserId);
  const peerGroups = groups.filter((g) => g.author_id !== currentUserId);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Create / Self Story Card */}
        <Pressable
          onPress={selfGroup && selfGroup.snaps.length > 0 ? () => onOpenGroup(selfGroup) : onAddStory}
          accessibilityRole="button"
          accessibilityLabel={selfGroup ? "View your story" : "Create story"}
          style={({ pressed, hovered }: any) => [
            styles.card,
            {
              backgroundColor: colors.surfaceSunken,
              borderColor: colors.border,
              transform: [{ scale: pressed ? 0.98 : hovered ? 1.02 : 1 }],
            },
          ]}
        >
          {selfGroup && selfGroup.snaps.length > 0 ? (
            // Self with active snaps
            <>
              <AppImage
                source={resolveFileUrl(selfGroup.snaps[selfGroup.snaps.length - 1]?.media_key)}
                style={styles.cardBg}
                contentFit="cover"
              />
              <View style={styles.gradientOverlay} />
              <View style={styles.avatarBadge}>
                <Avatar
                  name={profile?.full_name || profile?.username || "You"}
                  avatarUrl={profile?.avatar_url}
                  size={36}
                />
              </View>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onAddStory();
                }}
                accessibilityRole="button"
                accessibilityLabel="Add to your story"
                style={[styles.addFloatingBtn, { backgroundColor: colors.brandSolid }]}
              >
                <Plus size={16} color="#FFFFFF" strokeWidth={3} />
              </Pressable>
              <Text style={styles.cardAuthorName} numberOfLines={1}>
                Your story
              </Text>
            </>
          ) : (
            // Self without active snaps (Create story card)
            <View style={styles.createStoryWrap}>
              <View style={styles.createStoryTop}>
                <Avatar
                  name={profile?.full_name || profile?.username || "You"}
                  avatarUrl={profile?.avatar_url}
                  size={58}
                />
              </View>
              <View style={[styles.createStoryBottom, { backgroundColor: colors.surface }]}>
                <View style={[styles.createStoryPlus, { backgroundColor: colors.brandSolid }]}>
                  <Plus size={18} color="#FFFFFF" strokeWidth={3} />
                </View>
                <Text style={[styles.createStoryLabel, { color: colors.ink }]}>
                  Create story
                </Text>
              </View>
            </View>
          )}
        </Pressable>

        {/* Peer Story Cards */}
        {loading && peerGroups.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.brand} />
          </View>
        ) : (
          peerGroups.map((group) => {
            const latestSnap = group.snaps[group.snaps.length - 1];
            const mediaUrl = resolveFileUrl(latestSnap?.media_key);

            return (
              <Pressable
                key={group.author_id}
                onPress={() => onOpenGroup(group)}
                accessibilityRole="button"
                accessibilityLabel={`${group.full_name || group.username}'s story`}
                style={({ pressed, hovered }: any) => [
                  styles.card,
                  {
                    backgroundColor: colors.surfaceSunken,
                    borderColor: group.has_unviewed ? colors.brandSolid : colors.border,
                    transform: [{ scale: pressed ? 0.98 : hovered ? 1.02 : 1 }],
                  },
                ]}
              >
                {mediaUrl ? (
                  <AppImage
                    source={mediaUrl}
                    style={styles.cardBg}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.cardBg, { backgroundColor: colors.surfaceSunken }]} />
                )}

                <View style={styles.gradientOverlay} />

                {/* Avatar with unviewed ring */}
                <View
                  style={[
                    styles.avatarBadge,
                    {
                      borderColor: group.has_unviewed ? colors.brandSolid : colors.border,
                      borderWidth: group.has_unviewed ? 2.5 : 1,
                    },
                  ]}
                >
                  <Avatar
                    name={group.full_name || group.username}
                    avatarUrl={group.avatar_url}
                    size={34}
                  />
                </View>

                {/* Author Name */}
                <Text style={styles.cardAuthorName} numberOfLines={2}>
                  {group.full_name || group.username}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACE.x3,
    marginBottom: SPACE.x3,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACE.x3,
    gap: SPACE.x2,
    alignItems: "center",
  },
  card: {
    width: 110,
    height: 172,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
  },
  cardBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  avatarBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    borderRadius: 20,
    padding: 2,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  addFloatingBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  cardAuthorName: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  createStoryWrap: {
    flex: 1,
  },
  createStoryTop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  createStoryBottom: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  createStoryPlus: {
    position: "absolute",
    top: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 4,
  },
  createStoryLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center",
  },
  loadingWrap: {
    width: 80,
    height: 172,
    alignItems: "center",
    justifyContent: "center",
  },
});
