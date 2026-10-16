import { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { X, Type, Image as ImageIcon, FolderOpen, GraduationCap, Globe, RefreshCw, ChevronRight, CheckCircle2, ChevronLeft, SendHorizontal, ExternalLink } from "lucide-react-native";
import Animated, { FadeIn, FadeInRight, FadeOutLeft, FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../src/contexts/AuthContext";
import { uploadToStorage, pickImage } from "../src/lib/upload";
import { apiFetch, updatePost } from "../src/lib/api";
import { fetchLinkPreview, LinkPreviewData } from "../src/lib/linkPreview";

type PostType = "text" | "image" | "project" | "capstone" | "website" | null;

export default function CreatePostModal() {
  const router = useRouter();
  const { profile } = useAuth();

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
      let finalImageUrl: string | null = null;
      if (imageUri) {
        const path = `posts/${profile.id}-${Date.now()}.jpg`;
        finalImageUrl = await uploadToStorage(imageUri, 'assets', path, 'image/jpeg');
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
          ...(finalImageUrl ? { image_url: finalImageUrl } : {}),
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
            image_url: finalImageUrl,
            preview_metadata: finalPreviewMetadata || null,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to create post");
        }
      }

      router.back();
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

  const OptionCard = ({ type, title, desc, Icon, color, bg }: any) => (
    <TouchableOpacity
      onPress={() => setPostType(type)}
      className={`p-5 rounded-2xl mb-4 flex-row items-center border ${postType === type ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'} shadow-sm`}
      activeOpacity={0.7}
    >
      <View className={`w-14 h-14 rounded-full items-center justify-center mr-4 ${bg}`}>
        <Icon color={color} size={28} />
      </View>
      <View className="flex-1">
        <Text className={`text-lg font-bold ${postType === type ? 'text-indigo-900' : 'text-slate-800'}`}>{title}</Text>
        <Text className="text-slate-500 text-sm mt-1 leading-5">{desc}</Text>
      </View>
      <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${postType === type ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
        {postType === type && <CheckCircle2 color="#FFFFFF" size={16} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <LinearGradient colors={["#F8FAFC", "#EEF2FF"]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View className="flex-row items-center justify-between px-6 py-4 bg-white/80 border-b border-slate-200/50">
            {step > 1 ? (
              <TouchableOpacity onPress={() => setStep((s) => (s - 1) as 1 | 2 | 3)} className="p-2 -ml-2">
                <ChevronLeft color="#1E293B" size={28} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                <X color="#1E293B" size={28} />
              </TouchableOpacity>
            )}
            <Text className="text-slate-900 font-extrabold text-xl tracking-tight">{isEditing ? "Edit Post" : "Create Post"}</Text>
            <View className="w-10" />
          </View>

          <ScrollView contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
            {step === 1 && (
              <Animated.View entering={FadeInDown.duration(400).springify()}>
                <Text className="text-slate-500 font-semibold uppercase tracking-widest text-xs mb-6">Step 1 of 3: Select Format</Text>
                <OptionCard type="website" title="Live Website / Web App" desc="Share a hosted web project with automatic link preview." Icon={Globe} color="#0284C7" bg="bg-sky-100" />
                <OptionCard type="project" title="Showcase Project" desc="Display a coding project with tech stack and repo." Icon={FolderOpen} color="#10B981" bg="bg-emerald-100" />
                <OptionCard type="capstone" title="Publish Capstone" desc="Officially share your final year capstone." Icon={GraduationCap} color="#F59E0B" bg="bg-amber-100" />
                <OptionCard type="text" title="Start a Discussion" desc="Share thoughts, ask questions, or start a debate." Icon={Type} color="#3B82F6" bg="bg-blue-100" />
                <OptionCard type="image" title="Share an Update" desc="Post an image with a caption of your recent work." Icon={ImageIcon} color="#8B5CF6" bg="bg-purple-100" />
              </Animated.View>
            )}

            {step === 2 && (
              <Animated.View entering={FadeInRight.duration(400).springify()}>
                <Text className="text-slate-500 font-semibold uppercase tracking-widest text-xs mb-6">Step 2 of 3: Content</Text>
                
                {postType === "website" && (
                  <View className="mb-6">
                    <Text className="text-slate-700 font-bold mb-2 uppercase tracking-wide text-xs">Live Website URL</Text>
                    <View className="flex-row items-center">
                      <TextInput
                        className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base text-sky-600 font-medium shadow-sm shadow-slate-100"
                        placeholder="https://my-app.vercel.app"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="none"
                        keyboardType="url"
                        value={githubUrl}
                        onChangeText={setGithubUrl}
                        onBlur={() => loadPreview(githubUrl)}
                      />
                      <TouchableOpacity
                        onPress={() => loadPreview(githubUrl)}
                        disabled={fetchingPreview || !githubUrl.trim()}
                        className="ml-2 bg-sky-600 px-4 py-4 rounded-2xl items-center justify-center"
                      >
                        {fetchingPreview ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <RefreshCw size={18} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    </View>
                    <Text className="text-slate-400 text-xs mt-1 ml-1">Tap the refresh icon to scan Open Graph preview metadata.</Text>
                  </View>
                )}

                {postType === "website" && previewData && (
                  <View className="mb-6 bg-white border border-sky-200 rounded-2xl p-4 shadow-sm shadow-slate-100">
                    <Text className="text-sky-700 font-bold text-xs uppercase mb-2">Live Preview Detected</Text>
                    {previewData.image ? (
                      <Image
                        source={{ uri: previewData.image }}
                        className="w-full h-36 rounded-xl mb-3 bg-slate-100"
                        resizeMode="cover"
                      />
                    ) : null}
                    <Text className="text-slate-900 font-bold text-base mb-1">{previewData.title || title}</Text>
                    {previewData.description ? (
                      <Text numberOfLines={2} className="text-slate-600 text-xs leading-4">{previewData.description}</Text>
                    ) : null}
                  </View>
                )}

                {(postType === "project" || postType === "capstone" || postType === "website") && (
                  <View className="mb-6">
                    <Text className="text-slate-700 font-bold mb-2 uppercase tracking-wide text-xs">
                      {postType === "website" ? "Website Title" : "Project Title"}
                    </Text>
                    <TextInput
                      className="bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base font-semibold text-slate-900 shadow-sm shadow-slate-100"
                      placeholder={postType === "website" ? "e.g. IT Student Portfolio" : "e.g. LCCB Connect App"}
                      placeholderTextColor="#94A3B8"
                      value={title}
                      onChangeText={setTitle}
                    />
                  </View>
                )}

                <View className="mb-6">
                  <Text className="text-slate-700 font-bold mb-2 uppercase tracking-wide text-xs">
                    {postType === "text" ? "Discussion Topic" : "Description & Details"}
                  </Text>
                  <TextInput
                    className="bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base text-slate-800 min-h-[160px] shadow-sm shadow-slate-100"
                    placeholder="What's on your mind? Be descriptive..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    textAlignVertical="top"
                    value={content}
                    onChangeText={setContent}
                  />
                </View>

                {(postType === "image" || postType === "project" || postType === "capstone") && (
                  <View className="mb-6">
                    <Text className="text-slate-700 font-bold mb-2 uppercase tracking-wide text-xs">Cover Image</Text>
                    <TouchableOpacity 
                      onPress={handlePickImage}
                      className="bg-indigo-50/50 border-2 border-dashed border-indigo-200 rounded-2xl p-8 items-center justify-center"
                    >
                      {imageUri ? (
                        <>
                          <CheckCircle2 color="#4F46E5" size={40} className="mb-2" />
                          <Text className="text-indigo-700 font-bold mt-2">Image Selected</Text>
                        </>
                      ) : (
                        <>
                          <ImageIcon color="#818CF8" size={40} className="mb-2" />
                          <Text className="text-indigo-600 font-semibold mt-2">Tap to upload from Gallery</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </Animated.View>
            )}

            {step === 3 && (
              <Animated.View entering={FadeInRight.duration(400).springify()}>
                <Text className="text-slate-500 font-semibold uppercase tracking-widest text-xs mb-6">Step 3 of 3: Final Details</Text>
                
                {(postType === "project" || postType === "capstone" || postType === "website") ? (
                  <>
                    <View className="mb-6">
                      <Text className="text-slate-700 font-bold mb-2 uppercase tracking-wide text-xs">Tech Stack (comma separated)</Text>
                      <TextInput
                        className="bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base font-medium text-slate-800 shadow-sm shadow-slate-100"
                        placeholder="React, Next.js, Node.js, Tailwind"
                        placeholderTextColor="#94A3B8"
                        value={technologies}
                        onChangeText={setTechnologies}
                      />
                    </View>

                    <View className="mb-8">
                      <Text className="text-slate-700 font-bold mb-2 uppercase tracking-wide text-xs">
                        {postType === "website" ? "Repository Link (Optional)" : "Repository Link (Optional)"}
                      </Text>
                      <TextInput
                        className="bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base text-indigo-600 font-medium shadow-sm shadow-slate-100"
                        placeholder="https://github.com/username/repo"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="none"
                        keyboardType="url"
                        value={githubUrl}
                        onChangeText={setGithubUrl}
                      />
                    </View>
                  </>
                ) : (
                  <View className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm shadow-slate-100 items-center justify-center mb-8">
                    <CheckCircle2 color="#10B981" size={60} className="mb-4" />
                    <Text className="text-slate-900 font-bold text-xl text-center">Ready to Publish!</Text>
                    <Text className="text-slate-500 text-center mt-2 px-4 leading-6">Your post is formatted perfectly and ready to be shared with the LCCB community.</Text>
                  </View>
                )}
              </Animated.View>
            )}
            
            <View className="h-20" />
          </ScrollView>

          <View className="p-6 bg-white/90 border-t border-slate-100">
            {step < 3 ? (
              <TouchableOpacity 
                onPress={handleNext}
                className="bg-indigo-600 py-4 rounded-2xl flex-row items-center justify-center shadow-lg shadow-indigo-600/40"
              >
                <Text className="text-white font-bold text-lg mr-2">Continue</Text>
                <ChevronRight color="#FFF" size={24} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                onPress={handlePublish}
                disabled={isPublishing}
                className={`py-4 rounded-2xl flex-row items-center justify-center shadow-lg ${isPublishing ? 'bg-indigo-400 shadow-indigo-400/20' : 'bg-indigo-600 shadow-indigo-600/40'}`}
              >
                <Text className="text-white font-bold text-lg mr-2">{isPublishing ? (isEditing ? "Saving..." : "Publishing...") : (isEditing ? "Save Changes" : "Publish Post")}</Text>
                {!isPublishing && <SendHorizontal color="#FFF" size={20} />}
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}