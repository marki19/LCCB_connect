import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking, TextInput, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from "react-native-reanimated";
import { ArrowLeft, Heart, MessageCircle, Share2, ExternalLink, Send, Tag, Calendar, Pencil, Trash2 } from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import type { Post } from "../../src/types";
import { apiFetch, deletePost } from "../../src/lib/api";

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  website:  { label: "Website",  bg: "#DBEAFE", text: "#1D4ED8" },
  thesis:   { label: "Thesis",   bg: "#EDE9FE", text: "#6D28D9" },
  capstone: { label: "Capstone", bg: "#D1FAE5", text: "#047857" },
  project:  { label: "Project",  bg: "#FEF3C7", text: "#B45309" },
  text:     { label: "Update",   bg: "#F1F5F9", text: "#475569" },
  image:    { label: "Image",    bg: "#FCE7F3", text: "#BE185D" },
};

type Comment = { id: string; author: string; initials: string; avatarColor: string; text: string; time: string };

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const isGuest = profile?.role === "guest";

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);

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

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F0F7FF", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#64748B" }}>Loading post...</Text>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F0F7FF", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#64748B" }}>Post not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: "#1A56DB", fontWeight: "600" }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const typeConfig = TYPE_CONFIG[post.type] || TYPE_CONFIG['text'];

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
              router.back();
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to delete post");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F0F7FF" }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#DBEAFE" }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
          <ArrowLeft size={20} color="#1A56DB" />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#1E293B", flex: 1 }} numberOfLines={1}>{post.title}</Text>
        {isOwner && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <TouchableOpacity onPress={handleEdit} activeOpacity={0.7}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" }}>
              <Pencil size={17} color="#1A56DB" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} activeOpacity={0.7}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" }}>
              <Trash2 size={17} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ backgroundColor: "#FFFFFF", margin: 16, borderRadius: 20, borderWidth: 1, borderColor: "#DBEAFE", overflow: "hidden", shadowColor: "#1A56DB", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: post.author.avatarColor, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: "#1E293B" }}>{post.author.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#1E293B" }}>{post.author.name}</Text>
              <Text style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{post.author.course} - {post.author.yearLevel}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Calendar size={13} color="#94A3B8" />
              <Text style={{ fontSize: 12, color: "#94A3B8", marginLeft: 4 }}>{post.createdAt}</Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <View style={{ alignSelf: "flex-start", backgroundColor: typeConfig.bg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: typeConfig.text }}>{typeConfig.label}</Text>
            </View>
          </View>

          <Text style={{ fontSize: 20, fontWeight: "800", color: "#1E293B", paddingHorizontal: 16, marginBottom: 10, lineHeight: 28 }}>{post.title}</Text>
          <Text style={{ fontSize: 14, color: "#475569", paddingHorizontal: 16, marginBottom: 16, lineHeight: 22 }}>{post.description}</Text>

          {post.imageUrl ? (
            <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
              <Image 
                source={{ uri: post.imageUrl }} 
                style={{ width: "100%", height: 250, borderRadius: 14, backgroundColor: "#F1F5F9" }}
                resizeMode="cover"
              />
            </View>
          ) : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, marginBottom: 16, gap: 6, alignItems: "center" }}>
            <Tag size={14} color="#94A3B8" />
            {(post.tags || []).map((tag: string) => (
              <View key={tag} style={{ backgroundColor: "#F1F5F9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0" }}>
                <Text style={{ fontSize: 12, color: "#64748B", fontWeight: "500" }}>#{tag}</Text>
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
                backgroundColor: "#F8FAFC",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#E2E8F0",
                overflow: "hidden",
              }}
            >
              {post.preview_metadata.image ? (
                <Image
                  source={{ uri: post.preview_metadata.image }}
                  style={{ width: "100%", height: 180, backgroundColor: "#E2E8F0" }}
                  resizeMode="cover"
                />
              ) : null}
              <View style={{ padding: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                  <ExternalLink size={14} color="#0284C7" />
                  <Text numberOfLines={1} style={{ fontSize: 13, color: "#0284C7", fontWeight: "700", marginLeft: 6, flex: 1 }}>
                    {post.preview_metadata.siteName || post.preview_metadata.url}
                  </Text>
                </View>
                {post.preview_metadata.title ? (
                  <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: "700", color: "#0F172A", marginBottom: 4 }}>
                    {post.preview_metadata.title}
                  </Text>
                ) : null}
                {post.preview_metadata.description ? (
                  <Text numberOfLines={3} style={{ fontSize: 13, color: "#64748B", lineHeight: 18, marginBottom: 8 }}>
                    {post.preview_metadata.description}
                  </Text>
                ) : null}
                <View style={{ alignSelf: "flex-start", backgroundColor: "#0284C7", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>Visit Website</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : post.previewUrl ? (
            <TouchableOpacity onPress={() => Linking.openURL(post.previewUrl!)} activeOpacity={0.8}
              style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: "#EFF6FF", borderRadius: 14, borderWidth: 1, borderColor: "#BFDBFE", padding: 14, flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <ExternalLink size={18} color="#1A56DB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#1A56DB" }}>View Live Project</Text>
                <Text numberOfLines={1} style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{post.previewUrl}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          <View style={{ height: 1, backgroundColor: "#F1F5F9" }} />

          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 8 }}>
            <Animated.View style={animatedStyle}>
              <TouchableOpacity onPress={handleLike} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 }}>
                <Heart size={20} color={liked ? "#EF4444" : "#94A3B8"} fill={liked ? "#EF4444" : "transparent"} strokeWidth={2} />
                <Text style={{ fontSize: 14, color: liked ? "#EF4444" : "#94A3B8", marginLeft: 6, fontWeight: "600" }}>{likeCount}</Text>
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 }}>
              <MessageCircle size={20} color="#94A3B8" strokeWidth={2} />
              <Text style={{ fontSize: 14, color: "#94A3B8", marginLeft: 6, fontWeight: "600" }}>{comments.length + post.comments}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 }}>
              <Share2 size={20} color="#94A3B8" strokeWidth={2} />
              <Text style={{ fontSize: 14, color: "#94A3B8", marginLeft: 6, fontWeight: "600" }}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginHorizontal: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#1E293B", marginBottom: 14 }}>Comments ({comments.length + post.comments})</Text>

          {isGuest ? (
            <View style={{ backgroundColor: "#EFF6FF", borderRadius: 16, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#DBEAFE" }}>
              <Text style={{ fontSize: 13, color: "#1E40AF", textAlign: "center", fontWeight: "600" }}>
                Browsing as guest. Sign in with your school account to comment.
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#BFDBFE", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#1E293B" }}>MA</Text>
              </View>
              <TextInput value={commentText} onChangeText={setCommentText} placeholder="Write a comment..." placeholderTextColor="#94A3B8"
                style={{ flex: 1, backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#DBEAFE", paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: "#1E293B" }} />
              <TouchableOpacity onPress={handleComment} disabled={!commentText.trim()} activeOpacity={0.7}
                style={{ marginLeft: 8, width: 38, height: 38, borderRadius: 19, backgroundColor: commentText.trim() ? "#1A56DB" : "#E2E8F0", alignItems: "center", justifyContent: "center" }}>
                <Send size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {comments.length === 0 && (
            <Text style={{ color: "#94A3B8", fontSize: 14, textAlign: "center", marginTop: 16 }}>No comments yet. Be the first!</Text>
          )}

          {comments.map((c) => (
            <View key={c.id} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 16 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.avatarColor, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#1E293B" }}>{c.initials}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#DBEAFE" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#1E293B" }}>{c.author}</Text>
                  <Text style={{ fontSize: 11, color: "#94A3B8" }}>{c.time}</Text>
                </View>
                <Text style={{ fontSize: 13, color: "#475569", lineHeight: 20 }}>{c.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}