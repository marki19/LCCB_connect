import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from "react-native-reanimated";
import { ArrowLeft, Heart, MessageCircle, Share2, ExternalLink, Send, Tag, Calendar } from "lucide-react-native";
import { PROTOTYPE_POSTS } from "../../src/data/prototype";
import rawComments from "../../src/data/mock/comments.json";

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  website:  { label: "Website",  bg: "#DBEAFE", text: "#1D4ED8" },
  thesis:   { label: "Thesis",   bg: "#EDE9FE", text: "#6D28D9" },
  capstone: { label: "Capstone", bg: "#D1FAE5", text: "#047857" },
  project:  { label: "Project",  bg: "#FEF3C7", text: "#B45309" },
};

type Comment = { id: string; author: string; initials: string; avatarColor: string; text: string; time: string };

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const post = PROTOTYPE_POSTS.find((p) => p.id === id);

  const [liked, setLiked] = useState(post?.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(post?.likes ?? 0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Comment[]>(rawComments as Comment[]);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

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

  const typeConfig = TYPE_CONFIG[post.type];

  const handleLike = () => {
    scale.value = withSequence(withTiming(1.4, { duration: 110 }), withTiming(0.85, { duration: 80 }), withTiming(1, { duration: 110 }));
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(newLiked ? likeCount + 1 : likeCount - 1);
  };

  const handleComment = () => {
    if (!commentText.trim()) return;
    setComments([{ id: String(Date.now()), author: "Mark Antipo", initials: "MA", avatarColor: "#BFDBFE", text: commentText.trim(), time: "Just now" }, ...comments]);
    setCommentText("");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F0F7FF" }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#DBEAFE" }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
          <ArrowLeft size={20} color="#1A56DB" />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#1E293B", flex: 1 }} numberOfLines={1}>{post.title}</Text>
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

          <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, marginBottom: 16, gap: 6, alignItems: "center" }}>
            <Tag size={14} color="#94A3B8" />
            {post.tags.map((tag) => (
              <View key={tag} style={{ backgroundColor: "#F1F5F9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0" }}>
                <Text style={{ fontSize: 12, color: "#64748B", fontWeight: "500" }}>#{tag}</Text>
              </View>
            ))}
          </View>

          {post.previewUrl ? (
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