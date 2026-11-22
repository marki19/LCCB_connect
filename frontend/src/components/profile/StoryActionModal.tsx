import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Camera, Image as ImageIcon, X } from "lucide-react-native";
import Modal from "../ui/Modal";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { captureSnap, pickSnap, uploadToStorage, MAX_UPLOAD_BYTES } from "../../lib/upload";
import { RADIUS, SPACE } from "../../lib/tokens";

interface StoryActionModalProps {
  visible: boolean;
  onClose: () => void;
  onStoryCreated?: () => void;
}

export default function StoryActionModal({
  visible,
  onClose,
  onStoryCreated,
}: StoryActionModalProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleCapture = async () => {
    try {
      const media = await captureSnap();
      if (!media) return;
      await uploadMedia(media);
    } catch (err: any) {
      showToast({ message: err?.message || "Failed to open camera", tone: "error" });
    }
  };

  const handlePick = async () => {
    try {
      const media = await pickSnap();
      if (!media) return;
      await uploadMedia(media);
    } catch (err: any) {
      showToast({ message: err?.message || "Failed to open gallery", tone: "error" });
    }
  };

  const uploadMedia = async (media: { uri: string; name: string; type: string }) => {
    setBusy(true);
    try {
      const uploaded = await uploadToStorage(
        media.uri,
        "snaps",
        media.name,
        media.type,
        MAX_UPLOAD_BYTES.snap
      );
      if (uploaded) {
        showToast({ message: "Story added successfully!", tone: "success" });
        onStoryCreated?.();
        onClose();
      } else {
        showToast({ message: "Failed to upload story", tone: "error" });
      }
    } catch (err: any) {
      showToast({ message: err?.message || "Failed to add story", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} onClose={busy ? () => {} : onClose}>
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.ink }]}>Add to story</Text>
          <Pressable
            onPress={onClose}
            disabled={busy}
            hitSlop={8}
            style={({ pressed, hovered }: any) => [
              styles.closeBtn,
              {
                backgroundColor: colors.surfaceSunken,
                opacity: pressed ? 0.7 : hovered ? 0.9 : 1,
              },
            ]}
          >
            <X size={18} color={colors.ink} />
          </Pressable>
        </View>

        <Text style={[styles.subtitle, { color: colors.inkSoft }]}>
          Choose how you want to share your photo or video story.
        </Text>

        {busy ? (
          <View style={styles.busyBox}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={[styles.busyText, { color: colors.inkSoft }]}>Uploading story...</Text>
          </View>
        ) : (
          <View style={styles.actions}>
            <Pressable
              onPress={handleCapture}
              accessibilityRole="button"
              accessibilityLabel="Take Photo or Video"
              style={({ pressed, hovered }: any) => [
                styles.actionBtn,
                {
                  backgroundColor: colors.surfaceSunken,
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : hovered ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: colors.brandWash }]}>
                <Camera size={24} color={colors.brand} />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, { color: colors.ink }]}>Use Camera</Text>
                <Text style={[styles.actionDesc, { color: colors.inkFaint }]}>
                  Take a new photo or video up to 30 seconds
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={handlePick}
              accessibilityRole="button"
              accessibilityLabel="Upload from Gallery"
              style={({ pressed, hovered }: any) => [
                styles.actionBtn,
                {
                  backgroundColor: colors.surfaceSunken,
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : hovered ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: colors.successSurface }]}>
                <ImageIcon size={24} color={colors.success} />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, { color: colors.ink }]}>Upload Photo / Video</Text>
                <Text style={[styles.actionDesc, { color: colors.inkFaint }]}>
                  Pick an existing image or video from your device
                </Text>
              </View>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACE.x5,
    borderRadius: RADIUS.xl,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACE.x2,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: SPACE.x4,
  },
  actions: {
    gap: SPACE.x3,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACE.x4,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACE.x3,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  actionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  busyBox: {
    paddingVertical: SPACE.x8,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.x3,
  },
  busyText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
