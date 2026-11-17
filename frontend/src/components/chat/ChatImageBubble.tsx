/**
 * ChatImageBubble.tsx — Renders photo attachments in chat bubbles.
 * Resolves the stored object key into a renderable URL and provides a tap
 * target for the lightbox.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { resolveMediaUrl } from "../../lib/chatMedia";
import { useTheme } from "../../contexts/ThemeContext";
import { AppImage } from "../AppImage";

interface ChatImageBubbleProps {
  mediaUrl: string;
  caption?: string;
  isMine: boolean;
  sending?: boolean;
  onPressImage?: (resolvedUrl: string, caption?: string) => void;
  statusFooter?: React.ReactNode;
  maxWidth?: number;
}

export default function ChatImageBubble({
  mediaUrl,
  caption,
  isMine,
  sending = false,
  onPressImage,
  statusFooter,
  maxWidth = 240,
}: ChatImageBubbleProps) {
  const { colors } = useTheme();

  // Resolution is a pure string join, so it belongs in render rather than in an
  // effect: no state, no loading window, no double render.
  const resolvedUrl = resolveMediaUrl(mediaUrl);
  const [imageLoading, setImageLoading] = useState(Boolean(resolvedUrl));
  const [loadError, setLoadError] = useState(!resolvedUrl);
  const [trackedUrl, setTrackedUrl] = useState(resolvedUrl);

  // A bubble normally renders one attachment for its lifetime, but if the key
  // is swapped the previous failure must not stick. Adjusting state during
  // render is React's documented alternative to an effect that would render
  // twice and briefly show the old error.
  if (trackedUrl !== resolvedUrl) {
    setTrackedUrl(resolvedUrl);
    setLoadError(!resolvedUrl);
    setImageLoading(Boolean(resolvedUrl));
  }

  const handlePress = () => {
    if (resolvedUrl && onPressImage) {
      onPressImage(resolvedUrl, caption);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          maxWidth,
          backgroundColor: isMine ? colors.brandSolid : colors.surfaceSunken,
          borderColor: isMine ? "transparent" : colors.border,
          borderBottomRightRadius: isMine ? 4 : 16,
          borderBottomLeftRadius: isMine ? 16 : 4,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={handlePress}
        disabled={!resolvedUrl || sending}
        style={styles.imageWrap}
        accessibilityLabel="Chat photo attachment"
      >
        {resolvedUrl && !loadError ? (
          <>
            <AppImage
              source={{ uri: resolvedUrl }}
              style={styles.image}
              contentFit="cover"
              onLoadStart={() => setImageLoading(true)}
              onLoadEnd={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setLoadError(true);
              }}
            />
            {imageLoading && (
              <View style={styles.loaderOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
          </>
        ) : (
          <View style={[styles.fallbackWrap, { backgroundColor: colors.surfaceSunken }]}>
            {loadError ? (
              <Text style={[styles.errorText, { color: colors.inkFaint }]}>Image unavailable</Text>
            ) : (
              <ActivityIndicator size="small" color={colors.brand} />
            )}
          </View>
        )}

        {sending && (
          <View style={styles.sendingOverlay}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>

      {/* Optional Caption */}
      {Boolean(caption) && (
        <View style={styles.captionWrap}>
          <Text
            style={[
              styles.captionText,
              { color: isMine ? "#FFFFFF" : colors.ink },
            ]}
          >
            {caption}
          </Text>
        </View>
      )}

      {/* Ticks & timestamp footer */}
      {statusFooter && <View style={styles.footerWrap}>{statusFooter}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: "hidden",
    padding: 3,
    borderWidth: 1,
  },
  imageWrap: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 13,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.06)",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  loaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  sendingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackWrap: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "500",
  },
  captionWrap: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 2,
  },
  captionText: {
    fontSize: 14,
    lineHeight: 18,
  },
  footerWrap: {
    paddingHorizontal: 6,
    paddingBottom: 4,
    paddingTop: 2,
  },
});

