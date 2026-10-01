import { useState } from "react";
import { View, Text, TouchableOpacity, Linking } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Heart, MessageCircle, Share2, ExternalLink } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { Post } from "../data/prototype";

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  website:  { label: "Website",  bg: "#DBEAFE", text: "#1D4ED8" },
  thesis:   { label: "Thesis",   bg: "#EDE9FE", text: "#6D28D9" },
  capstone: { label: "Capstone", bg: "#D1FAE5", text: "#047857" },
  project:  { label: "Project",  bg: "#FEF3C7", text: "#B45309" },
};

export default function PostCard({ post }: { post: Post }) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likes);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleLike = () => {
    scale.value = withSequence(
      withTiming(1.35, { duration: 110 }),
      withTiming(0.88, { duration: 80 }),
      withTiming(1, { duration: 110 })
    );
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(newLiked ? likeCount + 1 : likeCount - 1);
  };

  const typeConfig = TYPE_CONFIG[post.type];

  return (
    <TouchableOpacity
      activeOpacity={0.97}
      onPress={() => router.push(`/post/${post.id}`)}
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
          <Text style={{ fontSize: 12, color: "#64748B", marginTop: 1 }}>{post.author.course} · {post.author.yearLevel}</Text>
        </View>
        <Text style={{ fontSize: 11, color: "#94A3B8" }}>{post.createdAt}</Text>
      </View>

      {/* Title + description */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#1E293B", marginBottom: 5 }}>{post.title}</Text>
        <Text numberOfLines={2} style={{ fontSize: 13, color: "#64748B", lineHeight: 20 }}>{post.description}</Text>
      </View>

      {/* Type badge + tags */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14, paddingBottom: 12, gap: 6 }}>
        <View style={{ backgroundColor: typeConfig.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: typeConfig.text }}>{typeConfig.label}</Text>
        </View>
        {post.tags.map((tag) => (
          <View key={tag} style={{ backgroundColor: "#F1F5F9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
            <Text style={{ fontSize: 11, color: "#64748B" }}>#{tag}</Text>
          </View>
        ))}
      </View>

      {/* Preview URL chip */}
      {post.previewUrl ? (
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

      {/* Actions */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 6 }}>
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

        <View style={{ flex: 1 }} />

        <TouchableOpacity activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 }}>
          <Share2 size={18} color="#94A3B8" strokeWidth={2} />
          <Text style={{ fontSize: 12, color: "#94A3B8", marginLeft: 5, fontWeight: "600" }}>Share</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
