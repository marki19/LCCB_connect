/**
 * ChatImageBubble.tsx — Renders photo attachments in chat bubbles.
 * Resolves private bucket signed URLs and provides a tap target for the lightbox.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { Image as ImageIcon } from "lucide-react-native";
import { getResolvedMediaUrl } from "../../lib/chatMedia";
import { useTheme } from "../../contexts/ThemeContext";

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
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!mediaUrl) {
      setResolvedUrl(null);
      setImageLoading(false);
      return;
    }

    // If already a local file/blob or full URL
    if (
      mediaUrl.startsWith("file://") ||
      mediaUrl.startsWith("blob:") ||
      mediaUrl.startsWith("data:")
    ) {
      setResolvedUrl(mediaUrl);
      return;
    }

    getResolvedMediaUrl(mediaUrl)
      .then((url) => {
        if (active) {
          setResolvedUrl(url);
          if (!url) setLoadError(true);
        }
      })
      .catch(() => {
        if (active) setLoadError(true);
      });

    return () => {
      active = false;
    };
  }, [mediaUrl]);

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
            <Image
              source={{ uri: resolvedUrl }}
              style={styles.image}
              resizeMode="cover"
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

