import React, { useState, useEffect } from "react";
import {
  View,
  Image,
  Pressable,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from "react-native";
import { X, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useTheme } from "../contexts/ThemeContext";

interface PostImageGalleryProps {
  images?: string[];
  fallbackImageUrl?: string;
  onPressImage?: (index: number) => void;
}

export function PostImageGallery({
  images,
  fallbackImageUrl,
  onPressImage,
}: PostImageGalleryProps) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  // Consolidate images into a clean array of valid URLs
  const imageList = React.useMemo(() => {
    if (Array.isArray(images) && images.length > 0) {
      return images.filter(Boolean);
    }
    if (fallbackImageUrl) {
      return [fallbackImageUrl];
    }
    return [];
  }, [images, fallbackImageUrl]);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Keyboard navigation on Web (ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    if (Platform.OS !== "web" || lightboxIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxIndex(null);
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      } else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) =>
          prev !== null && prev < imageList.length - 1 ? prev + 1 : prev
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, imageList.length]);

  if (imageList.length === 0) {
    return null;
  }

  const handleImagePress = (index: number) => {
    if (onPressImage) {
      onPressImage(index);
    } else {
      setLightboxIndex(index);
    }
  };

  const count = imageList.length;

  return (
    <View style={styles.container}>
      {/* 1 Photo Layout */}
      {count === 1 && (
        <Pressable
          onPress={() => handleImagePress(0)}
          accessibilityRole="button"
          accessibilityLabel="View photo in fullscreen"
          style={[styles.singleWrapper, { borderColor: colors.border }]}
        >
          <Image
            source={{ uri: imageList[0] }}
            style={styles.singleImage}
            resizeMode="cover"
          />
        </Pressable>
      )}

      {/* 2 Photos Layout (Side by Side) */}
      {count === 2 && (
        <View style={styles.row}>
          {imageList.map((uri, idx) => (
            <Pressable
              key={uri + idx}
              onPress={() => handleImagePress(idx)}
              accessibilityRole="button"
              accessibilityLabel={`View photo ${idx + 1} of 2`}
              style={[
                styles.halfWrapper,
                { borderColor: colors.border, height: 210 },
              ]}
            >
              <Image
                source={{ uri }}
                style={styles.fillImage}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </View>
      )}

      {/* 3 Photos Layout (1 Top Hero + 2 Bottom Split) */}
      {count === 3 && (
        <View style={styles.column}>
          <Pressable
            onPress={() => handleImagePress(0)}
            accessibilityRole="button"
            accessibilityLabel="View photo 1 of 3"
            style={[
              styles.topHeroWrapper,
              { borderColor: colors.border, height: 180 },
            ]}
          >
            <Image
              source={{ uri: imageList[0] }}
              style={styles.fillImage}
              resizeMode="cover"
            />
          </Pressable>
          <View style={styles.row}>
            {imageList.slice(1, 3).map((uri, idx) => (
              <Pressable
                key={uri + idx}
                onPress={() => handleImagePress(idx + 1)}
                accessibilityRole="button"
                accessibilityLabel={`View photo ${idx + 2} of 3`}
                style={[
                  styles.halfWrapper,
                  { borderColor: colors.border, height: 130 },
                ]}
              >
                <Image
                  source={{ uri }}
                  style={styles.fillImage}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* 4 Photos Layout (2x2 Quad Collage) */}
      {count >= 4 && (
        <View style={styles.column}>
          <View style={styles.row}>
            {imageList.slice(0, 2).map((uri, idx) => (
              <Pressable
                key={uri + idx}
                onPress={() => handleImagePress(idx)}
                accessibilityRole="button"
                accessibilityLabel={`View photo ${idx + 1} of 4`}
                style={[
                  styles.halfWrapper,
                  { borderColor: colors.border, height: 135 },
                ]}
              >
                <Image
                  source={{ uri }}
                  style={styles.fillImage}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </View>
          <View style={styles.row}>
            {imageList.slice(2, 4).map((uri, idx) => (
              <Pressable
                key={uri + idx}
                onPress={() => handleImagePress(idx + 2)}
                accessibilityRole="button"
                accessibilityLabel={`View photo ${idx + 3} of 4`}
                style={[
                  styles.halfWrapper,
                  { borderColor: colors.border, height: 135 },
                ]}
              >
                <Image
                  source={{ uri }}
                  style={styles.fillImage}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Fullscreen Lightbox Modal */}
      {lightboxIndex !== null && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setLightboxIndex(null)}
        >
          <View style={styles.lightboxBackdrop}>
            {/* Top Bar with Counter & Close */}
            <View style={styles.lightboxTopBar}>
              <Text style={styles.lightboxCounter}>
                {lightboxIndex + 1} / {imageList.length}
              </Text>
              <TouchableOpacity
                onPress={() => setLightboxIndex(null)}
                style={styles.lightboxCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close photo viewer"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={22} color="#FFFFFF" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {/* Main Full-Size Image Container */}
            <View style={styles.lightboxImageContainer}>
              <Image
                source={{ uri: imageList[lightboxIndex] }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />

              {/* Navigation Chevrons */}
              {imageList.length > 1 && lightboxIndex > 0 && (
                <TouchableOpacity
                  onPress={() => setLightboxIndex((i) => (i !== null ? i - 1 : 0))}
                  style={[styles.lightboxNavBtn, styles.lightboxNavLeft]}
                  accessibilityRole="button"
                  accessibilityLabel="Previous photo"
                >
                  <ChevronLeft size={30} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              )}

              {imageList.length > 1 && lightboxIndex < imageList.length - 1 && (
                <TouchableOpacity
                  onPress={() => setLightboxIndex((i) => (i !== null ? i + 1 : 0))}
                  style={[styles.lightboxNavBtn, styles.lightboxNavRight]}
                  accessibilityRole="button"
                  accessibilityLabel="Next photo"
                >
                  <ChevronRight size={30} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 14,
    marginBottom: 12,
  },
  singleWrapper: {
    width: "100%",
    height: 250,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    backgroundColor: "#1E293B",
  },
  singleImage: {
    width: "100%",
    height: "100%",
  },
  row: {
    flexDirection: "row",
    gap: 6,
  },
  column: {
    flexDirection: "column",
    gap: 6,
  },
  topHeroWrapper: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    backgroundColor: "#1E293B",
  },
  halfWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    backgroundColor: "#1E293B",
  },
  fillImage: {
    width: "100%",
    height: "100%",
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 15, 0.94)",
    justifyContent: "space-between",
  },
  lightboxTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 54 : 20,
    paddingBottom: 14,
    zIndex: 10,
  },
  lightboxCounter: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  lightboxCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  lightboxImage: {
    width: "100%",
    height: "100%",
  },
  lightboxNavBtn: {
    position: "absolute",
    top: "46%",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 15,
  },
  lightboxNavLeft: {
    left: 16,
  },
  lightboxNavRight: {
    right: 16,
  },
});

