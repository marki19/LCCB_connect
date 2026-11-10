import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  StyleSheet,
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
  X,
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
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { elevation, focusRing, RADIUS, SPACE, TYPE, type ThemeTokens } from "../../src/lib/tokens";
import {
  apiFetch,
  deletePost,
  updateComment,
  deleteComment,
  getPostImageUrl,
  getPostImageUrls,
} from "../../src/lib/api";
import { safeBack } from "../../src/lib/navigation";
import Button, { IconButton } from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import Modal from "../../src/components/ui/Modal";
import EmptyState from "../../src/components/admin/EmptyState";
import { PostImageGallery } from "../../src/components/PostImageGallery";

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
    discussion: { label: "Discussion", bg: colors.badgeDiscussionBg, text: colors.badgeDiscussionText },
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
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1024;
  const isGuest = profile?.role === "guest";

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

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

  const inputRef = useRef<any>(null);
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
            const initialUrls =
              Array.isArray(postData.image_urls) && postData.image_urls.length > 0
                ? postData.image_urls
                : postData.image_url
                ? [postData.image_url]
                : [];

            setPost({
              id: postData.id,
              author: {
                id: postData.author_id,
                name: authorName,
                initials: getInitials(authorName),
                course: postData.author?.department_name || "—",
                yearLevel: postData.author?.year_level || "—",
              },
              title: postData.title || "Post Update",
              description: postData.content || postData.description || "",
              type: postData.type || "text",
              tags: postData.technologies || postData.tags || [],
              previewUrl: postData.github_url || postData.preview_url,
              imageUrl: postData.image_url,
              image_urls: initialUrls,
              preview_metadata: postData.preview_metadata || null,
              likes: postData.likes || 0,
              comments: postData.comments || 0,
              createdAt: new Date(postData.created_at).toLocaleDateString(),
              isLiked: Boolean(postData.is_liked),
              visibility: postData.visibility,
            });

            setImageUrls(initialUrls);
            setLikeCount(postData.likes || 0);
            setLiked(Boolean(postData.is_liked));

            // Fetch signed URLs for private post images
            const hasImages = initialUrls.length > 0 || Boolean(postData.image_url);
            if (hasImages) {
              getPostImageUrls(postData.id)
                .then((urls) => {
                  if (urls.length > 0) {
                    setImageUrls(urls);
                    setImageUrl(urls[0]);
                  }
                })
                .catch(() => {
                  if (postData.image_url) {
                    getPostImageUrl(postData.id)
                      .then(setImageUrl)
                      .catch(() => setImageUrl(undefined));
                  }
                });
            }
          }
        }

        const resComments = await apiFetch(`/posts/${id}/comments`);
        if (resComments.ok) {
          const commentsData = await resComments.json();
          if (Array.isArray(commentsData)) {
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

    if (profile?.role === "student" && !profile?.profile_completed) {
      setNotice("Please complete your student profile (full name, student ID, department, course) before commenting.");
      return;
    }

    const text = commentText.trim();
    setCommentText("");
    const tempId = "temp-" + Date.now();

    const newComment = {
      id: tempId,
      userId: profile.id,
      author: profile.full_name || profile.username || "You",
      initials: getInitials(profile.full_name || profile.username || "You"),
      text,
      time: "Just now",
    };
    setComments((prev) => [newComment, ...prev]);

    try {
      const res = await apiFetch(`/posts/${post.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: text }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        // Revert optimistic comment
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setCommentText(text); // restore input text
        if (res.status === 403) {
          setNotice("You cannot comment yet. Your account must be verified or your profile completed.");
        } else {
          setNotice(errorData.error || `Failed to post comment (${res.status})`);
        }
        return;
      }

      const created = await res.json().catch(() => null);
      if (created?.id) {
        setComments((prev) =>
          prev.map((c) => (c.id === tempId ? { ...c, id: created.id } : c))
        );
      }
    } catch (err: any) {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setCommentText(text);
      setNotice(err.message || "Failed to post comment via network");
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

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfacePage,
        }}
      >
        <ActivityIndicator size="small" color={colors.brand} />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfacePage,
          padding: SPACE.x6,
        }}
      >
        <Text style={{ ...TYPE.h2, color: colors.ink, marginBottom: SPACE.x2 }}>
          Post not found
        </Text>
        <Text style={{ ...TYPE.body, color: colors.inkSoft, marginBottom: SPACE.x5 }}>
          This post may have been removed or does not exist.
        </Text>
        <Button label="Back to Feed" onPress={() => safeBack("/(tabs)")} />
      </SafeAreaView>
    );
  }

  const typeConfig = getTypeConfig(post.type, colors);
  const mediaList = imageUrls.length > 0 ? imageUrls : imageUrl ? [imageUrl] : [];
  const currentMedia = mediaList[activeMediaIndex] || mediaList[0];

  // ─── RIGHT SIDEBAR CONTENT (Author, content, comments, composer) ─────────
  const renderSidebar = () => (
    <View
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: colors.panel,
        height: "100%",
      }}
    >
      {/* Top Author Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: SPACE.x4,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.brandWash,
            alignItems: "center",
            justifyContent: "center",
            marginRight: SPACE.x3,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.brand }}>
            {post.author.initials}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ ...TYPE.bodyStrong, fontWeight: "700", color: colors.ink }}
            numberOfLines={1}
          >
            {post.author.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            <Text style={{ ...TYPE.caption, color: colors.inkFaint }} numberOfLines={1}>
              {post.createdAt} · {post.author.course}
            </Text>
          </View>
        </View>

        {isOwner ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x1 }}>
            <IconButton icon={Pencil} label="Edit post" variant="ghost" onPress={handleEdit} />
            <IconButton
              icon={Trash2}
              label="Delete post"
              variant="ghost"
              onPress={() => setConfirmDeletePost(true)}
            />
          </View>
        ) : null}
      </View>

      {/* Middle Scrollable Body */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: SPACE.x4, paddingBottom: SPACE.x6 }}
        style={{ flex: 1 }}
      >
        {/* Type Badge & Title */}
        <View style={{ marginBottom: SPACE.x2 }}>
          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: typeConfig.bg,
              paddingHorizontal: SPACE.x3,
              paddingVertical: 4,
              borderRadius: RADIUS.pill,
              marginBottom: SPACE.x2,
            }}
          >
            <Text style={{ ...TYPE.micro, fontSize: 10, color: typeConfig.text }}>
              {typeConfig.label}
            </Text>
          </View>
          <Text style={{ ...TYPE.h2, color: colors.ink, lineHeight: 26 }}>{post.title}</Text>
        </View>

        {/* Post Description */}
        {post.description ? (
          <Text
            style={{
              ...TYPE.body,
              color: colors.inkSoft,
              marginBottom: SPACE.x4,
              lineHeight: 22,
            }}
          >
            {post.description}
          </Text>
        ) : null}

        {/* Tech Tags */}
        {(post.tags || []).length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginBottom: SPACE.x4,
              gap: SPACE.x2,
              alignItems: "center",
            }}
          >
            <Tag size={13} color={colors.inkFaint} />
            {(post.tags || []).map((tag: string) => (
              <View
                key={tag}
                style={{
                  backgroundColor: colors.surfaceSunken,
                  paddingHorizontal: SPACE.x2,
                  paddingVertical: 3,
                  borderRadius: RADIUS.pill,
                  borderWidth: 1,
                  borderColor: colors.line,
                }}
              >
                <Text style={{ ...TYPE.caption, color: colors.inkSoft, fontSize: 11, fontWeight: "500" }}>
                  #{tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Link / Metadata Card */}
        {post.preview_metadata ? (
          <Pressable
            onPress={() => {
              const target = post.preview_metadata?.url || post.previewUrl;
              if (target) Linking.openURL(target);
            }}
            accessibilityRole="link"
            accessibilityLabel={`Open ${post.preview_metadata.siteName || post.preview_metadata.url}`}
            style={({ pressed }) => ({
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
                style={{ width: "100%", height: 160, backgroundColor: colors.surfaceSunken }}
                resizeMode="cover"
              />
            ) : null}
            <View style={{ padding: SPACE.x3 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <ExternalLink size={13} color={colors.brand} />
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
            </View>
          </Pressable>
        ) : post.previewUrl ? (
          <Pressable
            onPress={() => Linking.openURL(post.previewUrl!)}
            accessibilityRole="link"
            accessibilityLabel="Open live project"
            style={({ pressed }) => ({
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
                width: 32,
                height: 32,
                borderRadius: RADIUS.md,
                backgroundColor: colors.panel,
                alignItems: "center",
                justifyContent: "center",
                marginRight: SPACE.x3,
              }}
            >
              <ExternalLink size={16} color={colors.brand} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ ...TYPE.caption, fontWeight: "700", color: colors.brand }}>
                View project link
              </Text>
              <Text numberOfLines={1} style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 1 }}>
                {post.previewUrl}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* Engagement Stats Bar */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingVertical: SPACE.x2,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.line,
            marginBottom: SPACE.x2,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: colors.destructive,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Heart size={11} color="#FFFFFF" fill="#FFFFFF" />
            </View>
            <Text style={{ ...TYPE.caption, color: colors.inkFaint, fontWeight: "600" }}>
              {likeCount}
            </Text>
          </View>

          <Text style={{ ...TYPE.caption, color: colors.inkFaint, fontWeight: "500" }}>
            {comments.length} comments
          </Text>
        </View>

        {/* Action Buttons: Like, Comment, Share */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-around",
            paddingVertical: 2,
            borderBottomWidth: 1,
            borderColor: colors.line,
            marginBottom: SPACE.x4,
          }}
        >
          <Animated.View style={animatedStyle}>
            <Pressable
              onPress={handleLike}
              accessibilityRole="button"
              accessibilityLabel={liked ? "Unlike post" : "Like post"}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.x2,
                paddingVertical: SPACE.x2,
                paddingHorizontal: SPACE.x3,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Heart
                size={18}
                color={liked ? colors.destructive : colors.inkSoft}
                fill={liked ? colors.destructive : "transparent"}
                strokeWidth={2}
              />
              <Text
                style={{
                  ...TYPE.caption,
                  color: liked ? colors.destructive : colors.inkSoft,
                  fontWeight: "600",
                }}
              >
                Like
              </Text>
            </Pressable>
          </Animated.View>

          <Pressable
            onPress={() => inputRef.current?.focus()}
            accessibilityRole="button"
            accessibilityLabel="Write a comment"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.x2,
              paddingVertical: SPACE.x2,
              paddingHorizontal: SPACE.x3,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <MessageCircle size={18} color={colors.inkSoft} strokeWidth={2} />
            <Text style={{ ...TYPE.caption, color: colors.inkSoft, fontWeight: "600" }}>
              Comment
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share post"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.x2,
              paddingVertical: SPACE.x2,
              paddingHorizontal: SPACE.x3,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Share2 size={18} color={colors.inkSoft} strokeWidth={2} />
            <Text style={{ ...TYPE.caption, color: colors.inkSoft, fontWeight: "600" }}>
              Share
            </Text>
          </Pressable>
        </View>

        {/* Comments Stream */}
        <View style={{ gap: SPACE.x3 }}>
          {comments.length === 0 ? (
            <View style={{ paddingVertical: SPACE.x6, alignItems: "center" }}>
              <MessageCircle size={28} color={colors.inkFaint} />
              <Text style={{ ...TYPE.bodyStrong, color: colors.inkSoft, marginTop: SPACE.x2 }}>
                No comments yet
              </Text>
              <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 2 }}>
                Be the first to share your thoughts.
              </Text>
            </View>
          ) : (
            comments.map((c) => {
              const isCommentOwner = !!profile?.id && profile.id === c.userId;
              const isEditingComment = editingCommentId === c.id;
              const isMenuOpen = commentMenuId === c.id;

              return (
                <View key={c.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: SPACE.x2 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: colors.brandWash,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 2,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "800", color: colors.brand }}>
                      {c.initials}
                    </Text>
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View
                      style={{
                        backgroundColor: isDark ? colors.surfaceSunken : "#F0F2F5",
                        borderRadius: RADIUS.lg,
                        paddingHorizontal: SPACE.x3,
                        paddingVertical: SPACE.x2,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 2,
                        }}
                      >
                        <Text
                          style={{ ...TYPE.caption, fontWeight: "700", color: colors.ink, flex: 1 }}
                          numberOfLines={1}
                        >
                          {c.author}
                        </Text>
                        {isCommentOwner && (
                          <Pressable
                            onPress={() => setCommentMenuId(isMenuOpen ? null : c.id)}
                            accessibilityRole="button"
                            accessibilityLabel="Comment options"
                            hitSlop={8}
                            style={({ pressed }) => ({ padding: 2, opacity: pressed ? 0.6 : 1 })}
                          >
                            <MoreVertical size={13} color={colors.inkFaint} />
                          </Pressable>
                        )}
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
                              backgroundColor: colors.panel,
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
                        <Text style={{ ...TYPE.caption, color: colors.inkSoft, lineHeight: 18 }}>
                          {c.text}
                        </Text>
                      )}
                    </View>

                    {/* Timestamp & actions under comment bubble */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x3, marginTop: 4, paddingLeft: 6 }}>
                      <Text style={{ ...TYPE.micro, color: colors.inkFaint, fontSize: 10 }}>{c.time}</Text>
                    </View>

                    {/* Owner menu for edit/delete */}
                    {isCommentOwner && isMenuOpen && !isEditingComment && (
                      <View
                        style={{
                          marginTop: 6,
                          backgroundColor: colors.panel,
                          borderRadius: RADIUS.md,
                          borderWidth: 1,
                          borderColor: colors.line,
                          overflow: "hidden",
                          width: 140,
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
                            paddingVertical: 8,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.line,
                            backgroundColor: pressed ? colors.surfaceSunken : "transparent",
                          })}
                        >
                          <Pencil size={12} color={colors.brand} />
                          <Text style={{ ...TYPE.micro, color: colors.brand, fontWeight: "600" }}>
                            Edit
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
                            paddingVertical: 8,
                            backgroundColor: pressed ? colors.surfaceSunken : "transparent",
                          })}
                        >
                          <Trash2 size={12} color={colors.destructive} />
                          <Text style={{ ...TYPE.micro, color: colors.destructive, fontWeight: "600" }}>
                            Delete
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Sticky Bottom Composer */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.line,
          paddingHorizontal: SPACE.x4,
          paddingVertical: SPACE.x3,
          backgroundColor: colors.panel,
        }}
      >
        {profile?.role === "student" && !profile?.profile_completed ? (
          <View
            style={{
              backgroundColor: colors.brandWash,
              borderRadius: RADIUS.md,
              padding: SPACE.x3,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: SPACE.x2,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ ...TYPE.caption, fontWeight: "700", color: colors.brand }}>
                Profile incomplete
              </Text>
              <Text style={{ ...TYPE.micro, color: colors.inkSoft, marginTop: 1 }}>
                Complete your record to comment on posts.
              </Text>
            </View>
            <Button
              label="Complete"
              size="sm"
              onPress={() => router.push("/onboarding")}
            />
          </View>
        ) : isGuest ? (
          <View
            style={{
              backgroundColor: colors.brandWash,
              borderRadius: RADIUS.md,
              padding: SPACE.x3,
              alignItems: "center",
            }}
          >
            <Text style={{ ...TYPE.caption, color: colors.brand, fontWeight: "600" }}>
              Sign in with your campus account to write comments.
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
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
              ref={inputRef}
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
                  backgroundColor: isDark ? colors.surfaceSunken : "#F0F2F5",
                  borderRadius: RADIUS.pill,
                  borderWidth: 1,
                  borderColor: composerFocused ? colors.brand : "transparent",
                  paddingHorizontal: SPACE.x4,
                  minHeight: 40,
                  fontSize: 13,
                  color: colors.ink,
                  outlineStyle: "none",
                } as any,
                focusRing(colors, composerFocused),
              ]}
              onSubmitEditing={() => void handleComment()}
            />

            <Pressable
              onPress={() => void handleComment()}
              disabled={!commentText.trim()}
              accessibilityRole="button"
              accessibilityLabel="Post comment"
              accessibilityState={{ disabled: !commentText.trim() }}
              style={({ pressed }) => ({
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: commentText.trim() ? colors.brandSolid : colors.surfaceSunken,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Send size={15} color={commentText.trim() ? colors.textOnBrandSolid : colors.inkFaint} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );

  // ─── DESKTOP THEATRE LAYOUT (Facebook-Style Split Canvas) ───────────────────
  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#06090F", overflow: "hidden" }}>
        {/* Left Theatre Canvas (Full height dark background with centered media) */}
        <View
          style={{
            flex: 1,
            height: "100%",
            position: "relative",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#06090F",
          }}
        >
          {/* Top-Left Close Button (X in circle) */}
          <Pressable
            onPress={() => safeBack("/(tabs)")}
            accessibilityRole="button"
            accessibilityLabel="Close post viewer"
            style={({ pressed }) => ({
              position: "absolute",
              top: 18,
              left: 18,
              zIndex: 10,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: pressed ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <X size={22} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>

          {/* Centered Media or Presentation Card */}
          {mediaList.length > 0 ? (
            <View style={{ width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>
              <Image
                source={{ uri: currentMedia }}
                style={{
                  width: "92%",
                  height: "90%",
                  maxHeight: "92%",
                }}
                resizeMode="contain"
              />

              {/* Prev / Next controls if multiple images */}
              {mediaList.length > 1 ? (
                <>
                  <Pressable
                    onPress={() =>
                      setActiveMediaIndex((prev) => (prev > 0 ? prev - 1 : mediaList.length - 1))
                    }
                    accessibilityLabel="Previous image"
                    style={({ pressed }) => ({
                      position: "absolute",
                      left: 20,
                      top: "50%",
                      transform: [{ translateY: -22 }],
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: pressed ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)",
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <ChevronLeft size={26} color="#FFFFFF" />
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      setActiveMediaIndex((prev) => (prev < mediaList.length - 1 ? prev + 1 : 0))
                    }
                    accessibilityLabel="Next image"
                    style={({ pressed }) => ({
                      position: "absolute",
                      right: 20,
                      top: "50%",
                      transform: [{ translateY: -22 }],
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: pressed ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)",
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <ChevronRight size={26} color="#FFFFFF" />
                  </Pressable>

                  {/* Multi-image dot indicator */}
                  <View
                    style={{
                      position: "absolute",
                      bottom: 24,
                      flexDirection: "row",
                      gap: 8,
                      backgroundColor: "rgba(0,0,0,0.6)",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: RADIUS.pill,
                    }}
                  >
                    {mediaList.map((_, idx) => (
                      <View
                        key={idx}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: idx === activeMediaIndex ? "#FFFFFF" : "rgba(255,255,255,0.4)",
                        }}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ) : (
            /* Non-image post presentation in theatre center */
            <View
              style={{
                width: "80%",
                maxWidth: 620,
                padding: SPACE.x8,
                backgroundColor: colors.panel,
                borderRadius: RADIUS.xxl,
                borderWidth: 1,
                borderColor: colors.line,
                ...elevation("lg", colors),
              }}
            >
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: typeConfig.bg,
                  paddingHorizontal: SPACE.x3,
                  paddingVertical: 4,
                  borderRadius: RADIUS.pill,
                  marginBottom: SPACE.x3,
                }}
              >
                <Text style={{ ...TYPE.micro, color: typeConfig.text }}>{typeConfig.label}</Text>
              </View>
              <Text style={{ ...TYPE.h1, color: colors.ink, marginBottom: SPACE.x3 }}>
                {post.title}
              </Text>
              <Text style={{ ...TYPE.body, color: colors.inkSoft, lineHeight: 24 }}>
                {post.description}
              </Text>
            </View>
          )}
        </View>

        {/* Right Pane: 440px wide sidebar */}
        <View style={{ width: 440, height: "100%", borderLeftWidth: 1, borderLeftColor: colors.line }}>
          {renderSidebar()}
        </View>

        {/* Modals for delete/notice */}
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
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: SPACE.x3, marginTop: SPACE.x5 }}>
              <Button label="Cancel" variant="secondary" onPress={() => setConfirmDeletePost(false)} disabled={deletingPost} />
              <Button label="Delete post" variant="danger" onPress={() => void performDeletePost()} loading={deletingPost} />
            </View>
          </View>
        </Modal>

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
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: SPACE.x3, marginTop: SPACE.x5 }}>
              <Button label="Cancel" variant="secondary" onPress={() => setCommentToDelete(null)} disabled={deletingComment} />
              <Button label="Delete comment" variant="danger" onPress={() => void performDeleteComment()} loading={deletingComment} />
            </View>
          </View>
        </Modal>

        <Modal visible={!!notice} onClose={() => setNotice(null)} maxWidth={420} accessibilityLabel="Notice">
          <View style={{ padding: SPACE.x6 }}>
            <Text style={{ ...TYPE.h2, color: colors.ink }}>Notice</Text>
            <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>{notice}</Text>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: SPACE.x5 }}>
              <Button label="Got it" onPress={() => setNotice(null)} />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ─── MOBILE VERTICAL LAYOUT ───────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      {/* Top Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.x3,
          paddingHorizontal: SPACE.x4,
          paddingVertical: SPACE.x3,
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
            <IconButton
              icon={Trash2}
              label="Delete post"
              variant="secondary"
              onPress={() => setConfirmDeletePost(true)}
            />
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ width: "100%", maxWidth: 760, alignSelf: "center", padding: SPACE.x4, paddingBottom: SPACE.x10 }}>
          <Card padding={0} style={{ overflow: "hidden" }}>
            <View style={{ flexDirection: "row", alignItems: "center", padding: SPACE.x4 }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: colors.brandWash,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: SPACE.x3,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.brand }}>
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
                  paddingVertical: 4,
                  borderRadius: RADIUS.pill,
                }}
              >
                <Text style={{ ...TYPE.micro, fontSize: 9, color: typeConfig.text }}>
                  {typeConfig.label}
                </Text>
              </View>
            </View>

            <Text style={{ ...TYPE.h2, color: colors.ink, paddingHorizontal: SPACE.x4, marginBottom: SPACE.x2 }}>
              {post.title}
            </Text>
            {post.description ? (
              <Text style={{ ...TYPE.body, color: colors.inkSoft, paddingHorizontal: SPACE.x4, marginBottom: SPACE.x4, lineHeight: 22 }}>
                {post.description}
              </Text>
            ) : null}

            {mediaList.length > 0 ? (
              <View style={{ paddingHorizontal: SPACE.x4, marginBottom: SPACE.x4 }}>
                <PostImageGallery images={mediaList} fallbackImageUrl={imageUrl} />
              </View>
            ) : null}

            {(post.tags || []).length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: SPACE.x4, marginBottom: SPACE.x4, gap: SPACE.x2, alignItems: "center" }}>
                <Tag size={13} color={colors.inkFaint} />
                {(post.tags || []).map((tag: string) => (
                  <View key={tag} style={{ backgroundColor: colors.surfaceSunken, paddingHorizontal: SPACE.x2, paddingVertical: 4, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: colors.line }}>
                    <Text style={{ ...TYPE.caption, color: colors.inkSoft, fontWeight: "500" }}>#{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Engagement */}
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
                  <Text style={{ ...TYPE.caption, color: liked ? colors.destructive : colors.inkFaint, fontWeight: "600" }}>
                    {likeCount}
                  </Text>
                </Pressable>
              </Animated.View>

              <Pressable
                onPress={() => inputRef.current?.focus()}
                accessibilityRole="button"
                accessibilityLabel="Comments"
                style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2, paddingHorizontal: SPACE.x3, minHeight: 44 }}
              >
                <MessageCircle size={20} color={colors.inkFaint} strokeWidth={2} />
                <Text style={{ ...TYPE.caption, color: colors.inkFaint, fontWeight: "600" }}>
                  {comments.length}
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

          {/* Comments section on mobile */}
          <View style={{ marginTop: SPACE.x6 }}>
            <Text style={{ ...TYPE.title, color: colors.ink, marginBottom: SPACE.x3 }}>
              Comments ({comments.length})
            </Text>

            {/* Composer */}
            {profile?.role === "student" && !profile?.profile_completed ? (
              <View style={{ backgroundColor: colors.brandWash, borderRadius: RADIUS.md, padding: SPACE.x3, marginBottom: SPACE.x4 }}>
                <Text style={{ ...TYPE.caption, color: colors.brand, fontWeight: "700" }}>Complete your profile to comment</Text>
                <Button label="Go to Profile" size="sm" onPress={() => router.push("/onboarding")} style={{ marginTop: 8 }} />
              </View>
            ) : isGuest ? (
              <View style={{ backgroundColor: colors.brandWash, borderRadius: RADIUS.md, padding: SPACE.x3, marginBottom: SPACE.x4 }}>
                <Text style={{ ...TYPE.caption, color: colors.brand, textAlign: "center", fontWeight: "600" }}>
                  Sign in with your school account to comment.
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
                  ref={inputRef}
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
                  onPress={() => void handleComment()}
                  disabled={!commentText.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Post comment"
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

            {/* Comments list */}
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
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <Text style={{ ...TYPE.caption, fontWeight: "700", color: colors.ink, flex: 1 }} numberOfLines={1}>
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
                                  style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}
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
                              <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: SPACE.x2, gap: SPACE.x2 }}>
                                <Button label="Cancel" variant="ghost" size="sm" onPress={cancelEditComment} />
                                <Button label="Save" size="sm" onPress={() => handleSaveComment(c)} disabled={!editingText.trim()} />
                              </View>
                            </View>
                          ) : (
                            <Text style={{ ...TYPE.caption, color: colors.inkSoft, lineHeight: 20 }}>{c.text}</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <Modal visible={confirmDeletePost} onClose={() => !deletingPost && setConfirmDeletePost(false)} maxWidth={440} accessibilityLabel="Delete post confirmation">
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>Delete post?</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
            This removes the post and its comments for everyone. This cannot be undone.
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: SPACE.x3, marginTop: SPACE.x5 }}>
            <Button label="Cancel" variant="secondary" onPress={() => setConfirmDeletePost(false)} disabled={deletingPost} />
            <Button label="Delete post" variant="danger" onPress={() => void performDeletePost()} loading={deletingPost} />
          </View>
        </View>
      </Modal>

      <Modal visible={!!commentToDelete} onClose={() => !deletingComment && setCommentToDelete(null)} maxWidth={440} accessibilityLabel="Delete comment confirmation">
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>Delete comment?</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
            This comment will be removed permanently.
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: SPACE.x3, marginTop: SPACE.x5 }}>
            <Button label="Cancel" variant="secondary" onPress={() => setCommentToDelete(null)} disabled={deletingComment} />
            <Button label="Delete comment" variant="danger" onPress={() => void performDeleteComment()} loading={deletingComment} />
          </View>
        </View>
      </Modal>

      <Modal visible={!!notice} onClose={() => setNotice(null)} maxWidth={420} accessibilityLabel="Notice">
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
