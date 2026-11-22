import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Camera, Image as ImageIcon, X } from "lucide-react-native";
import Modal from "../ui/Modal";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { captureSnap, pickSnap, uploadToStorage, MAX_UPLOAD_BYTES } from "../../lib/upload";
import { createSnap, type SnapAudience } from "../../lib/snaps";
import { RADIUS, SPACE } from "../../lib/tokens";

interface QuickSnapComposerProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

/** The three audiences a snap can be sent to. `private` is author-only and is
 *  not offered here — a snap nobody else can see is what saving to the device
 *  is for. */
const AUDIENCES: { value: SnapAudience; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "friends", label: "Friends" },
  { value: "department", label: "Department" },
];

export default function QuickSnapComposer({
  visible,
  onClose,
  onCreated,
}: QuickSnapComposerProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [audience, setAudience] = useState<SnapAudience>("public");

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
      if (!uploaded?.key) {
        showToast({ message: "Couldn't upload that file", tone: "error" });
        return;
      }

      await createSnap({
        media_key: uploaded.key,
        media_type: media.type.startsWith("video/") ? "video" : "image",
        visibility: audience,
      });
      showToast({ message: "Quick Snap added", tone: "success" });
      onCreated?.();
      onClose();
    } catch (err: any) {
      showToast({ message: err?.message || "Couldn't create snap", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} onClose={busy ? () => {} : onClose} maxWidth={420} sheetOnMobile={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.ink }]}>Quick Snap</Text>
          <Pressable
            onPress={onClose}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
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

        <View style={styles.audienceRow}>
          {AUDIENCES.map((option) => {
            const selected = audience === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setAudience(option.value)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                style={({ pressed, hovered }: any) => [
                  styles.audienceChip,
                  {
                    backgroundColor: selected ? colors.brandSolid : colors.surfaceSunken,
                    borderColor: selected ? colors.brandSolid : colors.border,
                    opacity: pressed ? 0.8 : hovered ? 0.94 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.audienceLabel,
                    { color: selected ? "#FFFFFF" : colors.inkSoft },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {busy ? (
          <View style={styles.busyBox}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={[styles.busyText, { color: colors.inkSoft }]}>Uploading…</Text>
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
              <Text style={[styles.actionTitle, { color: colors.ink }]}>Use Camera</Text>
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
              <Text style={[styles.actionTitle, { color: colors.ink }]}>Upload Photo / Video</Text>
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
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACE.x4,
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
  audienceRow: {
    flexDirection: "row",
    gap: SPACE.x2,
    marginBottom: SPACE.x4,
  },
  audienceChip: {
    flex: 1,
    paddingVertical: SPACE.x2,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: "center",
  },
  audienceLabel: {
    fontSize: 13,
    fontWeight: "600",
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
  actionTitle: {
    fontSize: 15,
    fontWeight: "600",
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
