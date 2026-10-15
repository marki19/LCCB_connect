import { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X, Type, Image as ImageIcon, FolderOpen, GraduationCap, ChevronRight, CheckCircle2, ChevronLeft, SendHorizontal } from "lucide-react-native";
import Animated, { FadeIn, FadeInRight, FadeOutLeft, FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../src/contexts/AuthContext";
import { uploadToStorage, pickImage } from "../src/lib/upload";

type PostType = "text" | "image" | "project" | "capstone" | null;

export default function CreatePostModal() {
  const router = useRouter();
  const { profile } = useAuth();
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [postType, setPostType] = useState<PostType>(null);
  
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [technologies, setTechnologies] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const handleNext = () => {
    if (step === 1 && !postType) return Alert.alert("Select Type", "Please choose a post type.");
    if (step === 2) {
      if (postType === "text" && !content) return Alert.alert("Required", "Please enter some content.");
      if ((postType === "project" || postType === "capstone") && !title) return Alert.alert("Required", "Please enter a title.");
    }
    setStep((s) => (s + 1) as 1 | 2 | 3);
  };

  const handlePublish = async () => {
    if (!profile?.id) return;
    setIsPublishing(true);

    try {
      let finalImageUrl = null;
      if (imageUri) {
        const path = `posts/${profile.id}-${Date.now()}.jpg`;
        finalImageUrl = await uploadToStorage(imageUri, 'assets', path, 'image/jpeg');
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${apiUrl}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_id: profile.id,
          content: content,
          type: postType || 'text',
          title: title || null,
          technologies: technologies ? technologies.split(',').map(t => t.trim()) : null,
          github_url: githubUrl || null,
          image_url: finalImageUrl,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create post");
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
            <Text className="text-slate-900 font-extrabold text-xl tracking-tight">Create Post</Text>
            <View className="w-10" />
          </View>

          <ScrollView contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
            {step === 1 && (
              <Animated.View entering={FadeInDown.duration(400).springify()}>
                <Text className="text-slate-500 font-semibold uppercase tracking-widest text-xs mb-6">Step 1 of 3: Select Format</Text>
                <OptionCard type="text" title="Start a Discussion" desc="Share thoughts, ask questions, or start a debate." Icon={Type} color="#3B82F6" bg="bg-blue-100" />
                <OptionCard type="image" title="Share an Update" desc="Post an image with a caption of your recent work." Icon={ImageIcon} color="#8B5CF6" bg="bg-purple-100" />
                <OptionCard type="project" title="Showcase Project" desc="Display a coding project with tech stack and repo." Icon={FolderOpen} color="#10B981" bg="bg-emerald-100" />
                <OptionCard type="capstone" title="Publish Capstone" desc="Officially share your final year capstone." Icon={GraduationCap} color="#F59E0B" bg="bg-amber-100" />
              </Animated.View>
            )}

            {step === 2 && (
              <Animated.View entering={FadeInRight.duration(400).springify()}>
                <Text className="text-slate-500 font-semibold uppercase tracking-widest text-xs mb-6">Step 2 of 3: Content</Text>
                
                {(postType === "project" || postType === "capstone") && (
                  <View className="mb-6">
                    <Text className="text-slate-700 font-bold mb-2 uppercase tracking-wide text-xs">Project Title</Text>
                    <TextInput
                      className="bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base font-semibold text-slate-900 shadow-sm shadow-slate-100"
                      placeholder="e.g. LCCB Connect App"
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
                
                {(postType === "project" || postType === "capstone") ? (
                  <>
                    <View className="mb-6">
                      <Text className="text-slate-700 font-bold mb-2 uppercase tracking-wide text-xs">Tech Stack (comma separated)</Text>
                      <TextInput
                        className="bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base font-medium text-slate-800 shadow-sm shadow-slate-100"
                        placeholder="React Native, Node.js, Supabase"
                        placeholderTextColor="#94A3B8"
                        value={technologies}
                        onChangeText={setTechnologies}
                      />
                    </View>

                    <View className="mb-8">
                      <Text className="text-slate-700 font-bold mb-2 uppercase tracking-wide text-xs">Repository Link (Optional)</Text>
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
                <Text className="text-white font-bold text-lg mr-2">{isPublishing ? "Publishing..." : "Publish Post"}</Text>
                {!isPublishing && <SendHorizontal color="#FFF" size={20} />}
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}