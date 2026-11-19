import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Animated,
  ActivityIndicator,
  Platform,
} from "react-native";
import { X, Heart, Eye, Trash2, ChevronLeft, ChevronRight } from "lucide-react-native";
import { AppImage } from "../AppImage";
import Avatar from "../Avatar";
import { resolveFileUrl } from "../../lib/files";
import { recordSnapView, reactToSnap, unreactSnap, deleteSnap, type SnapGroup, type SnapItem } from "../../lib/snaps";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { RADIUS, SPACE } from "../../lib/tokens";

interface SnapViewerProps {
  visible: boolean;
  group: SnapGroup | null;
  onClose: () => void;
  onNextGroup?: () => void;
  onPrevGroup?: () => void;
  onSnapDeleted?: (snapId: string) => void;
}

const SNAP_DURATION_MS = 5000;

export default function SnapViewer({
  visible,
  group,
  onClose,
  onNextGroup,
  onPrevGroup,
  onSnapDeleted,
}: SnapViewerProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reacted, setReacted] = useState(false);
  const [reactionsCount, setReactionsCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);

  const progressAnim = useRef(new Animated.Value(0)).current;

  // Reset index when group changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [group?.author_id]);

  const currentSnap: SnapItem | undefined = group?.snaps[currentIndex];
  const isMine = currentSnap?.author_id === user?.id;

  // Initialize reaction & view counts
  useEffect(() => {
    if (currentSnap) {
      setReacted(Boolean(currentSnap.viewer_reaction));
      setReactionsCount(currentSnap.reactions_count || 0);
      setViewsCount(currentSnap.views_count || 0);

      // Record view if not own snap
      if (!isMine) {
        recordSnapView(currentSnap.id).catch(() => {});
      }
    }
  }, [currentSnap?.id, isMine]);

  // Progress Bar Animation
  useEffect(() => {
    if (!visible || !group || paused) {
      progressAnim.stopAnimation();
      return;
    }

    progressAnim.setValue(0);
    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: SNAP_DURATION_MS,
      useNativeDriver: false,
    });

    anim.start(({ finished }) => {
      if (finished) {
        handleNext();
      }
    });

    return () => {
      anim.stop();
    };
  }, [visible, currentIndex, group?.author_id, paused]);

  const handleNext = () => {
    if (!group) return;
    if (currentIndex < group.snaps.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else if (onNextGroup) {
      onNextGroup();
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (!group) return;
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    } else if (onPrevGroup) {
      onPrevGroup();
    }
  };

  const handleToggleReaction = async () => {
    if (!currentSnap) return;
    const newReacted = !reacted;
    setReacted(newReacted);
    setReactionsCount((c) => (newReacted ? c + 1 : Math.max(0, c - 1)));

    try {
      if (newReacted) {
        await reactToSnap(currentSnap.id, "heart");
      } else {
        await unreactSnap(currentSnap.id);
      }
    } catch {
      // Revert on failure
      setReacted(!newReacted);
      setReactionsCount((c) => (!newReacted ? c + 1 : Math.max(0, c - 1)));
    }
  };

  const handleDelete = async () => {
    if (!currentSnap) return;
    try {
      await deleteSnap(currentSnap.id);
      showToast({ message: "Story deleted", tone: "info" });
      onSnapDeleted?.(currentSnap.id);
      if (group && group.snaps.length > 1) {
        handleNext();
      } else {
        onClose();
      }
    } catch (err: any) {
      showToast({ message: err?.message || "Failed to delete story", tone: "error" });
    }
  };

  if (!visible || !group || !currentSnap) {
    return null;
  }

  const mediaUrl = resolveFileUrl(currentSnap.media_key);
  const snapCount = group.snaps.length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.backdrop}>
        {/* Top Progress Bars */}
        <View style={styles.progressRow}>
          {group.snaps.map((s, idx) => {
            let widthInterpolation: any = "0%";
            if (idx < currentIndex) {
              widthInterpolation = "100%";
            } else if (idx === currentIndex) {
              widthInterpolation = progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              });
            }

            return (
              <View key={s.id} style={styles.progressBarBg}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: widthInterpolation,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>

        {/* Header (Author, timestamp, close) */}
        <View style={styles.header}>
          <View style={styles.authorRow}>
            <Avatar name={group.full_name || group.username} avatarUrl={group.avatar_url} size={36} />
            <View style={styles.authorMeta}>
              <Text style={styles.authorName}>{group.full_name || group.username}</Text>
              <Text style={styles.timestamp}>
                {new Date(currentSnap.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {isMine && (
              <Pressable
                onPress={handleDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete story"
                style={styles.headerIconBtn}
              >
                <Trash2 size={20} color="#FFFFFF" />
              </Pressable>
            )}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close story"
              style={styles.headerIconBtn}
            >
              <X size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Media Canvas with Tap Zones */}
        <View style={styles.canvasContainer}>
          {mediaUrl ? (
            <AppImage
              source={mediaUrl}
              style={styles.mediaImage}
              contentFit="contain"
            />
          ) : (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}

          {/* Left tap area for prev snap */}
          <Pressable
            onPress={handlePrev}
            onPressIn={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            style={styles.leftTapArea}
          />

          {/* Right tap area for next snap */}
          <Pressable
            onPress={handleNext}
            onPressIn={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            style={styles.rightTapArea}
          />

          {/* Optional Caption */}
          {Boolean(currentSnap.caption) && (
            <View style={styles.captionContainer}>
              <Text style={styles.captionText}>{currentSnap.caption}</Text>
            </View>
          )}
        </View>

        {/* Bottom Interactive Bar */}
        <View style={styles.bottomBar}>
          {isMine ? (
            <View style={styles.viewsCounter}>
              <Eye size={18} color="#FFFFFF" />
              <Text style={styles.viewsCountText}>
                {viewsCount} {viewsCount === 1 ? "view" : "views"}
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={handleToggleReaction}
              accessibilityRole="button"
              accessibilityLabel={reacted ? "Unlike story" : "Like story"}
              style={styles.reactionBtn}
            >
              <Heart
                size={26}
                color={reacted ? "#EF4444" : "#FFFFFF"}
                fill={reacted ? "#EF4444" : "transparent"}
              />
              {reactionsCount > 0 && (
                <Text style={styles.reactionCountText}>{reactionsCount}</Text>
              )}
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  progressRow: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    zIndex: 20,
  },
  progressBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 20,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  authorMeta: {
    justifyContent: "center",
  },
  authorName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  timestamp: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconBtn: {
    padding: 6,
  },
  canvasContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  loaderWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  leftTapArea: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "35%",
    zIndex: 10,
  },
  rightTapArea: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "65%",
    zIndex: 10,
  },
  captionContainer: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    zIndex: 15,
  },
  captionText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 20,
  },
  reactionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
  },
  reactionCountText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  viewsCounter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
  },
  viewsCountText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});
