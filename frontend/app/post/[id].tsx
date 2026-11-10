import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  TextInput,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  ExternalLink,
  Send,
  Tag,
  Calendar,
  Pencil,
  Trash2,
  MoreVertical,
} from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { focusRing, RADIUS, SPACE, TYPE, type ThemeTokens } from "../../src/lib/tokens";
import { apiFetch, deletePost, updateComment, deleteComment, getPostImageUrl } from "../../src/lib/api";
import { safeBack } from "../../src/lib/navigation";
import Button, { IconButton } from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import Modal from "../../src/components/ui/Modal";
import EmptyState from "../../src/components/admin/EmptyState";

function getTypeConfig(
  type: string,
  colors: ThemeTokens
): { label: string; bg: string; text: string } {
  const configs: Record<string, { label: string; bg: string; text: string }> = {
    website: { label: "Website", bg: colors.badgeWebsiteBg, text: colors.badgeWebsiteText },
    thesis: { label: "Thesis", bg: colors.badgeThesisBg, text: colors.badgeThesisText },
    capstone: { label: "Capstone", bg: colors.badgeCapstoneBg, text: colors.badgeCapstoneText },
    project: { label: "Project", bg: colors.badgeProjectBg, text: colors.badgeProjectText },
    text: { label: "Update", bg: colors.badgeUpdateBg, text: colors.badgeUpdateText },
    image: { label: "Image", bg: colors.badgeImageBg, text: colors.badgeImageText },
  };
  return configs[type] || configs["text"];
}

function getInitials(name?: string | null) {
  if (!name) return "??";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const isGuest = profile?.role === "guest";

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [commentMenuId, setCommentMenuId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const [confirmDeletePost, setConfirmDeletePost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<any>(null);
  const [deletingComment, setDeletingComment] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await apiFetch(`/posts/${id}`);
        if (res.ok) {
          const postData = await res.json();
          if (postData) {
            const authorName = postData.author?.full_name || "Unknown User";
            setPost({
              id: postData.id,
              author: {
                id: postData.author_id,
                name: authorName,
                initials: authorName
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase(),
                course: postData.author?.department_name || "—",
                yearLevel: postData.author?.year_level || "—",
              },
              title: postData.title || "Post Update",
              description: postData.content || postData.description || "",
              type: postData.type || "text",
              tags: postData.technologies || postData.tags || [],
              previewUrl: postData.github_url || postData.preview_url,
              imageUrl: postData.image_url,
              preview_metadata: postData.preview_metadata || null,
              likes: postData.likes || 0,
              comments: postData.comments || 0,
              createdAt: new Date(postData.created_at).toLocaleDateString(),
              isLiked: Boolean(postData.is_liked),
              visibility: postData.visibility,
            });
            setLikeCount(postData.likes || 0);
            setLiked(Boolean(postData.is_liked));

            if (postData.image_url) {
              getPostImageUrl(postData.id)
                .then(setImageUrl)
                .catch(() => setImageUrl(undefined));
            }
          }
        }

        const resComments = await apiFetch(`/posts/${id}/comments`);
        if (resComments.ok) {
          const commentsData = await resComments.json();
          if (commentsData) {
            setComments(
              commentsData.map((c: any) => {
                const cName = c.user?.full_name || "Unknown User";
                return {
                  id: c.id,
                  userId: c.user_id,
                  author: cName,
                  initials: getInitials(cName),
                  text: c.content,
                  time: new Date(c.created_at).toLocaleDateString(),
                };
              })
            );
          }
        }
      } catch (err) {
        console.error("Failed to load post from backend:", err);
      }

      setLoading(false);
    };

    if (id) fetchDetails();
  }, [id]);

  const handleLike = async () => {
    if (!profile?.id || isGuest) {
      setNotice("Please sign in with your institutional account to like posts.");
      return;
    }
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withSequence(
      withTiming(1.4, { duration: 110 }),
      withTiming(0.85, { duration: 80 }),
      withTiming(1, { duration: 110 })
    );
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(newLiked ? likeCount + 1 : likeCount - 1);

    try {
      await apiFetch(`/posts/${post.id}/like`, { method: "POST" });
    } catch (err) {
      console.error("Failed to toggle like via backend:", err);
    }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !profile?.id) return;

    const text = commentText.trim();
    setCommentText("");

    const newComment = {
      id: String(Date.now()),
      userId: profile.id,
      author: profile.full_name || "You",
      initials: getInitials(profile.full_name || "You"),
      text,
      time: "Just now",
    };
    setComments([newComment, ...comments]);

    try {
      await apiFetch(`/posts/${post.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: text }),
      });
    } catch (err) {
      console.error("Failed to post comment via backend:", err);
    }
  };

  const startEditComment = (c: any) => {
    setCommentMenuId(null);
    setEditingCommentId(c.id);
    setEditingText(c.text);
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingText("");
  };

  const handleSaveComment = async (c: any) => {
    const text = editingText.trim();
    if (!text || text === c.text) {
      cancelEditComment();
      return;
    }
    try {
      const updated: any = await updateComment(post.id, c.id, text);
      setComments((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, text: updated?.content ?? text } : item))
      );
      cancelEditComment();
    } catch (e: any) {
      setNotice(e.message || "Failed to update comment");
    }
  };

  const handleDeleteComment = (c: any) => {
    setCommentMenuId(null);
    setCommentToDelete(c);
  };

  const performDeleteComment = async () => {
    if (!commentToDelete) return;
    setDeletingComment(true);
    try {
      await deleteComment(post.id, commentToDelete.id);
      setComments((prev) => prev.filter((item) => item.id !== commentToDelete.id));
      setCommentToDelete(null);
    } catch (e: any) {
      setCommentToDelete(null);
      setNotice(e.message || "Failed to delete comment");
    } finally {
      setDeletingComment(false);
    }
  };

  const isOwner = !!profile?.id && !!post && profile.id === post.author.id;

  const handleEdit = () => {
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

  const performDeletePost = async () => {
    setDeletingPost(true);
    try {
      await deletePost(post.id);
      setConfirmDeletePost(false);
      safeBack("/(tabs)");
    } catch (e: any) {
      setConfirmDeletePost(false);
      setNotice(e.message || "Failed to delete post");
    } finally {
      setDeletingPost(false);
    }
  };

  if (!post && loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.surfacePage, alignItems: "center", justifyContent: "center" }}
        edges={["top"]}
      >
        <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.surfacePage, alignItems: "center", justifyContent: "center", padding: SPACE.x6 }}
        edges={["top"]}
      >
        <Card style={{ alignItems: "center", padding: SPACE.x8, maxWidth: 380, width: "100%" }}>
          <EmptyState
            icon={MessageCircle}
            tone="neutral"
            compact
            title="Post not found"
            body="It may have been removed or you may not have access."
            actionLabel="Back to feed"
            onAction={() => safeBack("/(tabs)")}
          />
        </Card>
      </SafeAreaView>
    );
  }

  const typeConfig = getTypeConfig(post.type, colors);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.x3,
          paddingHorizontal: SPACE.x4,
          minHeight: 60,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          backgroundColor: colors.panel,
        }}
      >
        <IconButton icon={ArrowLeft} label="Back" variant="ghost" onPress={() => safeBack("/(tabs)")} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>Post</Text>
          <Text style={{ ...TYPE.title, color: colors.ink }} numberOfLines={1}>
            {post.title}
          </Text>
        </View>
        {isOwner && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2 }}>
            <IconButton icon={Pencil} label="Edit post" variant="secondary" onPress={handleEdit} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete post"
              onPress={() => setConfirmDeletePost(true)}
              onFocus={() => {}}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: RADIUS.md,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.destructiveSurface,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Trash2 size={18} color={colors.destructive} />
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View
          style={{
            width: "100%",
            maxWidth: 760,
            alignSelf: "center",
            padding: SPACE.x4,
            paddingBottom: SPACE.x10,
          }}
        >
          {/* Post card */}
          <Card padding={0} style={{ overflow: "hidden" }}>
            <View style={{ flexDirection: "row", alignItems: "center", padding: SPACE.x4 }}>
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: colors.brandWash,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: SPACE.x3,
                }}
              >
                <Text style={{ fontSize: 17, fontWeight: "800", color: colors.brand }}>
                  {post.author.initials}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ ...TYPE.bodyStrong, fontWeight: "700", color: colors.ink }} numberOfLines={1}>
                  {post.author.name}
                </Text>
                <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 2 }} numberOfLines={1}>
                  {post.author.course} · {post.author.yearLevel}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x1 }}>
                <Calendar size={13} color={colors.inkFaint} />
                <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>{post.createdAt}</Text>
              </View>
            </View>

            <View style={{ paddingHorizontal: SPACE.x4, marginBottom: SPACE.x3 }}>
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: typeConfig.bg,
                  paddingHorizontal: SPACE.x3,
                  paddingVertical: 5,
                  borderRadius: RADIUS.pill,
                }}
              >
                <Text style={{ ...TYPE.micro, fontSize: 9, color: typeConfig.text }}>
                  {typeConfig.label}
                </Text>
              </View>
            </View>

            <Text
              style={{
                ...TYPE.h2,
                color: colors.ink,
                paddingHorizontal: SPACE.x4,
                marginBottom: SPACE.x2,
              }}
            >
              {post.title}
            </Text>
            {post.description ? (
              <Text
                style={{
                  ...TYPE.body,
                  color: colors.inkSoft,
                  paddingHorizontal: SPACE.x4,
                  marginBottom: SPACE.x4,
                  lineHeight: 23,
                }}
              >
                {post.description}
              </Text>
            ) : (
              <View style={{ height: SPACE.x2 }} />
            )}

            {imageUrl ? (
              <View style={{ paddingHorizontal: SPACE.x4, marginBottom: SPACE.x4 }}>
                <Image
                  source={{ uri: imageUrl }}
                  style={{
                    width: "100%",
                    height: 250,
                    borderRadius: RADIUS.lg,
                    backgroundColor: colors.surfaceSunken,
                  }}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {(post.tags || []).length > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  paddingHorizontal: SPACE.x4,
                  marginBottom: SPACE.x4,
                  gap: SPACE.x2,
                  alignItems: "center",
                }}
              >
                <Tag size={14} color={colors.inkFaint} />
                {(post.tags || []).map((tag: string) => (
                  <View
                    key={tag}
                    style={{
                      backgroundColor: colors.surfaceSunken,
                      paddingHorizontal: SPACE.x2,
                      paddingVertical: 4,
                      borderRadius: RADIUS.pill,
                      borderWidth: 1,
                      borderColor: colors.line,
                    }}
                  >
                    <Text style={{ ...TYPE.caption, color: colors.inkSoft, fontWeight: "500" }}>
                      #{tag}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Link preview */}
            {post.preview_metadata ? (
              <Pressable
                onPress={() => {
                  const target = post.preview_metadata?.url || post.previewUrl;
                  if (target) Linking.openURL(target);
                }}
                accessibilityRole="link"
                accessibilityLabel={`Open ${post.preview_metadata.siteName || post.preview_metadata.url}`}
                style={({ pressed }) => ({
                  marginHorizontal: SPACE.x4,
                  marginBottom: SPACE.x4,
                  backgroundColor: colors.surfaceSunken,
                  borderRadius: RADIUS.lg,
                  borderWidth: 1,
                  borderColor: colors.line,
                  overflow: "hidden",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                {post.preview_metadata.image ? (
                  <Image
                    source={{ uri: post.preview_metadata.image }}
                    style={{ width: "100%", height: 180, backgroundColor: colors.surfaceSunken }}
                    resizeMode="cover"
                  />
                ) : null}
                <View style={{ padding: SPACE.x3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                    <ExternalLink size={14} color={colors.brand} />
                    <Text
                      numberOfLines={1}
                      style={{ ...TYPE.caption, color: colors.brand, fontWeight: "700", marginLeft: 6, flex: 1 }}
                    >
                      {post.preview_metadata.siteName || post.preview_metadata.url}
                    </Text>
                  </View>
                  {post.preview_metadata.title ? (
                    <Text
                      numberOfLines={2}
                      style={{ ...TYPE.bodyStrong, fontWeight: "700", color: colors.ink, marginBottom: 4 }}
                    >
                      {post.preview_metadata.title}
                    </Text>
                  ) : null}
                  {post.preview_metadata.description ? (
                    <Text
                      numberOfLines={3}
                      style={{ ...TYPE.caption, color: colors.inkSoft, lineHeight: 18, marginBottom: SPACE.x2 }}
                    >
                      {post.preview_metadata.description}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      alignSelf: "flex-start",
                      backgroundColor: colors.brandSolid,
                      paddingHorizontal: SPACE.x3,
                      paddingVertical: 6,
                      borderRadius: RADIUS.sm,
                    }}
                  >
                    <Text style={{ color: colors.textOnBrandSolid, fontSize: 12, fontWeight: "700" }}>
                      Visit website
                    </Text>
                  </View>
                </View>
              </Pressable>
            ) : post.previewUrl ? (
              <Pressable
                onPress={() => Linking.openURL(post.previewUrl!)}
                accessibilityRole="link"
                accessibilityLabel="Open live project"
                style={({ pressed }) => ({
                  marginHorizontal: SPACE.x4,
                  marginBottom: SPACE.x4,
                  backgroundColor: colors.brandWash,
                  borderRadius: RADIUS.lg,
                  borderWidth: 1,
                  borderColor: colors.line,
                  padding: SPACE.x3,
                  flexDirection: "row",
                  alignItems: "center",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: RADIUS.md,
                    backgroundColor: colors.panel,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: SPACE.x3,
                  }}
                >
                  <ExternalLink size={18} color={colors.brand} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...TYPE.caption, fontWeight: "700", color: colors.brand }}>
                    View live project
                  </Text>
                  <Text numberOfLines={1} style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 2 }}>
                    {post.previewUrl}
                  </Text>
                </View>
              </Pressable>
            ) : null}

            <View style={{ height: 1, backgroundColor: colors.line }} />

            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.x2, paddingVertical: SPACE.x1 }}>
              <Animated.View style={animatedStyle}>
                <Pressable
                  onPress={handleLike}
                  accessibilityRole="button"
                  accessibilityLabel={liked ? "Unlike post" : "Like post"}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.x2,
                    paddingHorizontal: SPACE.x3,
                    minHeight: 44,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Heart
                    size={20}
                    color={liked ? colors.destructive : colors.inkFaint}
                    fill={liked ? colors.destructive : "transparent"}
                    strokeWidth={2}
                  />
                  <Text
                    style={{
                      ...TYPE.caption,
                      color: liked ? colors.destructive : colors.inkFaint,
                      fontWeight: "600",
                    }}
                  >
                    {likeCount}
                  </Text>
                </Pressable>
              </Animated.View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Comments"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.x2,
                  paddingHorizontal: SPACE.x3,
                  minHeight: 44,
                }}
              >
                <MessageCircle size={20} color={colors.inkFaint} strokeWidth={2} />
                <Text style={{ ...TYPE.caption, color: colors.inkFaint, fontWeight: "600" }}>
                  {comments.length + post.comments}
                </Text>
              </Pressable>

              <View style={{ flex: 1 }} />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share post"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.x2,
                  paddingHorizontal: SPACE.x3,
                  minHeight: 44,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Share2 size={20} color={colors.inkFaint} strokeWidth={2} />
                <Text style={{ ...TYPE.caption, color: colors.inkFaint, fontWeight: "600" }}>Share</Text>
              </Pressable>
            </View>
          </Card>

          {/* Comments */}
          <View style={{ marginTop: SPACE.x6 }}>
            <Text style={{ ...TYPE.title, color: colors.ink, marginBottom: SPACE.x3 }}>
              Comments ({comments.length + post.comments})
            </Text>

            {isGuest ? (
              <View
                style={{
                  backgroundColor: colors.brandWash,
                  borderRadius: RADIUS.lg,
                  padding: SPACE.x3,
                  marginBottom: SPACE.x5,
                  borderWidth: 1,
                  borderColor: colors.line,
                }}
              >
                <Text
                  style={{ ...TYPE.caption, color: colors.brand, textAlign: "center", fontWeight: "600" }}
                >
                  Browsing as guest. Sign in with your school account to comment.
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACE.x5, gap: SPACE.x2 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.brandWash,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "800", color: colors.brand }}>
                    {getInitials(profile?.full_name)}
                  </Text>
                </View>
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Write a comment…"
                  placeholderTextColor={colors.inkFaint}
                  onFocus={() => setComposerFocused(true)}
                  onBlur={() => setComposerFocused(false)}
                  accessibilityLabel="Write a comment"
                  style={[
                    {
                      flex: 1,
                      backgroundColor: colors.panel,
                      borderRadius: RADIUS.pill,
                      borderWidth: 1,
                      borderColor: composerFocused ? colors.brand : colors.line,
                      paddingHorizontal: SPACE.x4,
                      minHeight: 44,
                      fontSize: 14,
                      color: colors.ink,
                      outlineStyle: "none",
                    } as any,
                    focusRing(colors, composerFocused),
                  ]}
                />
                <Pressable
                  onPress={handleComment}
                  disabled={!commentText.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Post comment"
                  accessibilityState={{ disabled: !commentText.trim() }}
                  style={({ pressed }) => ({
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: commentText.trim() ? colors.brandSolid : colors.surfaceSunken,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Send size={17} color={commentText.trim() ? colors.textOnBrandSolid : colors.inkFaint} />
                </Pressable>
              </View>
            )}

            {comments.length === 0 ? (
              <Card>
                <EmptyState
                  icon={MessageCircle}
                  tone="neutral"
                  compact
                  title="No comments yet"
                  body="Start the conversation by sharing your thoughts."
                />
              </Card>
            ) : (
              <View style={{ gap: SPACE.x3 }}>
                {comments.map((c) => {
                  const isCommentOwner = !!profile?.id && profile.id === c.userId;
                  const isEditingComment = editingCommentId === c.id;
                  const isMenuOpen = commentMenuId === c.id;
                  return (
                    <View key={c.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: SPACE.x3 }}>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: colors.brandWash,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "800", color: colors.brand }}>
                          {c.initials}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View
                          style={{
                            backgroundColor: colors.panel,
                            borderRadius: RADIUS.lg,
                            padding: SPACE.x3,
                            borderWidth: 1,
                            borderColor: colors.line,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 4,
                              gap: SPACE.x2,
                            }}
                          >
                            <Text
                              style={{ ...TYPE.caption, fontWeight: "700", color: colors.ink, flex: 1 }}
                              numberOfLines={1}
                            >
                              {c.author}
                            </Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x1 }}>
                              <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>{c.time}</Text>
                              {isCommentOwner && (
                                <Pressable
                                  onPress={() => setCommentMenuId(isMenuOpen ? null : c.id)}
                                  accessibilityRole="button"
                                  accessibilityLabel="Comment options"
                                  hitSlop={8}
                                  style={({ pressed }) => ({
                                    padding: 4,
                                    opacity: pressed ? 0.6 : 1,
                                  })}
                                >
                                  <MoreVertical size={14} color={colors.inkFaint} />
                                </Pressable>
                              )}
                            </View>
                          </View>
                          {isEditingComment ? (
                            <View>
                              <TextInput
                                value={editingText}
                                onChangeText={setEditingText}
                                multiline
                                autoFocus
                                placeholder="Edit your comment…"
                                placeholderTextColor={colors.inkFaint}
                                accessibilityLabel="Edit comment"
                                style={{
                                  backgroundColor: colors.surfaceSunken,
                                  borderRadius: RADIUS.md,
                                  borderWidth: 1,
                                  borderColor: colors.line,
                                  paddingHorizontal: SPACE.x3,
                                  paddingVertical: SPACE.x2,
                                  fontSize: 13,
                                  color: colors.ink,
                                  outlineStyle: "none",
                                } as any}
                              />
                              <View
                                style={{
                                  flexDirection: "row",
                                  justifyContent: "flex-end",
                                  marginTop: SPACE.x2,
                                  alignItems: "center",
                                  gap: SPACE.x2,
                                }}
                              >
                                <Button label="Cancel" variant="ghost" size="sm" onPress={cancelEditComment} />
                                <Button
                                  label="Save"
                                  size="sm"
                                  onPress={() => handleSaveComment(c)}
                                  disabled={!editingText.trim()}
                                />
                              </View>
                            </View>
                          ) : (
                            <Text style={{ ...TYPE.caption, color: colors.inkSoft, lineHeight: 20 }}>
                              {c.text}
                            </Text>
                          )}
                        </View>

                        {isCommentOwner && isMenuOpen && !isEditingComment && (
                          <View
                            style={{
                              marginTop: SPACE.x2,
                              backgroundColor: colors.panel,
                              borderRadius: RADIUS.md,
                              borderWidth: 1,
                              borderColor: colors.line,
                              overflow: "hidden",
                            }}
                          >
                            <Pressable
                              onPress={() => startEditComment(c)}
                              accessibilityRole="button"
                              accessibilityLabel="Edit comment"
                              style={({ pressed }) => ({
                                flexDirection: "row",
                                alignItems: "center",
                                gap: SPACE.x2,
                                paddingHorizontal: SPACE.x3,
                                minHeight: 40,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.line,
                                backgroundColor: pressed ? colors.surfaceSunken : "transparent",
                              })}
                            >
                              <Pencil size={14} color={colors.brand} />
                              <Text style={{ ...TYPE.caption, color: colors.brand, fontWeight: "600" }}>
                                Edit comment
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => handleDeleteComment(c)}
                              accessibilityRole="button"
                              accessibilityLabel="Delete comment"
                              style={({ pressed }) => ({
                                flexDirection: "row",
                                alignItems: "center",
                                gap: SPACE.x2,
                                paddingHorizontal: SPACE.x3,
                                minHeight: 40,
                                backgroundColor: pressed ? colors.surfaceSunken : "transparent",
                              })}
                            >
                              <Trash2 size={14} color={colors.destructive} />
                              <Text
                                style={{ ...TYPE.caption, color: colors.destructive, fontWeight: "600" }}
                              >
                                Delete comment
                              </Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Delete post dialog */}
      <Modal
        visible={confirmDeletePost}
        onClose={() => {
          if (!deletingPost) setConfirmDeletePost(false);
        }}
        maxWidth={440}
        accessibilityLabel="Delete post confirmation"
      >
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>Delete post?</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
            This removes the post and its comments for everyone. This cannot be undone.
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: SPACE.x3,
              marginTop: SPACE.x5,
            }}
          >
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => setConfirmDeletePost(false)}
              disabled={deletingPost}
            />
            <Button
              label="Delete post"
              variant="danger"
              onPress={() => void performDeletePost()}
              loading={deletingPost}
            />
          </View>
        </View>
      </Modal>

      {/* Delete comment dialog */}
      <Modal
        visible={!!commentToDelete}
        onClose={() => {
          if (!deletingComment) setCommentToDelete(null);
        }}
        maxWidth={440}
        accessibilityLabel="Delete comment confirmation"
      >
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>Delete comment?</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
            This comment will be removed permanently.
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: SPACE.x3,
              marginTop: SPACE.x5,
            }}
          >
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => setCommentToDelete(null)}
              disabled={deletingComment}
            />
            <Button
              label="Delete comment"
              variant="danger"
              onPress={() => void performDeleteComment()}
              loading={deletingComment}
            />
          </View>
        </View>
      </Modal>

      {/* Notice dialog */}
      <Modal
        visible={!!notice}
        onClose={() => setNotice(null)}
        maxWidth={420}
        accessibilityLabel="Notice"
      >
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>Notice</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>{notice}</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: SPACE.x5 }}>
            <Button label="Got it" onPress={() => setNotice(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
