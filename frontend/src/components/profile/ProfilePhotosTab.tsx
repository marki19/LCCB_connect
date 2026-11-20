import React from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Image as ImageIcon } from "lucide-react-native";
import { AppImage } from "../AppImage";
import { resolveFileUrl } from "../../lib/files";
import { UserPhoto } from "../../lib/api";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";

interface ProfilePhotosTabProps {
  photos: UserPhoto[];
  loading: boolean;
  onPhotoPress?: (photo: UserPhoto) => void;
}

export default function ProfilePhotosTab({
  photos,
  loading,
  onPhotoPress,
}: ProfilePhotosTabProps) {
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (photos.length === 0) {
    return (
      <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceSunken }]}>
          <ImageIcon size={32} color={colors.inkFaint} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.ink }]}>No photos yet</Text>
        <Text style={[styles.emptySubtitle, { color: colors.inkFaint }]}>
          Photos shared in posts will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.ink }]}>
        Photos ({photos.length})
      </Text>

      <View style={styles.grid}>
        {photos.map((photo) => {
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
  gridItem: {
    width: "23.5%",
    aspectRatio: 1,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    borderWidth: 1,
  },
});
