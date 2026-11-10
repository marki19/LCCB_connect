import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Switch,
  useWindowDimensions,
  Pressable,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  X,
  Plus,
  Image as ImageIcon,
  FolderOpen,
  GraduationCap,
  Globe,
  RefreshCw,
  SendHorizontal,
  ChevronDown,
  Layers,
  Lock,
  Users,
  UserCheck,
} from "lucide-react-native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { uploadToStorage, pickImage, pickMultipleImages } from "../src/lib/upload";
import { apiFetch, updatePost } from "../src/lib/api";
import { fetchLinkPreview, LinkPreviewData } from "../src/lib/linkPreview";
import { safeBack } from "../src/lib/navigation";
import VisibilityPicker from "../src/components/VisibilityPicker";
import Avatar from "../src/components/Avatar";
import type { ContentVisibility } from "../src/types";
import { focusRing, RADIUS, SPACE, TYPE } from "../src/lib/tokens";
import { badgeTone, type BadgeTone } from "../src/components/admin/StatusBadge";
import Button, { IconButton } from "../src/components/ui/Button";
import Card from "../src/components/ui/Card";
import Reveal from "../src/components/ui/Reveal";
import Modal from "../src/components/ui/Modal";
import TextField from "../src/components/ui/TextField";

type PostType = "text" | "image" | "project" | "capstone" | "website";

export default function CreatePostModal() {
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;

  // Edit or pre-selected mode: params from PostCard / PostDetail / FeedComposer
  const {
    postId,
    type,
    editTitle,
    editContent,
    editType,
    editTech,
    editUrl,
    editVisibility,
  } = useLocalSearchParams<{
    postId?: string;
    type?: string;
    editTitle?: string;
    editContent?: string;
    editType?: string;
    editTech?: string;
    editUrl?: string;
    editVisibility?: string;
  }>();

  const isEditing = !!postId;
  const initialType = ((editType || type) as PostType) || "text";

  const [visibility, setVisibility] = useState<ContentVisibility>(
    (editVisibility as ContentVisibility) || "public"
  );
  const [audience, setAudience] = useState<string[]>([]);
  const [visibilityTouched, setVisibilityTouched] = useState(false);
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);

  const [postType, setPostType] = useState<PostType>(initialType);
  const [content, setContent] = useState(isEditing ? editContent ?? "" : "");
  const [title, setTitle] = useState(isEditing ? editTitle ?? "" : "");
  const [technologies, setTechnologies] = useState(isEditing ? editTech ?? "" : "");
  const [githubUrl, setGithubUrl] = useState(isEditing ? editUrl ?? "" : "");
  const [allowReposts, setAllowReposts] = useState(true);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [urlFocused, setUrlFocused] = useState(false);

  const [previewData, setPreviewData] = useState<LinkPreviewData | null>(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  // Close modal on Escape key (web desktop)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        safeBack("/(tabs)");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const loadPreview = async (urlToFetch: string) => {
    if (!urlToFetch || !urlToFetch.startsWith("http")) return;
    try {
      setFetchingPreview(true);
      const data = await fetchLinkPreview(urlToFetch);
      setPreviewData(data);
      if (data?.title && !title) {
        setTitle(data.title);
      }
    } catch {
      // Non-blocking
    } finally {
      setFetchingPreview(false);
    }
  };

  const handlePickImage = async () => {
    if (imageUris.length >= 4) {
      Alert.alert("Limit Reached", "You can upload a maximum of 4 photos per post.");
      return;
    }
    const results = await pickMultipleImages({ selectionLimit: 4 - imageUris.length });
    if (results && results.length > 0) {
      const nextUris = [...imageUris, ...results.map((r) => r.uri)].slice(0, 4);
      setImageUris(nextUris);
      if (postType === "text" && nextUris.length > 0) setPostType("image");
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== index));
  };

  const isPostValid = Boolean(
    content.trim() ||
      imageUris.length > 0 ||
      (postType === "project" && title.trim()) ||
      (postType === "capstone" && title.trim()) ||
      (postType === "website" && (githubUrl.trim() || previewData))
  );

  const handlePublish = async () => {
    if (profile?.role === "student" && !profile?.profile_completed) {
      if (Platform.OS === "web") {
        const proceed = typeof window !== "undefined" && window.confirm
          ? window.confirm(
              "Complete your profile (student ID, department, and course) before creating posts.\n\nGo to profile setup now?"
            )
          : false;
        if (proceed) router.push("/onboarding");
      } else {
        Alert.alert(
          "Complete Your Profile",
          "Complete your profile (full name, student ID, department, and course) before creating posts.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Complete Profile", onPress: () => router.push("/onboarding") },
          ]
        );
      }
      return;
    }

    if (!isPostValid) {
      Alert.alert("Empty Post", "Please add some content, an image, or project details to post.");
      return;
    }

    try {
      setIsPublishing(true);

      let finalImageKeys: string[] = [];
      if (imageUris.length > 0) {
        const uploadResults = await Promise.all(
          imageUris.map((uri) => uploadToStorage(uri))
        );
        finalImageKeys = uploadResults.map((r) => r?.key).filter(Boolean) as string[];
      }
      const finalImageKey = finalImageKeys.length > 0 ? finalImageKeys[0] : null;

      let finalPreviewMetadata = previewData;
      if (postType === "website" && githubUrl && !finalPreviewMetadata) {
        try {
          finalPreviewMetadata = await fetchLinkPreview(githubUrl);
        } catch {
          // Non-blocking
        }
      }

      const techArray = technologies ? technologies.split(",").map((t) => t.trim()).filter(Boolean) : null;
      const visibilityPayload = visibilityTouched
        ? { visibility, ...(visibility === "custom" ? { audience } : {}) }
        : {};

      if (isEditing && postId) {
        // Edit mode — PUT /posts/:id
        await updatePost(postId, {
          content,
          type: postType,
          title: title || finalPreviewMetadata?.title || null,
          technologies: techArray,
          github_url: githubUrl || null,
          preview_metadata: finalPreviewMetadata || null,
          allow_reposts: allowReposts,
          ...(finalImageKeys.length > 0 ? { image_url: finalImageKey, image_urls: finalImageKeys } : {}),
          ...visibilityPayload,
        });
      } else {
        // Create mode — POST /posts
        const res = await apiFetch(`/posts`, {
          method: "POST",
          body: JSON.stringify({
            content,
            type: postType,
            title: title || finalPreviewMetadata?.title || null,
            technologies: techArray,
            github_url: githubUrl || null,
            image_url: finalImageKey,
            image_urls: finalImageKeys,
            preview_metadata: finalPreviewMetadata || null,
            visibility,
            allow_reposts: allowReposts,
            ...(visibility === "custom" ? { audience } : {}),
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (errData.code === "PROFILE_INCOMPLETE" || errData.code === "VERIFICATION_REQUIRED") {
            if (Platform.OS === "web") {
              const proceed = typeof window !== "undefined" && window.confirm
                ? window.confirm(
                    (errData.message || "Complete your profile before creating posts.") +
                      "\n\nGo to profile setup now?"
                  )
                : false;
              if (proceed) router.push("/onboarding");
            } else {
              Alert.alert(
                "Complete Your Profile",
                errData.message ||
                  "Complete your profile (full name, student ID, department, and course) before creating posts.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Complete Profile",
                    onPress: () => router.push("/onboarding"),
                  },
                ]
              );
            }
            return;
          }
          throw new Error(errData.message || "Failed to create post");
        }
      }

      safeBack("/(tabs)");
    } catch (err: any) {
      setNotice({
        title: "Could not publish",
        message: err.message || "Failed to publish post",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const firstName = (profile?.full_name || profile?.username || "there").split(" ")[0];

  // ── COMPOSER BODY (Shared between desktop and mobile modal) ────────────────
  const renderComposerContent = () => (
    <View style={{ flex: 1 }}>
      {/* User Row (Facebook style) */}
      <View style={styles.modalUserRow}>
        <Avatar name={profile?.full_name ?? profile?.username} size={44} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text
            style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}
            numberOfLines={1}
          >
            {profile?.full_name || profile?.username || "You"}
          </Text>

          {/* Privacy Pill Dropdown Button */}
          <TouchableOpacity
            onPress={() => setShowVisibilityPicker((v) => !v)}
            style={[
              styles.modalAudiencePill,
              {
                backgroundColor: colors.surfaceSunken,
                borderColor: colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Change audience"
          >
            {visibility === "public" ? (
              <Globe size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
            ) : visibility === "friends" ? (
              <Users size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
            ) : visibility === "custom" ? (
              <UserCheck size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
            ) : (
              <Lock size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
            )}
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginRight: 4 }}>
              {visibility === "public"
                ? "Public"
                : visibility === "friends"
                ? "Friends"
                : visibility === "custom"
                ? "Custom"
                : "Private"}
            </Text>
            <ChevronDown size={13} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {postType !== "text" && (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor:
                postType === "project"
                  ? "rgba(99, 102, 241, 0.15)"
                  : postType === "capstone"
                  ? "rgba(245, 158, 11, 0.15)"
                  : postType === "website"
                  ? "rgba(2, 132, 199, 0.15)"
                  : "rgba(139, 92, 246, 0.15)",
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color:
                  postType === "project"
                    ? "#6366F1"
                    : postType === "capstone"
                    ? "#F59E0B"
                    : postType === "website"
                    ? "#0284C7"
                    : "#8B5CF6",
              }}
            >
              {postType}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.modalScrollView}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Visibility Picker Dropdown */}
        {showVisibilityPicker && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            layout={Layout.springify()}
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: colors.surfaceSunken,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <VisibilityPicker
              visibility={visibility}
              audience={audience}
              onChange={(v, a) => {
                setVisibility(v);
                setAudience(a);
                setVisibilityTouched(true);
              }}
            />
            <TouchableOpacity
              onPress={() => setShowVisibilityPicker(false)}
              style={{
                alignSelf: "flex-end",
                paddingVertical: 4,
                paddingHorizontal: 12,
                borderRadius: 6,
                backgroundColor: colors.actionSurface,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.action }}>Done</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Project Showcase Extra Fields */}
        {postType === "project" && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: colors.surfaceSunken,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: "#6366F1",
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <FolderOpen size={16} color="#6366F1" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#6366F1" }}>
                  Showcase Project
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPostType("text")}>
                <X size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <TextInput
              placeholder="Project Name / Title"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                padding: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 8,
                ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
              }}
            />
            <TextInput
              placeholder="Tech Stack (e.g. React Native, Node.js, PostgreSQL)"
              placeholderTextColor={colors.textTertiary}
              value={technologies}
              onChangeText={setTechnologies}
              style={{
                fontSize: 13,
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                padding: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 8,
                ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
              }}
            />
            <TextInput
              placeholder="GitHub / Repo URL (https://github.com/...)"
              placeholderTextColor={colors.textTertiary}
              value={githubUrl}
              onChangeText={setGithubUrl}
              autoCapitalize="none"
              keyboardType="url"
              style={{
                fontSize: 13,
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                padding: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
              }}
            />
          </Animated.View>
        )}

        {/* Capstone Extra Fields */}
        {postType === "capstone" && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: colors.surfaceSunken,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: "#F59E0B",
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <GraduationCap size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#F59E0B" }}>
                  Publish Capstone
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPostType("text")}>
                <X size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <TextInput
              placeholder="Capstone Title"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                padding: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 8,
                ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
              }}
            />
            <TextInput
              placeholder="Technologies & Keywords (e.g. AI, Mobile, Cloud)"
              placeholderTextColor={colors.textTertiary}
              value={technologies}
              onChangeText={setTechnologies}
              style={{
                fontSize: 13,
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                padding: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
              }}
            />
          </Animated.View>
        )}

        {/* Website / Live Web App Fields */}
        {postType === "website" && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: colors.surfaceSunken,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: "#0284C7",
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Globe size={16} color="#0284C7" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#0284C7" }}>
                  Live Web App
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPostType("text")}>
                <X size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                placeholder="https://your-project.vercel.app"
                placeholderTextColor={colors.textTertiary}
                value={githubUrl}
                onChangeText={(val) => {
                  setGithubUrl(val);
                  if (val.startsWith("http")) loadPreview(val);
                }}
                autoCapitalize="none"
                keyboardType="url"
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                  padding: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
                }}
              />
              <TouchableOpacity
                onPress={() => loadPreview(githubUrl)}
                disabled={fetchingPreview}
                style={{
                  backgroundColor: colors.action,
                  paddingHorizontal: 12,
                  justifyContent: "center",
                  borderRadius: 8,
                }}
              >
                {fetchingPreview ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <RefreshCw size={15} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>

            {previewData && (
              <View
                style={{
                  marginTop: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  overflow: "hidden",
                  backgroundColor: colors.surface,
                }}
              >
                {previewData.image && (
                  <Image source={{ uri: previewData.image }} style={{ width: "100%", height: 120 }} resizeMode="cover" />
                )}
                <View style={{ padding: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }} numberOfLines={1}>
                    {previewData.title || title || "Preview"}
                  </Text>
                  {previewData.description && (
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }} numberOfLines={2}>
                      {previewData.description}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* Profile Incomplete Banner */}
        {profile?.role === "student" && !profile?.profile_completed && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.surfaceSunken,
              borderRadius: 10,
              padding: 10,
              marginVertical: 10,
              borderWidth: 1,
              borderColor: colors.action,
            }}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>
                Profile Incomplete
              </Text>
              <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 2 }}>
                Complete your student ID, department, and course to publish posts.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/onboarding")}
              style={{
                backgroundColor: colors.action,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
              }}
              accessibilityRole="button"
              accessibilityLabel="Complete profile"
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFFFFF" }}>
                Complete
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Textarea */}
        <TextInput
          placeholder={`What's on your mind, ${firstName}?`}
          placeholderTextColor={colors.textTertiary}
          multiline
          autoFocus={!isEditing}
          value={content}
          onChangeText={setContent}
          style={{
            minHeight: 120,
            fontSize: content.length > 80 ? 16 : 18,
            color: colors.textPrimary,
            textAlignVertical: "top",
            lineHeight: 24,
            paddingVertical: 8,
            ...(Platform.OS === "web" ? ({ outlineStyle: "none", borderWidth: 0 } as any) : {}),
          }}
        />

        {/* Attached Images Preview Grid */}
        {imageUris.length > 0 && (
          <View style={{ marginVertical: 12 }}>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {imageUris.map((uri, idx) => {
                const isSingle = imageUris.length === 1;
                const widthStyle = isSingle ? "100%" : "48.5%";
                const heightVal = isSingle ? 220 : 130;
                return (
                  <View
                    key={uri + idx}
                    style={{
                      width: widthStyle,
                      height: heightVal,
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: colors.border,
                      position: "relative",
                      backgroundColor: colors.surfaceSunken,
                    }}
                  >
                    <Image
                      source={{ uri }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={() => handleRemoveImage(idx)}
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: "rgba(0, 0, 0, 0.7)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${idx + 1}`}
                    >
                      <X size={16} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            {imageUris.length < 4 && (
              <TouchableOpacity
                onPress={handlePickImage}
                style={{
                  marginTop: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: colors.border,
                  backgroundColor: colors.actionSurface,
                  gap: 6,
                }}
                accessibilityRole="button"
                accessibilityLabel="Add more photos"
              >
                <Plus size={16} color={colors.action} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.action }}>
                  Add more photos ({imageUris.length}/4)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Repost Permission Row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 10,
            marginTop: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>
              Allow others to repost
            </Text>
            <Text style={{ fontSize: 11, color: colors.textTertiary }}>
              Friends can quote or share this on their own profile
            </Text>
          </View>
          <Switch
            value={allowReposts}
            onValueChange={setAllowReposts}
            trackColor={{ false: colors.border, true: colors.action }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* "Add to your post" Toolbar (Facebook style) */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 16,
            paddingVertical: 10,
            marginTop: 10,
            backgroundColor: isDark ? colors.surfaceSunken : "#F0F2F5",
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>
            Add to your post
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {/* Photo / Image */}
            <TouchableOpacity
              onPress={handlePickImage}
              style={{ padding: 6, borderRadius: 20 }}
              accessibilityRole="button"
              accessibilityLabel="Add Photo"
            >
              <ImageIcon size={22} color="#10B981" />
            </TouchableOpacity>

            {/* Showcase Project */}
            <TouchableOpacity
              onPress={() => setPostType((p) => (p === "project" ? "text" : "project"))}
              style={{ padding: 6, borderRadius: 20 }}
              accessibilityRole="button"
              accessibilityLabel="Showcase Project"
            >
              <FolderOpen size={22} color="#6366F1" />
            </TouchableOpacity>

            {/* Publish Capstone */}
            <TouchableOpacity
              onPress={() => setPostType((p) => (p === "capstone" ? "text" : "capstone"))}
              style={{ padding: 6, borderRadius: 20 }}
              accessibilityRole="button"
              accessibilityLabel="Publish Capstone"
            >
              <GraduationCap size={22} color="#F59E0B" />
            </TouchableOpacity>

            {/* Live Web Link */}
            <TouchableOpacity
              onPress={() => setPostType((p) => (p === "website" ? "text" : "website"))}
              style={{ padding: 6, borderRadius: 20 }}
              accessibilityRole="button"
              accessibilityLabel="Add Web Link"
            >
              <Globe size={22} color="#0284C7" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Footer Post Button */}
      <View
        style={[
          styles.modalFooter,
          { borderTopColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <TouchableOpacity
          onPress={handlePublish}
          disabled={!isPostValid || isPublishing}
          style={[
            styles.modalActionBtn,
            {
              backgroundColor: !isPostValid || isPublishing ? colors.surfaceSunken : colors.action,
              opacity: !isPostValid ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={isEditing ? "Save changes" : "Post"}
        >
          {isPublishing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text
                style={[
                  styles.modalActionBtnText,
                  { color: !isPostValid ? colors.textTertiary : "#FFFFFF" },
                ]}
              >
                {isEditing ? "Save Changes" : "Post"}
              </Text>
              {isPostValid && <SendHorizontal color="#FFFFFF" size={17} />}
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── DESKTOP WEB: Centered Floating Modal Dialog (Facebook style) ────────────
  if (isDesktop) {
    return (
      <View
        style={[
          styles.desktopBackdrop,
          Platform.OS === "web" ? ({ position: "fixed", zIndex: 1200 } as any) : {},
        ]}
      >
        {/* Click outside backdrop to dismiss */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => safeBack("/(tabs)")}
          accessibilityLabel="Dismiss modal"
        />

        {/* Centered Modal Card */}
        <View
          style={[
            styles.desktopModalCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <View style={{ width: 36 }} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {isEditing ? "Edit post" : "Create post"}
            </Text>

            <TouchableOpacity
              onPress={() => safeBack("/(tabs)")}
              style={[styles.modalCircleBtn, { backgroundColor: colors.surfaceSunken }]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X color={colors.textPrimary} size={18} />
            </TouchableOpacity>
          </View>

          {renderComposerContent()}
        </View>
      </View>
    );
  }

  // ── MOBILE: Responsive Full-Screen Sheet ───────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={[
            styles.modalHeader,
            { borderBottomColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <TouchableOpacity onPress={() => safeBack("/(tabs)")} style={{ padding: 4 }}>
            <X color={colors.textPrimary} size={24} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            {isEditing ? "Edit post" : "Create post"}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        {renderComposerContent()}
      </SafeAreaView>

      <Modal
        visible={!!notice}
        onClose={() => setNotice(null)}
        maxWidth={440}
        accessibilityLabel={notice?.title ?? "Notice"}
      >
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>{notice?.title}</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
            {notice?.message}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: SPACE.x5 }}>
            <Button label="Got it" onPress={() => setNotice(null)} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  desktopBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 1200,
  },
  desktopModalCard: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "90vh" as any,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 24,
    zIndex: 1201,
  },
  modalHeader: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  modalCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalUserRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  modalAudiencePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
  },
  modalScrollView: {
    flex: 1,
    maxHeight: 460,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
  },
  modalActionBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  modalActionBtnText: {
    fontWeight: "700",
    fontSize: 15,
  },
});
