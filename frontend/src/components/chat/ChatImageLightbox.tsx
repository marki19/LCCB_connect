/**
 * ChatImageLightbox.tsx — Full-screen lightbox viewer for photos clicked in chat.
 * Uses SVG icons exclusively (no emojis).
 */

import React from "react";
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
} from "react-native";
import { X } from "lucide-react-native";

interface ChatImageLightboxProps {
  visible: boolean;
  imageUrl: string | null;
  caption?: string | null;
  onClose: () => void;
}

export default function ChatImageLightbox({
  visible,
  imageUrl,
  caption,
  onClose,
}: ChatImageLightboxProps) {
  if (!imageUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.backdrop}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityLabel="Close photo viewer"
          >
            <X size={22} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Centered Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </View>

        {/* Caption Overlay */}
        {Boolean(caption) && (
          <View style={styles.captionBar}>
            <Text style={styles.captionText}>{caption}</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "space-between",
  },
  topBar: {
    height: 54,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  captionBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
  captionText: {
    color: "#FFFFFF",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 20,
  },
});

