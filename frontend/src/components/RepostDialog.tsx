import { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, Keyboard } from "react-native";
import { X, Send, Edit3, Share2 } from "lucide-react-native";
import { useTheme } from "../contexts/ThemeContext";
import { RADIUS, SPACE } from "../lib/tokens";
import { createRepost } from "../lib/api";

interface RepostDialogProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACE.x4,
    paddingTop: SPACE.x4,
    paddingBottom: SPACE.x5,
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: SPACE.x4,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: SPACE.x3,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACE.x3,
    paddingHorizontal: SPACE.x3,
    borderRadius: RADIUS.md,
    marginBottom: SPACE.x2,
  },
  optionButtonActive: {
    backgroundColor: colors.primarySurface,
  },
  optionIcon: {
    marginRight: SPACE.x3,
  },
  optionText: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  optionTextActive: {
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: SPACE.x3,
  },
  composerContainer: {
    marginTop: SPACE.x2,
  },
  composerLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: SPACE.x2,
  },
  composerInput: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x3,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 100,
    textAlignVertical: "top",
  },
  composerFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SPACE.x3,
    paddingTop: SPACE.x3,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  charCount: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  postButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: SPACE.x5,
    paddingVertical: SPACE.x2,
    borderRadius: RADIUS.md,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textOnPrimary,
    marginLeft: SPACE.x2,
  },
});

export default function RepostDialog({ postId, isOpen, onClose, onSuccess }: RepostDialogProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [mode, setMode] = useState<"instant" | "caption">("instant");
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handlePost = async () => {
    if (loading) return;
    
    if (mode === "caption" && !caption.trim()) {
      Alert.alert("Add a caption", "Please enter a caption or choose \"Repost\" to share without one.");
      return;
    }

    setLoading(true);
    try {
      await createRepost(postId, mode === "caption" ? caption.trim() : undefined);
      onSuccess();
      onClose();
    } catch (e: any) {
      if (e.code === "DUPLICATE_REPOST") {
        Alert.alert("Already reposted", "You've already reposted this post.");
      } else if (e.code === "REPOSTS_NOT_ALLOWED") {
        Alert.alert("Reposts disabled", "The author has disabled reposts for this post.");
      } else if (e.code === "ALREADY_BLOCKED") {
        Alert.alert("Cannot repost", "You cannot repost content from a blocked user.");
      } else if (e.code === "POST_DELETED") {
        Alert.alert("Post unavailable", "The original post has been deleted.");
      } else {
        Alert.alert("Error", e.message || "Failed to repost. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setMode("instant");
    setCaption("");
    Keyboard.dismiss();
  };

  return (
    <TouchableOpacity style={styles.overlay} onPress={onClose} accessible={false}>
      <TouchableOpacity style={styles.container} onPress={() => {}} accessible={false}>
        <View style={styles.handle} />
        
        {mode === "instant" ? (
          <>
            <Text style={styles.title}>Repost</Text>
            
            <TouchableOpacity
              style={[styles.optionButton, styles.optionButtonActive]}
              onPress={() => handlePost()}
              activeOpacity={0.7}
            >
              <Share2 size={22} color={colors.primary} style={styles.optionIcon} strokeWidth={2} />
              <Text style={[styles.optionText, styles.optionTextActive]}>Repost</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => setMode("caption")}
              activeOpacity={0.7}
            >
              <Edit3 size={22} color={colors.textSecondary} style={styles.optionIcon} />
              <Text style={styles.optionText}>Repost with Caption</Text>
            </TouchableOpacity>
            
            <View style={styles.divider} />
            
            <TouchableOpacity
              style={styles.optionButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <X size={22} color={colors.textTertiary} style={styles.optionIcon} />
              <Text style={[styles.optionText, { color: colors.textTertiary }]}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACE.x2 }}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <X size={24} color={colors.textSecondary} />
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textPrimary, marginLeft: SPACE.x3 }}>Add a caption</Text>
            </TouchableOpacity>
            
            <View style={styles.divider} />
            
            <Text style={styles.composerLabel}>Your thoughts (optional)</Text>
            <TextInput
              style={styles.composerInput}
              multiline
              placeholder="What's on your mind?"
              value={caption}
              onChangeText={setCaption}
              maxLength={280}
              autoFocus
              placeholderTextColor={colors.textMuted}
            />
            
            <View style={styles.composerFooter}>
              <Text style={styles.charCount}>{caption.length}/280</Text>
              <TouchableOpacity
                style={[
                  styles.postButton,
                  loading || (!caption.trim() && mode === "caption") ? styles.postButtonDisabled : {},
                ]}
                onPress={handlePost}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Send size={18} color={colors.textOnPrimary} />
                <Text style={styles.postButtonText}>
                  {loading ? "Posting..." : "Post"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}