import { View, Text, TouchableOpacity, StyleSheet, Image, Linking } from "react-native";
import { MessageCircle, Share2, Heart, ExternalLink } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { Post } from "../types";
import { useTheme } from "../contexts/ThemeContext";
import { RADIUS } from "../lib/tokens";

interface RepostCardProps {
  post: Post;
  repostInfo: {
    id: string;
    caption?: string;
    created_at: string;
    reposter: {
      id: string;
      name: string;
      initials: string;
      avatarColor: string;
    };
  };
  onDeleted?: (id: string | number) => void;
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS.xl,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  repostHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surfaceSunken,
  },
  repostIcon: {
    marginRight: 8,
  },
  reposterInfo: {
    flex: 1,
  },
  reposterName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  repostTime: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 1,
  },
  captionContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  captionText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  originalPostContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  originalPostBorder: {
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    paddingLeft: 10,
    marginLeft: 4,
  },
  originalAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  authorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  authorInitials: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textOnPrimary,
  },
  authorName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  authorMeta: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 1,
  },
  originalContent: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 8,
  },
  originalImage: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: colors.surfaceSunken,
    marginBottom: 8,
  },
  originalTypeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 16,
    marginBottom: 8,
  },
  originalTypeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  linkPreview: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 8,
  },
  linkPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  linkPreviewTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
    marginLeft: 6,
    flex: 1,
  },
  linkPreviewDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
    marginLeft: 20,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
  },
  actionIcon: {
    marginRight: 5,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textTertiary,
  },
  actionTextActive: {
    color: colors.destructive,
  },
  spacer: {
    flex: 1,
  },
});

export default function RepostCard({ post, repostInfo, onDeleted }: RepostCardProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const getTypeConfig = (type: string) => {
    const configs: Record<string, { label: string; bg: string; text: string }> = {
      website: { label: "Website", bg: colors.badgeWebsiteBg, text: colors.badgeWebsiteText },
      thesis: { label: "Thesis", bg: colors.badgeThesisBg, text: colors.badgeThesisText },
      capstone: { label: "Capstone", bg: colors.badgeCapstoneBg, text: colors.badgeCapstoneText },
      project: { label: "Project", bg: colors.badgeProjectBg, text: colors.badgeProjectText },
      text: { label: "Update", bg: colors.badgeUpdateBg, text: colors.badgeUpdateText },
      image: { label: "Image", bg: colors.badgeImageBg, text: colors.badgeImageText },
      discussion: { label: "Discussion", bg: colors.badgeDiscussionBg, text: colors.badgeDiscussionText },
    };
    return configs[type] || configs["text"];
  };

  const typeConfig = getTypeConfig(post.type);
  const isTextBased = post.type === "text" || post.type === "image" || post.type === "discussion";
  const primaryText = isTextBased ? (post.content || post.description) : post.description;
  const primaryTitle = isTextBased ? undefined : post.title;

  return (
    <View style={styles.container}>
      {/* Repost header */}
      <View style={styles.repostHeader}>
        <View style={styles.repostIcon}>
          <Share2 size={16} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={styles.reposterInfo}>
          <Text style={styles.reposterName}>{repostInfo.reposter.name}</Text>
          <Text style={styles.repostTime}>Reposted · {repostInfo.created_at}</Text>
        </View>
      </View>

      {/* Repost caption (if any) */}
      {repostInfo.caption && (
        <View style={styles.captionContainer}>
          <Text style={styles.captionText}>{repostInfo.caption}</Text>
        </View>
      )}

      {/* Original post */}
      <TouchableOpacity
        style={styles.originalPostContainer}
        onPress={() => {
          if (post.type === "thesis") {
            // Handle thesis separately if needed
          } else {
            router.push(`/post/${post.id}`);
          }
        }}
        activeOpacity={0.95}
      >
        <View style={styles.originalPostBorder}>
          {/* Original author */}
          <View style={styles.originalAuthorRow}>
            <View
              style={[
                styles.authorAvatar,
                { backgroundColor: post.author.avatarColor },
              ]}
            >
              <Text style={styles.authorInitials}>{post.author.initials}</Text>
            </View>
            <View>
              <Text style={styles.authorName}>{post.author.name}</Text>
              <Text style={styles.authorMeta}>
                {post.author.course || "—"} · {post.author.yearLevel || "—"} · {post.createdAt}
              </Text>
            </View>
          </View>

          {/* Type badge */}
          <View style={[styles.originalTypeBadge, { backgroundColor: typeConfig.bg }]}>
            <Text style={[styles.originalTypeText, { color: typeConfig.text }]}>{typeConfig.label}</Text>
          </View>

          {/* Original content */}
          {primaryTitle && (
            <Text style={{ ...styles.originalContent, fontWeight: "700", color: colors.textPrimary, fontSize: 14 }}>{primaryTitle}</Text>
          )}
          {primaryText && <Text style={styles.originalContent}>{primaryText}</Text>}

          {/* Original image */}
          {post.imageUrl && (
            <Image
              source={{ uri: post.imageUrl }}
              style={styles.originalImage}
              resizeMode="cover"
            />
          )}

          {/* Link preview */}
          {post.preview_metadata && (
            <TouchableOpacity
              style={styles.linkPreview}
              onPress={(e) => {
                e.stopPropagation();
                const target = post.preview_metadata?.url || post.previewUrl;
                if (target) Linking.openURL(target);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.linkPreviewRow}>
                <ExternalLink size={13} color={colors.action} />
                <Text numberOfLines={1} style={styles.linkPreviewTitle}>
                  {post.preview_metadata.siteName || post.preview_metadata.url}
                </Text>
              </View>
              {post.preview_metadata.title && (
                <Text numberOfLines={1} style={styles.linkPreviewTitle}>{post.preview_metadata.title}</Text>
              )}
              {post.preview_metadata.description && (
                <Text numberOfLines={2} style={styles.linkPreviewDesc}>{post.preview_metadata.description}</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Actions row (like, comment, share counts) */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
              <Heart size={16} color={colors.textTertiary} strokeWidth={2} style={styles.actionIcon} />
              <Text style={styles.actionText}>{post.likes}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push(`/post/${post.id}`)}>
              <MessageCircle size={16} color={colors.textTertiary} strokeWidth={2} style={styles.actionIcon} />
              <Text style={styles.actionText}>{post.comments}</Text>
            </TouchableOpacity>
            <View style={styles.spacer} />
            <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
              <Share2 size={16} color={colors.textTertiary} strokeWidth={2} style={styles.actionIcon} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}