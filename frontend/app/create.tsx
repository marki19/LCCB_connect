import { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { X, Type, Image as ImageIcon, FolderOpen, GraduationCap, Globe, RefreshCw, ChevronRight, CheckCircle2, ChevronLeft, SendHorizontal, ExternalLink } from "lucide-react-native";
import Animated, { FadeIn, FadeInRight, FadeOutLeft, FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { uploadToStorage, pickImage, MAX_UPLOAD_BYTES } from "../src/lib/upload";
import { apiFetch, updatePost } from "../src/lib/api";
import { fetchLinkPreview, LinkPreviewData } from "../src/lib/linkPreview";
import { safeBack } from "../src/lib/navigation";

type PostType = "text" | "image" | "project" | "capstone" | "website" | null;
type ConcretePostType = Exclude<PostType, null>;

function OptionCard({ type, title, desc, Icon, color, bg, selected, onSelect }: { type: ConcretePostType, title: string, desc: string, Icon: any, color: string, bg?: string, selected: boolean, onSelect: (type: ConcretePostType) => void }) {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => onSelect(type)}
      style={{
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: selected ? colors.action : colors.border,
        backgroundColor: selected ? colors.actionSurface : colors.surface,
      }}
      activeOpacity={0.7}
    >
      <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginRight: 14, backgroundColor: isDark ? colors.surfaceSunken : (bg || colors.actionSurface) }}>
        <Icon color={color} size={24} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>{title}</Text>
        <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2, lineHeight: 18 }}>{desc}</Text>
      </View>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? colors.action : colors.borderStrong, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.action : "transparent" }}>
        {selected && <CheckCircle2 color="#FFFFFF" size={14} />}
      </View>
    </TouchableOpacity>
  );
}

export default function CreatePostModal() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();

  // Edit mode: these params are set when navigating from PostCard / PostDetail
  const {
    postId,
    editTitle,
    editContent,
    editType,
    editTech,
    editUrl,
  } = useLocalSearchParams<{
    postId?: string;
    editTitle?: string;
    editContent?: string;
    editType?: string;
    editTech?: string;
    editUrl?: string;
  }>();

  const isEditing = !!postId;
  
  const [step, setStep] = useState<1 | 2 | 3>(isEditing ? 2 : 1);
  const [postType, setPostType] = useState<PostType>(
    isEditing ? (editType as PostType) ?? "text" : null
  );

  const [content, setContent] = useState(isEditing ? editContent ?? "" : "");
  const [title, setTitle] = useState(isEditing ? editTitle ?? "" : "");
  const [technologies, setTechnologies] = useState(isEditing ? editTech ?? "" : "");
  const [githubUrl, setGithubUrl] = useState(isEditing ? editUrl ?? "" : "");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const [previewData, setPreviewData] = useState<LinkPreviewData | null>(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);

  const loadPreview = async (urlToFetch: string) => {
    const trimmed = (urlToFetch || "").trim();
    if (!trimmed || (!trimmed.startsWith("http://") && !trimmed.startsWith("https://"))) {
      Alert.alert("Invalid URL", "Please enter a full URL starting with http:// or https://");
      return;
    }
    setFetchingPreview(true);
    try {
      const data = await fetchLinkPreview(trimmed);
      if (data) {
        setPreviewData(data);
        if (!title && data.title) setTitle(data.title);
        if (!content && data.description) setContent(data.description);
      } else {
        Alert.alert("Preview Notice", "Could not automatically fetch metadata for this link. You can still publish it with your own title and description.");
      }
    } catch {
      // Non-blocking
    } finally {
      setFetchingPreview(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && !postType) return Alert.alert("Select Type", "Please choose a post type.");
    if (step === 2) {
      if (postType === "text" && !content) return Alert.alert("Required", "Please enter some content.");
      if (postType === "website" && !githubUrl) return Alert.alert("Required", "Please enter a live website URL.");
      if ((postType === "project" || postType === "capstone") && !title) return Alert.alert("Required", "Please enter a title.");
    }
    setStep((s) => (s + 1) as 1 | 2 | 3);
  };

  const handlePublish = async () => {
    if (!profile?.id) return;
    setIsPublishing(true);

    try {
      let finalImageKey: string | null = null;
      if (imageUri) {
        const path = `posts/${profile.id}-${Date.now()}.jpg`;
        const uploaded = await uploadToStorage(imageUri, 'assets', path, 'image/jpeg', MAX_UPLOAD_BYTES.image);
        if (uploaded) finalImageKey = uploaded.key;
      }

      let finalPreviewMetadata = previewData;
      if (postType === "website" && !finalPreviewMetadata && githubUrl) {
        try {
          finalPreviewMetadata = await fetchLinkPreview(githubUrl.trim());
        } catch {
          // Non-blocking
        }
      }

      const techArray = technologies ? technologies.split(',').map(t => t.trim()) : null;

      if (isEditing && postId) {
        // Edit mode — PUT /posts/:id
        await updatePost(postId, {
          content,
          type: postType || 'text',
          title: title || (finalPreviewMetadata?.title ?? null),
          technologies: techArray,
          github_url: githubUrl || null,
          preview_metadata: finalPreviewMetadata || null,
          ...(finalImageKey ? { image_url: finalImageKey } : {}),
        });
      } else {
        // Create mode — POST /posts
        const res = await apiFetch(`/posts`, {
          method: "POST",
          body: JSON.stringify({
            content,
            type: postType || 'text',
            title: title || (finalPreviewMetadata?.title ?? null),
            technologies: techArray,
            github_url: githubUrl || null,
            image_url: finalImageKey,
            preview_metadata: finalPreviewMetadata || null,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to create post");
        }
      }

      safeBack("/(tabs)");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to publish post");
    } finally {
      setIsPublishing(false);
    }
  };


  const handlePickImage = async () => {
    const result = await pickImage();
    if (result) setImageUri(result.uri);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {step > 1 ? (
            <TouchableOpacity onPress={() => setStep((s) => (s - 1) as 1 | 2 | 3)} style={{ padding: 4 }}>
              <ChevronLeft color={colors.textPrimary} size={26} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => safeBack("/(tabs)")} style={{ padding: 4 }}>
              <X color={colors.textPrimary} size={26} />
            </TouchableOpacity>
          )}
          <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 18 }}>{isEditing ? "Edit Post" : "Create Post"}</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          {step === 1 && (
            <Animated.View entering={FadeInDown.duration(400).springify()}>
              <Text style={{ color: colors.textTertiary, fontWeight: "700", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.8, marginBottom: 14 }}>Step 1 of 3: Select Format</Text>
              <OptionCard type="website" title="Live Website / Web App" desc="Share a hosted web project with automatic link preview." Icon={Globe} color="#0284C7" bg="#E0F2FE" selected={postType === "website"} onSelect={setPostType} />
              <OptionCard type="project" title="Showcase Project" desc="Display a coding project with tech stack and repo." Icon={FolderOpen} color="#10B981" bg="#D1FAE5" selected={postType === "project"} onSelect={setPostType} />
              <OptionCard type="capstone" title="Publish Capstone" desc="Officially share your final year capstone." Icon={GraduationCap} color="#F59E0B" bg="#FEF3C7" selected={postType === "capstone"} onSelect={setPostType} />
              <OptionCard type="text" title="Start a Discussion" desc="Share thoughts, ask questions, or start a debate." Icon={Type} color="#3B82F6" bg="#DBEAFE" selected={postType === "text"} onSelect={setPostType} />
              <OptionCard type="image" title="Share an Update" desc="Post an image with a caption of your recent work." Icon={ImageIcon} color="#8B5CF6" bg="#EDE9FE" selected={postType === "image"} onSelect={setPostType} />
            </Animated.View>
          )}

          {step === 2 && (
            <Animated.View entering={FadeInRight.duration(400).springify()}>
              <Text style={{ color: colors.textTertiary, fontWeight: "700", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.8, marginBottom: 14 }}>Step 2 of 3: Content</Text>
              
              {postType === "website" && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: "700", marginBottom: 6, fontSize: 12, textTransform: "uppercase" }}>Live Website URL</Text>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <TextInput
                      style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.action }}
                      placeholder="https://my-app.vercel.app"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="none"
                      keyboardType="url"
                      value={githubUrl}
                      onChangeText={setGithubUrl}
                      onBlur={() => loadPreview(githubUrl)}
                    />
                    <TouchableOpacity
                      onPress={() => loadPreview(githubUrl)}
                      disabled={fetchingPreview || !githubUrl.trim()}
                      style={{ marginLeft: 8, backgroundColor: colors.action, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, alignItems: "center", justifyContent: "center" }}
                    >
                      {fetchingPreview ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <RefreshCw size={18} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  </View>
                  <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 4, marginLeft: 2 }}>Tap the refresh icon to scan Open Graph preview metadata.</Text>
                </View>
              )}

              {postType === "website" && previewData && (
                <View style={{ marginBottom: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 }}>
                  <Text style={{ color: colors.action, fontWeight: "700", fontSize: 11, textTransform: "uppercase", marginBottom: 8 }}>Live Preview Detected</Text>
                  {previewData.image ? (
                    <Image
                      source={{ uri: previewData.image }}
                      style={{ width: "100%", height: 140, borderRadius: 10, marginBottom: 10, backgroundColor: colors.surfaceSunken }}
                      resizeMode="cover"
                    />
                  ) : null}
                  <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 15, marginBottom: 4 }}>{previewData.title || title}</Text>
                  {previewData.description ? (
                    <Text numberOfLines={2} style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 16 }}>{previewData.description}</Text>
                  ) : null}
                </View>
              )}

              {(postType === "project" || postType === "capstone" || postType === "website") && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: "700", marginBottom: 6, fontSize: 12, textTransform: "uppercase" }}>
                    {postType === "website" ? "Website Title" : "Project Title"}
                  </Text>
                  <TextInput
                    style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: "600", color: colors.textPrimary }}
                    placeholder={postType === "website" ? "e.g. IT Student Portfolio" : "e.g. LCCB Connect App"}
                    placeholderTextColor={colors.textTertiary}
                    value={title}
                    onChangeText={setTitle}
                  />
                </View>
              )}

              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", marginBottom: 6, fontSize: 12, textTransform: "uppercase" }}>
                  {postType === "text" ? "Discussion Topic" : "Description & Details"}
                </Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.textPrimary, minHeight: 140 }}
                  placeholder="What's on your mind? Be descriptive..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  textAlignVertical="top"
                  value={content}
                  onChangeText={setContent}
                />
              </View>

              {(postType === "image" || postType === "project" || postType === "capstone") && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: "700", marginBottom: 6, fontSize: 12, textTransform: "uppercase" }}>Cover Image</Text>
                  <TouchableOpacity 
                    onPress={handlePickImage}
                    style={{ backgroundColor: colors.surfaceSunken, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.borderStrong, borderRadius: 14, padding: 24, alignItems: "center", justifyContent: "center" }}
                  >
                    {imageUri ? (
                      <>
                        <CheckCircle2 color={colors.action} size={36} />
                        <Text style={{ color: colors.action, fontWeight: "700", marginTop: 8 }}>Image Selected</Text>
                      </>
                    ) : (
                      <>
                        <ImageIcon color={colors.textTertiary} size={36} />
                        <Text style={{ color: colors.textSecondary, fontWeight: "600", marginTop: 8 }}>Tap to upload from Gallery</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          )}

          {step === 3 && (
            <Animated.View entering={FadeInRight.duration(400).springify()}>
              <Text style={{ color: colors.textTertiary, fontWeight: "700", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.8, marginBottom: 14 }}>Step 3 of 3: Final Details</Text>
              
              {(postType === "project" || postType === "capstone" || postType === "website") ? (
                <>
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ color: colors.textSecondary, fontWeight: "700", marginBottom: 6, fontSize: 12, textTransform: "uppercase" }}>Tech Stack (comma separated)</Text>
                    <TextInput
                      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.textPrimary }}
                      placeholder="React, Next.js, Node.js, Tailwind"
                      placeholderTextColor={colors.textTertiary}
                      value={technologies}
                      onChangeText={setTechnologies}
                    />
                  </View>

                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ color: colors.textSecondary, fontWeight: "700", marginBottom: 6, fontSize: 12, textTransform: "uppercase" }}>
                      Repository Link (Optional)
                    </Text>
                    <TextInput
                      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.action }}
                      placeholder="https://github.com/username/repo"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="none"
                      keyboardType="url"
                      value={githubUrl}
                      onChangeText={setGithubUrl}
                    />
                  </View>
                </>
              ) : (
                <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 24, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <CheckCircle2 color="#10B981" size={50} />
                  <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 18, textAlign: "center", marginTop: 12 }}>Ready to Publish!</Text>
                  <Text style={{ color: colors.textTertiary, textAlign: "center", marginTop: 8, paddingHorizontal: 12, lineHeight: 20 }}>Your post is formatted and ready to be shared with the LCCB community.</Text>
                </View>
              )}
            </Animated.View>
          )}
          
          <View style={{ height: 20 }} />
        </ScrollView>

        <View style={{ padding: 18, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
          {step < 3 ? (
            <TouchableOpacity 
              onPress={handleNext}
              style={{ backgroundColor: colors.action, paddingVertical: 14, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16, marginRight: 6 }}>Continue</Text>
              <ChevronRight color="#FFFFFF" size={20} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={handlePublish}
              disabled={isPublishing}
              style={{ backgroundColor: isPublishing ? colors.surfaceSunken : colors.action, paddingVertical: 14, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16, marginRight: 6 }}>{isPublishing ? (isEditing ? "Saving..." : "Publishing...") : (isEditing ? "Save Changes" : "Publish Post")}</Text>
              {!isPublishing && <SendHorizontal color="#FFFFFF" size={18} />}
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}