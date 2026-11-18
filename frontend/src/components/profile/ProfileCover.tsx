import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Camera } from "lucide-react-native";
import { AppImage } from "../AppImage";
import { resolveFileUrl } from "../../lib/files";
import { pickCoverImage, uploadToStorage, MAX_UPLOAD_BYTES } from "../../lib/upload";
import { updateCover } from "../../lib/api";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";

interface ProfileCoverProps {
  coverUrl?: string | null;
  isSelf?: boolean;
  onCoverUpdated?: (newKey: string) => void;
  height?: number;
}

export default function ProfileCover({
  coverUrl,
  isSelf = false,
  onCoverUpdated,
  height = 280,
}: ProfileCoverProps) {
  const { colors } = useTheme();
  const [uploading, setUploading] = useState(false);

  const resolved = coverUrl ? resolveFileUrl(coverUrl) : null;

  const handlePickCover = async () => {
    if (uploading) return;
    try {
      const picked = await pickCoverImage();
      if (!picked) return;

      setUploading(true);
      const res = await uploadToStorage(
        picked.uri,
        "covers",
        undefined,
        picked.type,
        MAX_UPLOAD_BYTES.cover
      );

      if (res?.key) {
        await updateCover(res.key);
        if (onCoverUpdated) {
          onCoverUpdated(res.key);
        }
      }
    } catch (err) {
      console.error("Failed to update cover photo:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={[styles.coverContainer, { height, backgroundColor: colors.surfaceSunken }]}>
      {resolved ? (
        <AppImage
          source={resolved}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholderGradient, { backgroundColor: colors.panelInset }]} />
      )}

      {/* Dark overlay for contrast */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.15)" }]} />

      {/* "Add cover photo" / "Edit cover photo" button for self */}
      {isSelf && (
        <Pressable
          onPress={handlePickCover}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel={coverUrl ? "Edit cover photo" : "Add cover photo"}
          style={({ pressed, hovered }: any) => [
            styles.coverBtn,
            {
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              borderColor: "rgba(255, 255, 255, 0.2)",
              cursor: "pointer",
              opacity: pressed ? 0.8 : hovered ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Camera size={16} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.coverBtnText}>
                {coverUrl ? "Edit cover photo" : "Add cover photo"}
              </Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  coverContainer: {
    width: "100%",
    position: "relative",
    overflow: "hidden",
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  placeholderGradient: {
    opacity: 0.9,
  },
  coverBtn: {
    position: "absolute",
    bottom: SPACE.x4,
    right: SPACE.x4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACE.x3,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  coverBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
