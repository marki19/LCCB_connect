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
import { useTheme } from "../contexts/ThemeContext";
import { ThemeTokens, elevation, RADIUS } from "../lib/tokens";
import { apiFetch, deletePost, deleteThesis } from "../lib/api";

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
  const { colors } = useTheme();
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

  const typeConfig = getTypeConfig(post.type, colors);

  return (
    <TouchableOpacity
      activeOpacity={0.97}
      accessibilityRole="button"
      accessibilityLabel={`${post.author.name}: ${post.title}`}
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
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: post.author.avatarColor, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: colors.ink }}>{post.author.initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}>{post.author.name}</Text>
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>{post.author.course || "—"} · {post.author.yearLevel || "—"}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontSize: 11, color: colors.textTertiary }}>{post.createdAt}</Text>
          {isOwner && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation?.(); setMenuOpen(!menuOpen); }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Post options"
              hitSlop={8}
              style={{ marginLeft: 6, width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
            >
              <MoreVertical size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Owner edit/delete dropdown */}
      {isOwner && menuOpen && (
        <View style={{ marginHorizontal: 14, marginBottom: 8, backgroundColor: colors.surfaceSunken, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); handleEdit(); }}
            activeOpacity={0.7}
            style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <Pencil size={15} color={colors.action} />
            <Text style={{ fontSize: 14, color: colors.action, fontWeight: "600", marginLeft: 10 }}>Edit Post</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); handleDelete(); }}
            activeOpacity={0.7}
            style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11 }}
          >
            <Trash2 size={15} color={colors.destructive} />
            <Text style={{ fontSize: 14, color: colors.destructive, fontWeight: "600", marginLeft: 10 }}>Delete Post</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Title + description */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 5 }}>{post.title}</Text>
        <Text numberOfLines={2} style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>{post.description}</Text>
      </View>

      {post.imageUrl ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
          <Image 
            source={{ uri: post.imageUrl }} 
            style={{ width: "100%", height: 200, borderRadius: 12, backgroundColor: colors.surfaceSunken }}
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
              onPress={() => router.push(`/post/${post.id}`)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open comments"
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, minHeight: 44 }}
            >
              <MessageCircle size={18} color={colors.textTertiary} strokeWidth={2} />
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 5, fontWeight: "600" }}>{post.comments}</Text>
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
    </TouchableOpacity>
  );
}
