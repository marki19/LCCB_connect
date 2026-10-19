import { useState } from "react";
import { View, Text, TouchableOpacity, Linking, Image, Alert } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Heart, MessageCircle, Share2, ExternalLink, MoreVertical, Pencil, Trash2 } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { Post } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch, deletePost, deleteThesis } from "../lib/api";

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  website:  { label: "Website",  bg: "#DBEAFE", text: "#1D4ED8" },
  thesis:   { label: "Thesis",   bg: "#EDE9FE", text: "#6D28D9" },
  capstone: { label: "Capstone", bg: "#D1FAE5", text: "#047857" },
  project:  { label: "Project",  bg: "#FEF3C7", text: "#B45309" },
  text:     { label: "Update",   bg: "#F1F5F9", text: "#475569" },
  image:    { label: "Image",    bg: "#FCE7F3", text: "#BE185D" },
};

export default function PostCard({ post, onDeleted }: { post: Post; onDeleted?: (id: string | number) => void }) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [menuOpen, setMenuOpen] = useState(false);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const { profile } = useAuth();
  const isOwner = !!profile?.id && profile.id === post.author.id;

  const handleEdit = () => {
    setMenuOpen(false);
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
      },
    });
  };

  const handleDelete = () => {
    setMenuOpen(false);
    const isThesis = post.type === "thesis";
    Alert.alert(
      isThesis ? "Delete Thesis" : "Delete Post",
      `Are you sure you want to delete this ${isThesis ? "thesis" : "post"}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (isThesis) {
                await deleteThesis(post.id);
              } else {
                await deletePost(post.id);
              }
              onDeleted?.(post.id);
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to delete");
            }
          },
        },
      ]
    );
  };

  const handleLike = async () => {
    if (!profile?.id || profile?.role === "guest") {
      Alert.alert("Sign In Required", "Please sign in with your institutional account to like posts.");
      return;
    }

    scale.value = withSequence(
      withTiming(1.35, { duration: 110 }),
      withTiming(0.88, { duration: 80 }),
      withTiming(1, { duration: 110 })
    );

    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(newLiked ? likeCount + 1 : likeCount - 1);

    try {
      await apiFetch(`/posts/${post.id}/like`, { method: "POST" });
    } catch (e) {
      console.error("Failed to toggle like via SQL backend:", e);
    }
  };

  const typeConfig = TYPE_CONFIG[post.type] || TYPE_CONFIG['text'];

  return (
    <TouchableOpacity
      activeOpacity={0.97}
      onPress={() => {
        // A thesis has no post-detail screen; open the deposited PDF instead
        // (mirrors the search screen's thesis card).
        if (post.type === "thesis") {
          if (post.previewUrl) Linking.openURL(post.previewUrl);
          return;
        }
        router.push(`/post/${post.id}`);
      }}
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        marginHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#DBEAFE",
        shadowColor: "#1A56DB",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
        elevation: 3,
        overflow: "hidden",
      }}
    >
      {/* Author row */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: post.author.avatarColor, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: "#1E293B" }}>{post.author.initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#1E293B" }}>{post.author.name}</Text>
          <Text style={{ fontSize: 12, color: "#64748B", marginTop: 1 }}>{post.author.course || "—"} · {post.author.yearLevel || "—"}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontSize: 11, color: "#94A3B8" }}>{post.createdAt}</Text>
          {isOwner && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation?.(); setMenuOpen(!menuOpen); }}
              activeOpacity={0.7}
              style={{ marginLeft: 6, padding: 4 }}
            >
              <MoreVertical size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Owner edit/delete dropdown */}
      {isOwner && menuOpen && (
        <View style={{ marginHorizontal: 14, marginBottom: 8, backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden" }}>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); handleEdit(); }}
            activeOpacity={0.7}
            style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" }}
          >
            <Pencil size={15} color="#1A56DB" />
            <Text style={{ fontSize: 14, color: "#1A56DB", fontWeight: "600", marginLeft: 10 }}>Edit Post</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); handleDelete(); }}
            activeOpacity={0.7}
            style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11 }}
          >
            <Trash2 size={15} color="#EF4444" />
            <Text style={{ fontSize: 14, color: "#EF4444", fontWeight: "600", marginLeft: 10 }}>Delete Post</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Title + description */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#1E293B", marginBottom: 5 }}>{post.title}</Text>
        <Text numberOfLines={2} style={{ fontSize: 13, color: "#64748B", lineHeight: 20 }}>{post.description}</Text>
      </View>

      {post.imageUrl ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
          <Image 
            source={{ uri: post.imageUrl }} 
            style={{ width: "100%", height: 200, borderRadius: 12, backgroundColor: "#F1F5F9" }}
            resizeMode="cover"
          />
        </View>
      ) : null}

      {/* Type badge + tags */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14, paddingBottom: 12, gap: 6 }}>
        <View style={{ backgroundColor: typeConfig.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: typeConfig.text }}>{typeConfig.label}</Text>
        </View>
        {(post.tags || []).map((tag) => (
          <View key={tag} style={{ backgroundColor: "#F1F5F9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
            <Text style={{ fontSize: 11, color: "#64748B" }}>#{tag}</Text>
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
              style={{ width: "100%", height: 160, backgroundColor: "#E2E8F0" }}
              resizeMode="cover"
            />
          ) : null}
          <View style={{ padding: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <ExternalLink size={13} color="#0284C7" />
              <Text
                numberOfLines={1}
                style={{ fontSize: 12, color: "#0284C7", fontWeight: "700", marginLeft: 6, flex: 1 }}
              >
                {post.preview_metadata.siteName || post.preview_metadata.url}
              </Text>
            </View>
            {post.preview_metadata.title ? (
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 2 }}>
                {post.preview_metadata.title}
              </Text>
            ) : null}
            {post.preview_metadata.description ? (
              <Text numberOfLines={2} style={{ fontSize: 12, color: "#64748B", lineHeight: 17 }}>
                {post.preview_metadata.description}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      ) : post.previewUrl ? (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); Linking.openURL(post.previewUrl!); }}
          activeOpacity={0.8}
          style={{ marginHorizontal: 14, marginBottom: 12, backgroundColor: "#EFF6FF", borderRadius: 12, borderWidth: 1, borderColor: "#BFDBFE", paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center" }}
        >
          <ExternalLink size={13} color="#1A56DB" />
          <Text numberOfLines={1} style={{ fontSize: 12, color: "#1A56DB", fontWeight: "600", marginLeft: 6, flex: 1 }}>{post.previewUrl}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: "#F1F5F9" }} />

      {/* Actions — likes/comments do not apply to thesis deposits */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 6 }}>
        {post.type !== "thesis" && (
          <>
            <Animated.View style={animatedStyle}>
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation?.(); handleLike(); }}
                activeOpacity={0.7}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 }}
              >
                <Heart size={18} color={liked ? "#EF4444" : "#94A3B8"} fill={liked ? "#EF4444" : "transparent"} strokeWidth={2} />
                <Text style={{ fontSize: 12, color: liked ? "#EF4444" : "#94A3B8", marginLeft: 5, fontWeight: "600" }}>{likeCount}</Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              onPress={() => router.push(`/post/${post.id}`)}
              activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 }}
            >
              <MessageCircle size={18} color="#94A3B8" strokeWidth={2} />
              <Text style={{ fontSize: 12, color: "#94A3B8", marginLeft: 5, fontWeight: "600" }}>{post.comments}</Text>
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
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 }}
        >
          <Share2 size={18} color="#94A3B8" strokeWidth={2} />
          <Text style={{ fontSize: 12, color: "#94A3B8", marginLeft: 5, fontWeight: "600" }}>Share</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
