import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Trash2, Flag, UserX, Share2, Settings, Edit3 } from "lucide-react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { RADIUS, SPACE, elevation } from "../lib/tokens";
import { useRouter } from "expo-router";
import type { Post } from "../types";

interface PostMenuProps {
  post: Post;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onRepost?: (caption?: string) => void;
  onReport: () => void;
  onBlock: () => void;
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1000,
    minWidth: 180,
    maxWidth: 220,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menu: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...elevation("lg", colors),
  },
  section: {},
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x3,
  },
  itemText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: SPACE.x3,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginHorizontal: SPACE.x3,
  },
  destructiveText: {
    color: colors.destructive,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x2,
    color: colors.textTertiary,
  },
});

export default function PostMenu({ post, onClose, onEdit, onDelete, onRepost, onReport, onBlock }: PostMenuProps) {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const router = useRouter();
  const isOwner = !!profile?.id && profile.id === post.author.id;

  const styles = createStyles(colors);

  const handleRepost = async (caption?: string) => {
    onClose();
    if (onRepost) {
      onRepost(caption);
    }
  };

  const handlePostSettings = async () => {
    onClose();
    // Navigate to post settings screen (visibility + allow_reposts)
    router.push({
      pathname: "/post-settings",
      params: { postId: String(post.id) },
    });
  };

  const handleShare = () => {
    onClose();
    // Native share
    const shareUrl = `https://lccbconnect.app/post/${post.id}`;
    // In a real app, use expo-sharing or react-native Share API
    Alert.alert("Share", `Copy link: ${shareUrl}`);
  };

  return (
    <TouchableOpacity
      style={styles.backdrop}
      onPress={onClose}
      accessible={false}
    >
      <View style={styles.container}>
        <View style={styles.menu}>
          {/* Own post section */}
          {isOwner && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Your Post</Text>
                <TouchableOpacity style={styles.item} onPress={() => { onClose(); onEdit?.(); }}>
                  <Edit3 size={16} color={colors.action} />
                  <Text style={styles.itemText}>Edit Post</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.item} onPress={() => { onClose(); handleRepost(); }}>
                  <Share2 size={16} color={colors.action} strokeWidth={2} />
                  <Text style={styles.itemText}>Repost</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.item} onPress={handlePostSettings}>
                  <Settings size={16} color={colors.textSecondary} />
                  <Text style={styles.itemText}>Post Settings</Text>
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.item} onPress={() => { onClose(); onDelete?.(); }}>
                  <Trash2 size={16} color={colors.destructive} />
                  <Text style={[styles.itemText, styles.destructiveText]}>Delete Post</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Other's post section */}
          {!isOwner && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Actions</Text>
                <TouchableOpacity style={styles.item} onPress={() => { onClose(); handleRepost(); }}>
                  <Share2 size={16} color={colors.action} strokeWidth={2} />
                  <Text style={styles.itemText}>Repost</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.item} onPress={handleShare}>
                  <Share2 size={16} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={styles.itemText}>Share</Text>
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.item} onPress={() => { onClose(); onReport(); }}>
                  <Flag size={16} color={colors.warning} />
                  <Text style={styles.itemText}>Report</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.item} onPress={() => { onClose(); onBlock(); }}>
                  <UserX size={16} color={colors.destructive} />
                  <Text style={[styles.itemText, styles.destructiveText]}>Block @{post.author.username || post.author.name}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}