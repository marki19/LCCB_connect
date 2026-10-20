import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking, TextInput, Image, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from "react-native-reanimated";
import { ArrowLeft, Heart, MessageCircle, Share2, ExternalLink, Send, Tag, Calendar, Pencil, Trash2, MoreVertical } from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { ThemeTokens } from "../../src/lib/tokens";
import type { Post } from "../../src/types";
import { apiFetch, deletePost, updateComment, deleteComment } from "../../src/lib/api";
import { safeBack } from "../../src/lib/navigation";

function getTypeConfig(type: string, colors: ThemeTokens): { label: string; bg: string; text: string } {
  const configs: Record<string, { label: string; bg: string; text: string }> = {
    website:  { label: "Website",  bg: colors.badgeWebsiteBg,  text: colors.badgeWebsiteText },
    thesis:   { label: "Thesis",   bg: colors.badgeThesisBg,   text: colors.badgeThesisText },
    capstone: { label: "Capstone", bg: colors.badgeCapstoneBg, text: colors.badgeCapstoneText },
    project:  { label: "Project",  bg: colors.badgeProjectBg,  text: colors.badgeProjectText },
    text:     { label: "Update",   bg: colors.badgeUpdateBg,   text: colors.badgeUpdateText },
    image:    { label: "Image",    bg: colors.badgeImageBg,    text: colors.badgeImageText },
  };
  return configs[type] || configs["text"];
}

type Comment = { id: string; author: string; initials: string; avatarColor: string; text: string; time: string };

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const isGuest = profile?.role === "guest";

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [commentMenuId, setCommentMenuId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

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
                initials: authorName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase(),
                avatarColor: "#BFDBFE",
                course: postData.author?.department_name || "—",
                yearLevel: postData.author?.year_level || "—",
              },
              title: postData.title,
              description: postData.content || postData.description || "",
              type: postData.type || "text",
              tags: postData.technologies || postData.tags || [],
              previewUrl: postData.github_url || postData.preview_url,
              imageUrl: postData.image_url,
              preview_metadata: postData.preview_metadata || null,
              likes: postData.likes || 0,
              comments: postData.comments || 0,
              createdAt: new Date(postData.created_at).toLocaleDateString(),
              isLiked: false,
            });
            setLikeCount(postData.likes || 0);
          }
        }

        // Fetch comments from raw SQL backend
        const resComments = await apiFetch(`/posts/${id}/comments`);
        if (resComments.ok) {
          const commentsData = await resComments.json();
          if (commentsData) {
            setComments(commentsData.map((c: any) => {
              const cName = c.user?.full_name || "Unknown User";
              return {
                id: c.id,
                userId: c.user_id,
                author: cName,
                initials: cName.substring(0, 2).toUpperCase(),
                avatarColor: "#E2E8F0",
                text: c.content,
                time: new Date(c.created_at).toLocaleDateString(),
              };
            }));
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
      Alert.alert("Sign In Required", "Please sign in with your institutional account to like posts.");
      return;
    }
    scale.value = withSequence(withTiming(1.4, { duration: 110 }), withTiming(0.85, { duration: 80 }), withTiming(1, { duration: 110 }));
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
    
    // Optimistic UI update
    const newComment = { 
      id: String(Date.now()), 
      userId: profile.id,
      author: profile.full_name || "You", 
      initials: (profile.full_name || "You").substring(0, 2).toUpperCase(), 
      avatarColor: "#BFDBFE", 
      text: text, 
      time: "Just now" 
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
        prev.map((item) =>
          item.id === c.id ? { ...item, text: updated?.content ?? text } : item
        )
      );
      cancelEditComment();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update comment");
    }
  };

  const handleDeleteComment = (c: any) => {
    setCommentMenuId(null);
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteComment(post.id, c.id);
              setComments((prev) => prev.filter((item) => item.id !== c.id));
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to delete comment");
            }
          },
        },
      ]
    );
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
      },
    });
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePost(post.id);
              safeBack("/(tabs)");
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to delete post");
            }
          },
        },
      ]
    );
  };

  if (!post && loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage, alignItems: "center", justifyContent: "center" }} edges={["top"]}>
        <ActivityIndicator size="small" color={colors.action} />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage, alignItems: "center", justifyContent: "center" }} edges={["top"]}>
        <Text style={{ color: colors.textTertiary, fontSize: 16 }}>Post not found.</Text>
      </SafeAreaView>
    );
  }

  const typeConfig = getTypeConfig(post.type, colors);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => safeBack("/(tabs)")} activeOpacity={0.7} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.actionSurface, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
          <ArrowLeft size={20} color={colors.action} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary, flex: 1 }} numberOfLines={1}>{post.title}</Text>
        {isOwner && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <TouchableOpacity onPress={handleEdit} activeOpacity={0.7}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.actionSurface, alignItems: "center", justifyContent: "center" }}>
              <Pencil size={17} color={colors.action} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} activeOpacity={0.7}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? "hsl(360, 40%, 20%)" : "#FEF2F2", alignItems: "center", justifyContent: "center" }}>
              <Trash2 size={17} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ backgroundColor: colors.surface, margin: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: "hidden", shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0.35 : 0.07, shadowRadius: 8, elevation: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.actionSurfaceAlt, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: colors.textPrimary }}>{post.author.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>{post.author.name}</Text>
              <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{post.author.course} - {post.author.yearLevel}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Calendar size={13} color={colors.textTertiary} />
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>{post.createdAt}</Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <View style={{ alignSelf: "flex-start", backgroundColor: typeConfig.bg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: typeConfig.text }}>{typeConfig.label}</Text>
            </View>
          </View>

          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textPrimary, paddingHorizontal: 16, marginBottom: 10, lineHeight: 28 }}>{post.title}</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, paddingHorizontal: 16, marginBottom: 16, lineHeight: 22 }}>{post.description}</Text>

          {post.imageUrl ? (
            <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
              <Image 
                source={{ uri: post.imageUrl }} 
                style={{ width: "100%", height: 250, borderRadius: 14, backgroundColor: colors.surfaceSunken }}
                resizeMode="cover"
              />
            </View>
          ) : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, marginBottom: 16, gap: 6, alignItems: "center" }}>
            <Tag size={14} color={colors.textTertiary} />
            {(post.tags || []).map((tag: string) => (
              <View key={tag} style={{ backgroundColor: colors.surfaceSunken, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: "500" }}>#{tag}</Text>
              </View>
            ))}
          </View>

          {/* Website / Link Preview Card */}
          {post.preview_metadata ? (
            <TouchableOpacity
              onPress={() => {
                const target = post.preview_metadata?.url || post.previewUrl;
                if (target) Linking.openURL(target);
              }}
              activeOpacity={0.85}
              style={{
                marginHorizontal: 16,
                marginBottom: 16,
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
                  style={{ width: "100%", height: 180, backgroundColor: colors.surfaceSunken }}
                  resizeMode="cover"
                />
              ) : null}
              <View style={{ padding: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                  <ExternalLink size={14} color={colors.action} />
                  <Text numberOfLines={1} style={{ fontSize: 13, color: colors.action, fontWeight: "700", marginLeft: 6, flex: 1 }}>
                    {post.preview_metadata.siteName || post.preview_metadata.url}
                  </Text>
                </View>
                {post.preview_metadata.title ? (
                  <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: 4 }}>
                    {post.preview_metadata.title}
                  </Text>
                ) : null}
                {post.preview_metadata.description ? (
                  <Text numberOfLines={3} style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 8 }}>
                    {post.preview_metadata.description}
                  </Text>
                ) : null}
                <View style={{ alignSelf: "flex-start", backgroundColor: colors.action, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>Visit Website</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : post.previewUrl ? (
            <TouchableOpacity onPress={() => Linking.openURL(post.previewUrl!)} activeOpacity={0.8}
              style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: colors.actionSurface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.actionSurfaceAlt, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <ExternalLink size={18} color={colors.action} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.action }}>View Live Project</Text>
                <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{post.previewUrl}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          <View style={{ height: 1, backgroundColor: colors.border }} />

          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 8 }}>
            <Animated.View style={animatedStyle}>
              <TouchableOpacity onPress={handleLike} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 }}>
                <Heart size={20} color={liked ? colors.destructive : colors.textTertiary} fill={liked ? colors.destructive : "transparent"} strokeWidth={2} />
                <Text style={{ fontSize: 14, color: liked ? colors.destructive : colors.textTertiary, marginLeft: 6, fontWeight: "600" }}>{likeCount}</Text>
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 }}>
              <MessageCircle size={20} color={colors.textTertiary} strokeWidth={2} />
              <Text style={{ fontSize: 14, color: colors.textTertiary, marginLeft: 6, fontWeight: "600" }}>{comments.length + post.comments}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 }}>
              <Share2 size={20} color={colors.textTertiary} strokeWidth={2} />
              <Text style={{ fontSize: 14, color: colors.textTertiary, marginLeft: 6, fontWeight: "600" }}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginHorizontal: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 14 }}>Comments ({comments.length + post.comments})</Text>

          {isGuest ? (
            <View style={{ backgroundColor: colors.actionSurface, borderRadius: 16, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 13, color: colors.action, textAlign: "center", fontWeight: "600" }}>
                Browsing as guest. Sign in with your school account to comment.
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.actionSurfaceAlt, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.textPrimary }}>MA</Text>
              </View>
              <TextInput value={commentText} onChangeText={setCommentText} placeholder="Write a comment..." placeholderTextColor={colors.textTertiary}
                style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.textPrimary }} />
              <TouchableOpacity onPress={handleComment} disabled={!commentText.trim()} activeOpacity={0.7}
                style={{ marginLeft: 8, width: 38, height: 38, borderRadius: 19, backgroundColor: commentText.trim() ? colors.action : colors.surfaceSunken, alignItems: "center", justifyContent: "center" }}>
                <Send size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {comments.length === 0 && (
            <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: "center", marginTop: 16 }}>No comments yet. Be the first!</Text>
          )}

          {comments.map((c) => {
            const isCommentOwner = !!profile?.id && profile.id === c.userId;
            const isEditingComment = editingCommentId === c.id;
            const isMenuOpen = commentMenuId === c.id;
            return (
              <View key={c.id} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.actionSurfaceAlt, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: colors.textPrimary }}>{c.initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>{c.author}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={{ fontSize: 11, color: colors.textTertiary }}>{c.time}</Text>
                        {isCommentOwner && (
                          <TouchableOpacity
                            onPress={() => setCommentMenuId(isMenuOpen ? null : c.id)}
                            activeOpacity={0.7}
                            style={{ marginLeft: 6, padding: 2 }}
                          >
                            <MoreVertical size={14} color={colors.textTertiary} />
                          </TouchableOpacity>
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
                          placeholder="Edit your comment..."
                          placeholderTextColor={colors.textTertiary}
                          style={{ backgroundColor: colors.surfaceSunken, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: colors.textPrimary }}
                        />
                        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 8, alignItems: "center" }}>
                          <TouchableOpacity onPress={cancelEditComment} activeOpacity={0.7} style={{ paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 }}>
                            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textTertiary }}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleSaveComment(c)}
                            disabled={!editingText.trim()}
                            activeOpacity={0.7}
                            style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: editingText.trim() ? colors.action : colors.surfaceSunken }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>Save</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>{c.text}</Text>
                    )}
                  </View>
                  {isCommentOwner && isMenuOpen && !isEditingComment && (
                    <View style={{ marginTop: 6, backgroundColor: colors.surfaceSunken, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
                      <TouchableOpacity
                        onPress={() => startEditComment(c)}
                        activeOpacity={0.7}
                        style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                      >
                        <Pencil size={14} color={colors.action} />
                        <Text style={{ fontSize: 13, color: colors.action, fontWeight: "600", marginLeft: 8 }}>Edit Comment</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteComment(c)}
                        activeOpacity={0.7}
                        style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10 }}
                      >
                        <Trash2 size={14} color={colors.destructive} />
                        <Text style={{ fontSize: 13, color: colors.destructive, fontWeight: "600", marginLeft: 8 }}>Delete Comment</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}