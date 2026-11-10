import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Pressable, Linking, Image, Alert } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Heart, MessageCircle, Share2, ExternalLink, Globe, Users, UserCheck, Lock, MoreVertical } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { Post } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { ThemeTokens, elevation, RADIUS, SPACE, TYPE } from "../lib/tokens";
import { apiJson, deletePost, deleteThesis, getThesisFileUrl, getPostImageUrl, getPostImageUrls, savePost, unsavePost } from "../lib/api";
import PostMenu from "./PostMenu";
import RepostDialog from "./RepostDialog";
import ReportDialog from "./ReportDialog";
import BlockConfirmDialog from "./BlockConfirmDialog";
import InlineCommentsDrawer from "./InlineCommentsDrawer";
import { PostImageGallery } from "./PostImageGallery";
import Button from "./ui/Button";
import Modal from "./ui/Modal";

function getTypeConfig(type: string, colors: ThemeTokens): { label: string; bg: string; text: string } {
  const configs: Record<string, { label: string; bg: string; text: string }> = {
    website:  { label: "Website",  bg: colors.badgeWebsiteBg,  text: colors.badgeWebsiteText },
    thesis:   { label: "Thesis",   bg: colors.badgeThesisBg,   text: colors.badgeThesisText },
    capstone: { label: "Capstone", bg: colors.badgeCapstoneBg, text: colors.badgeCapstoneText },
    project:  { label: "Project",  bg: colors.badgeProjectBg,  text: colors.badgeProjectText },
    text:     { label: "Update",   bg: colors.badgeUpdateBg,   text: colors.badgeUpdateText },
    image:    { label: "Image",    bg: colors.badgeImageBg,    text: colors.badgeImageText },
    discussion: { label: "Discussion", bg: colors.badgeDiscussionBg, text: colors.badgeDiscussionText },
  };
  return configs[type] || configs["text"];
}

function getVisibilityLabel(visibility: string): string {
  switch (visibility) {
    case "public": return "Public";
    case "friends": return "Friends";
    case "custom": return "Custom";
    case "private": return "Private";
    default: return "Public";
  }
}

function getVisibilityColors(visibility: string, colors: ThemeTokens): { bg: string; text: string; iconColor: string } {
  switch (visibility) {
    case "public": return { bg: colors.badgePublicBg, text: colors.badgePublicText, iconColor: colors.badgePublicText };
    case "friends": return { bg: colors.badgeFriendsBg, text: colors.badgeFriendsText, iconColor: colors.badgeFriendsText };
    case "custom": return { bg: colors.badgeCustomBg, text: colors.badgeCustomText, iconColor: colors.badgeCustomText };
    case "private": return { bg: colors.badgePrivateBg, text: colors.badgePrivateText, iconColor: colors.badgePrivateText };
    default: return { bg: colors.surfaceSunken, text: colors.textTertiary, iconColor: colors.textTertiary };
  }
}

// VisibilityBadge component — shown for ALL viewers
function VisibilityBadge({ visibility }: { visibility: string }) {
  const { colors } = useTheme();
  const label = getVisibilityLabel(visibility);
  const { text, iconColor } = getVisibilityColors(visibility, colors);
  
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}>
      {(() => {
        switch (visibility) {
          case "public": return <Globe size={12} color={iconColor} />;
          case "friends": return <Users size={12} color={iconColor} />;
          case "custom": return <UserCheck size={12} color={iconColor} />;
          case "private": return <Lock size={12} color={iconColor} />;
          default: return <Globe size={12} color={iconColor} />;
        }
      })()}
      <Text style={{ fontSize: 11, color: text, marginLeft: 3 }}>{label}</Text>
    </View>
  );
}

export default function PostCard({ post, onDeleted }: { post: Post; onDeleted?: (id: string | number) => void }) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [imageUrls, setImageUrls] = useState<string[]>(
    post.image_urls && post.image_urls.length > 0
      ? post.image_urls
      : (post.imageUrl ? [post.imageUrl] : [])
  );
  const [imageUrl, setImageUrl] = useState<string | undefined>(post.imageUrl);
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments || 0);
  const [isSaved, setIsSaved] = useState<boolean>(Boolean(post.is_saved));

  // Dialog states
  const [menuOpen, setMenuOpen] = useState(false);
  const [repostDialogOpen, setRepostDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const { profile } = useAuth();
  const { colors } = useTheme();
  const isOwner = !!profile?.id && profile.id === post.author.id;

  // Fetch signed URLs for private post images (assets bucket is private per migration 015)
  useEffect(() => {
    const hasImages = (post.image_urls && post.image_urls.length > 0) || Boolean(post.imageUrl);
    if (hasImages) {
      getPostImageUrls(post.id)
        .then((urls) => {
          if (urls.length > 0) {
            setImageUrls(urls);
            setImageUrl(urls[0]);
          }
        })
        .catch(() => {
          if (post.imageUrl) {
            getPostImageUrl(post.id).then(setImageUrl).catch(() => setImageUrl(undefined));
          }
        });
    }
  }, [post.id, post.imageUrl, post.image_urls]);

  const handleEdit = () => {
    if (post.type === "thesis") {
      // Theses are edited in the deposit screen (backend: PUT /theses/:id).
      router.push({
        pathname: "/upload-thesis",
        params: { thesisId: String(post.id) },
      });
      return;
    }
    router.push({
      pathname: "/create",
      params: {
        postId: String(post.id),
        editTitle: post.title ?? "",
        editContent: post.description ?? "",
        editType: post.type ?? "text",
        editTech: (post.tags ?? []).join(", "),
        editUrl: post.previewUrl ?? "",
        editVisibility: post.visibility ?? "public",
      },
    });
  };

  const handleDelete = () => {
    setMenuOpen(false);
    setConfirmDelete(true);
  };

  const performDelete = async () => {
    const isThesis = post.type === "thesis";
    setDeleting(true);
    try {
      if (isThesis) {
        await deleteThesis(post.id);
      } else {
        await deletePost(post.id);
      }
      setConfirmDelete(false);
      onDeleted?.(post.id);
    } catch (e: any) {
      setConfirmDelete(false);
      setNotice(e.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const handleRepost = () => {
    setRepostDialogOpen(true);
  };

  const handleRepostSuccess = () => {
    setRepostDialogOpen(false);
    // Refresh handled by parent
  };

  const handleReportSuccess = () => {
    setReportDialogOpen(false);
  };

  const handleBlockSuccess = () => {
    setBlockDialogOpen(false);
  };

  const handleToggleSave = async () => {
    if (!profile?.id || profile?.role === "guest") {
      Alert.alert("Sign In Required", "Please sign in to save posts.");
      return;
    }
    const next = !isSaved;
    setIsSaved(next);
    try {
      if (next) {
        await savePost(post.id);
      } else {
        await unsavePost(post.id);
      }
    } catch (e: any) {
      setIsSaved(!next);
      Alert.alert("Error", e.message || "Failed to update saved post");
    }
  };

  const handleLike = async () => {
    if (!profile?.id || profile?.role === "guest") {
      setNotice("Please sign in with your institutional account to like posts.");
      return;
    }

    // Reanimated starts animations by mutating the shared value; the new
    // eslint react-hooks/immutability rule flags this documented API pattern.
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withSequence(
      withTiming(1.35, { duration: 110 }),
      withTiming(0.88, { duration: 80 }),
      withTiming(1, { duration: 110 })
    );

    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(newLiked ? likeCount + 1 : likeCount - 1);

    try {
      await apiJson(`/posts/${post.id}/like`, { method: "POST" });
    } catch (e) {
      setLiked(!newLiked);
      setLikeCount(newLiked ? likeCount - 1 : likeCount + 1);
      console.error("Failed to toggle like via SQL backend:", e);
    }
  };

  const typeConfig = getTypeConfig(post.type, colors);

  // For text/image/discussion types, content is the primary body (not title/description)
  const isTextBased = post.type === "text" || post.type === "image" || post.type === "discussion";
  const primaryText = isTextBased ? (post.content || post.description) : post.description;
  const primaryTitle = isTextBased ? undefined : post.title;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.97}
        accessibilityLabel={`${post.author.name}: ${primaryTitle || primaryText}`}
      onPress={async () => {
        // A thesis has no post-detail screen; open the deposited PDF instead
        // (mirrors the search screen's thesis card). Manuscripts are private
        // (migration 015), so the card carries the raw object key — ask the
        // backend for a short-lived signed URL before opening it.
        if (post.type === "thesis") {
          try {
            const url = await getThesisFileUrl(post.id);
            await Linking.openURL(url);
          } catch (err: any) {
            setNotice(err.message || "The file is not available.");
          }
          return;
        }
        router.push(`/post/${post.id}`);
      }}
      style={{
        backgroundColor: colors.panel,
        borderRadius: RADIUS.xxl,
        marginHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.line,
        overflow: "hidden",
        ...elevation("sm", colors),
      }}
    >
      {/* Author row */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandWash, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: colors.brand }}>{post.author.initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}>{post.author.name}</Text>
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>{post.author.course || "—"} · {post.author.yearLevel || "—"}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Visibility badge — shown for ALL viewers */}
          {post.visibility ? (
            <VisibilityBadge visibility={post.visibility} />
          ) : null}
          <Text style={{ fontSize: 11, color: colors.textTertiary }}>{post.createdAt}</Text>
          <Pressable
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Post actions"
            hitSlop={8}
            style={{ paddingHorizontal: 6, paddingVertical: 4, marginLeft: 2 }}
          >
            <MoreVertical size={18} color={colors.textTertiary} />
          </Pressable>
        </View>
      </View>

      {/* Content: title + primary text */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
        {primaryTitle ? (
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 5 }}>{primaryTitle}</Text>
        ) : null}
        {primaryText ? (
          <Text numberOfLines={isTextBased ? 0 : 2} style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>{primaryText}</Text>
        ) : null}
      </View>

      <PostImageGallery
        images={imageUrls}
        fallbackImageUrl={imageUrl}
      />

      {/* Type badge + tags */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14, paddingBottom: 12, gap: 6 }}>
        <View style={{ backgroundColor: typeConfig.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: typeConfig.text }}>{typeConfig.label}</Text>
        </View>
        {(post.tags || []).map((tag) => (
          <View key={tag} style={{ backgroundColor: colors.surfaceSunken, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>#{tag}</Text>
          </View>
        ))}
      </View>

      {/* Website / Link Preview Card */}
      {post.preview_metadata ? (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation?.();
            const target = post.preview_metadata?.url || post.previewUrl;
            if (target) Linking.openURL(target);
          }}
          activeOpacity={0.85}
          style={{
            marginHorizontal: 14,
            marginBottom: 12,
            backgroundColor: colors.surfaceSunken,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          {post.preview_metadata.image ? (
            <Image
              source={{ uri: post.preview_metadata.image }}
              style={{ width: "100%", height: 160, backgroundColor: colors.surfaceSunken }}
              resizeMode="cover"
            />
          ) : null}
          <View style={{ padding: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <ExternalLink size={13} color={colors.action} />
              <Text
                numberOfLines={1}
                style={{ fontSize: 12, color: colors.action, fontWeight: "700", marginLeft: 6, flex: 1 }}
              >
                {post.preview_metadata.siteName || post.preview_metadata.url}
              </Text>
            </View>
            {post.preview_metadata.title ? (
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 }}>
                {post.preview_metadata.title}
              </Text>
            ) : null}
            {post.preview_metadata.description ? (
              <Text numberOfLines={2} style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                {post.preview_metadata.description}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      ) : post.previewUrl ? (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); Linking.openURL(post.previewUrl!); }}
          activeOpacity={0.8}
          style={{ marginHorizontal: 14, marginBottom: 12, backgroundColor: colors.actionSurface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center" }}
        >
          <ExternalLink size={13} color={colors.action} />
          <Text numberOfLines={1} style={{ fontSize: 12, color: colors.action, fontWeight: "600", marginLeft: 6, flex: 1 }}>{post.previewUrl}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: colors.divider }} />

      {/* Actions — likes/comments do not apply to thesis deposits */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 6 }}>
        {post.type !== "thesis" && (
          <>
            <Animated.View style={animatedStyle}>
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation?.(); handleLike(); }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={liked ? "Unlike this post" : "Like this post"}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, minHeight: 44 }}
              >
                <Heart size={18} color={liked ? colors.destructive : colors.textTertiary} fill={liked ? colors.destructive : "transparent"} strokeWidth={2} />
                <Text style={{ fontSize: 12, color: liked ? colors.destructive : colors.textTertiary, marginLeft: 5, fontWeight: "600" }}>{likeCount}</Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                setShowComments((v) => !v);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open comments"
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, minHeight: 44 }}
            >
              <MessageCircle
                size={18}
                color={showComments ? colors.action : colors.textTertiary}
                strokeWidth={2}
              />
              <Text
                style={{
                  fontSize: 12,
                  color: showComments ? colors.action : colors.textTertiary,
                  marginLeft: 5,
                  fontWeight: "600",
                }}
              >
                {commentsCount}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation?.();
            const target = post.previewUrl || post.preview_metadata?.url;
            if (target) Linking.openURL(target);
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Share this post"
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, minHeight: 44 }}
        >
          <Share2 size={18} color={colors.textTertiary} strokeWidth={2} />
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 5, fontWeight: "600" }}>Share</Text>
        </TouchableOpacity>
      </View>
      {/* Inline Comments Drawer */}
      {showComments && (
        <InlineCommentsDrawer
          postId={post.id}
          initialCount={commentsCount}
          onCountChange={(newCount) => setCommentsCount(newCount)}
        />
      )}

      {/* Dialogs */}
      {menuOpen ? (
        <PostMenu
          post={post}
          onClose={() => setMenuOpen(false)}
          onEdit={isOwner ? handleEdit : undefined}
          onDelete={isOwner ? handleDelete : undefined}
          onRepost={handleRepost}
          onReport={() => setReportDialogOpen(true)}
          onBlock={() => setBlockDialogOpen(true)}
          onSave={handleToggleSave}
          isSaved={isSaved}
        />
      ) : null}
      <RepostDialog
        postId={post.id}
        isOpen={repostDialogOpen}
        onClose={() => setRepostDialogOpen(false)}
        onSuccess={handleRepostSuccess}
      />
      <ReportDialog
        targetType="post"
        targetId={post.id}
        isOpen={reportDialogOpen}
        onClose={() => setReportDialogOpen(false)}
        onSuccess={handleReportSuccess}
      />
      <BlockConfirmDialog
        targetUserId={post.author.id}
        targetUserName={post.author.name}
        isOpen={blockDialogOpen}
        onClose={() => setBlockDialogOpen(false)}
        onBlocked={handleBlockSuccess}
      />
    </TouchableOpacity>

    <Modal
      visible={confirmDelete}
      onClose={() => {
        if (!deleting) setConfirmDelete(false);
      }}
      maxWidth={440}
      accessibilityLabel="Delete confirmation"
    >
      <View style={{ padding: SPACE.x6 }}>
        <Text style={{ ...TYPE.h2, color: colors.textPrimary }}>
          {post.type === "thesis" ? "Delete thesis?" : "Delete post?"}
        </Text>
        <Text style={{ ...TYPE.body, color: colors.textSecondary, marginTop: SPACE.x2 }}>
          {post.type === "thesis"
            ? "This removes the deposit from the repository and cannot be undone."
            : "This removes the post for everyone and cannot be undone."}
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: SPACE.x3, marginTop: SPACE.x5 }}>
          <Button
            label="Cancel"
            variant="secondary"
            onPress={() => setConfirmDelete(false)}
            disabled={deleting}
          />
          <Button
            label={post.type === "thesis" ? "Delete thesis" : "Delete post"}
            variant="danger"
            onPress={() => void performDelete()}
            loading={deleting}
          />
        </View>
      </View>
    </Modal>

    <Modal
      visible={!!notice}
      onClose={() => setNotice(null)}
      maxWidth={420}
      accessibilityLabel="Notice"
    >
      <View style={{ padding: SPACE.x6 }}>
        <Text style={{ ...TYPE.h2, color: colors.textPrimary }}>Notice</Text>
        <Text style={{ ...TYPE.body, color: colors.textSecondary, marginTop: SPACE.x2 }}>
          {notice}
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: SPACE.x5 }}>
          <Button label="Got it" onPress={() => setNotice(null)} />
        </View>
      </View>
    </Modal>
  </>
  );
}