import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import ProfileCard from "./ProfileCard";
import { AppImage } from "../AppImage";
import { resolveFileUrl } from "../../lib/files";
import { UserPhoto } from "../../lib/api";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";

interface ProfilePhotosCardProps {
  photos: UserPhoto[];
  onSeeAll?: () => void;
  onPhotoPress?: (photo: UserPhoto) => void;
}

export default function ProfilePhotosCard({
  photos,
  onSeeAll,
  onPhotoPress,
}: ProfilePhotosCardProps) {
  const { colors } = useTheme();

  if (!photos || photos.length === 0) {
    return null;
  }

  // Display up to 9 photos in a 3x3 grid
  const previewPhotos = photos.slice(0, 9);

  return (
    <ProfileCard
      title="Photos"
      actionLabel="See all photos"
      onAction={onSeeAll}
    >
      <View style={styles.grid}>
        {previewPhotos.map((photo) => {
          const rawUrl = photo.image_url || photo.image_urls?.[0];
          const resolved = rawUrl ? resolveFileUrl(rawUrl) : null;
          if (!resolved) return null;

          return (
            <Pressable
              key={photo.id}
              onPress={() => onPhotoPress?.(photo)}
              accessibilityRole="button"
              accessibilityLabel="View photo"
              style={({ pressed, hovered }: any) => [
                styles.gridItem,
                {
                  backgroundColor: colors.surfaceSunken,
                  borderColor: colors.border,
                  cursor: "pointer",
                  opacity: pressed ? 0.85 : hovered ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <AppImage
                source={resolved}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            </Pressable>
          );
        })}
      </View>
    </ProfileCard>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.x2,
    justifyContent: "flex-start",
  },
  gridItem: {
    width: "31.3%",
    aspectRatio: 1,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    borderWidth: 1,
  },
});
