import { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X, Type, Image as ImageIcon, FolderOpen, GraduationCap, ChevronRight, CheckCircle2, ChevronLeft } from "lucide-react-native";
import Animated, { FadeIn, FadeInRight, FadeOutLeft } from "react-native-reanimated";
import { useAuth } from "../src/contexts/AuthContext";
import { PROTOTYPE_POSTS, PROTOTYPE_USERS } from "../src/data/prototype";
import { supabase } from "../src/lib/supabase";
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
        // Assuming uploadToStorage is imported from '../src/lib/upload'
        finalImageUrl = await uploadToStorage(imageUri, 'assets', path, 'image/jpeg');
      }

      const { error } = await supabase.from('posts').insert({
        author_id: profile.id,
        title: title || (postType === "text" ? "Update" : "New Post"),
        description: content,
        type: postType || "text",
        tags: technologies ? technologies.split(",").map((t) => t.trim()) : [],
        preview_url: githubUrl || null,
        image_url: finalImageUrl,
      });

      if (error) throw error;

      Alert.alert("Success", "Your post has been published!", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const TypeOption = ({ type, label, icon: Icon, desc }: { type: PostType, label: string, icon: any, desc: string }) => {
    const selected = postType === type;
    return (
      <TouchableOpacity 
        onPress={() => setPostType(type)}
        style={{
          flexDirection: "row", alignItems: "center", padding: 16, marginBottom: 12,
          backgroundColor: selected ? "#EFF6FF" : "#F8FAFC",
          borderRadius: 16, borderWidth: 2, borderColor: selected ? "#3B82F6" : "transparent"
        }}
      >
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: selected ? "#3B82F6" : "#E2E8F0", alignItems: "center", justifyContent: "center", marginRight: 16 }}>
          <Icon size={24} color={selected ? "#FFFFFF" : "#64748B"} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#1E293B" }}>{label}</Text>
          <Text style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{desc}</Text>
        </View>
        {selected && <CheckCircle2 size={24} color="#3B82F6" />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
        <TouchableOpacity onPress={() => step === 1 ? router.back() : setStep((s) => (s - 1) as 1 | 2 | 3)} style={{ padding: 8 }}>
          {step === 1 ? <X size={24} color="#1E293B" /> : <ChevronLeft size={24} color="#1E293B" />}
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#1E293B" }}>
          {step === 1 ? "Create Post" : step === 2 ? "Post Details" : "Preview"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          
          {step === 1 && (
            <Animated.View entering={FadeInRight} exiting={FadeOutLeft}>
              <Text style={{ fontSize: 24, fontWeight: "800", color: "#1E293B", marginBottom: 8 }}>What do you want to share?</Text>
              <Text style={{ fontSize: 15, color: "#64748B", marginBottom: 24 }}>Choose the format that best fits your update.</Text>
              
              <TypeOption type="text" label="Discussion" icon={Type} desc="Start a conversation or ask a question." />
              <TypeOption type="image" label="Image update" icon={ImageIcon} desc="Share a photo or visual design." />
              <TypeOption type="project" label="Project" icon={FolderOpen} desc="Showcase an app, design, or codebase." />
              <TypeOption type="capstone" label="Capstone Thesis" icon={GraduationCap} desc="Publish final year research and outcomes." />
            </Animated.View>
          )}

          {step === 2 && (
            <Animated.View entering={FadeInRight} exiting={FadeOutLeft} style={{ gap: 16 }}>
              {(postType === "project" || postType === "capstone") && (
                <View>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 8 }}>{postType === "project" ? "Project Title" : "Research Title"}</Text>
                  <TextInput 
                    style={{ backgroundColor: "#F8FAFC", padding: 16, borderRadius: 12, fontSize: 16, color: "#1E293B", fontWeight: "600" }} 
                    placeholder="E.g. LCCB Connect Mobile App" 
                    value={title} onChangeText={setTitle} 
                  />
                </View>
              )}
              
              {postType === "image" && (
                <View>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 8 }}>Upload Photo</Text>
                  <TouchableOpacity 
                    onPress={async () => {
                      const file = await pickImage();
                      if (file) setImageUri(file.uri);
                    }}
                    style={{ backgroundColor: "#F8FAFC", height: 160, borderRadius: 12, borderWidth: 2, borderColor: "#E2E8F0", borderStyle: "dashed", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
                  >
                    {imageUri ? (
                      <View style={{ width: '100%', height: '100%' }}>
                        <Text style={{ position: 'absolute', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', padding: 4, bottom: 0, width: '100%', textAlign: 'center' }}>Tap to change</Text>
                        <Animated.Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} />
                      </View>
                    ) : (
                      <>
                        <ImageIcon size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
                        <Text style={{ fontSize: 14, color: "#64748B", fontWeight: "600" }}>Tap to browse</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              
              <View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 8 }}>{postType === "text" ? "What's on your mind?" : "Description"}</Text>
                <TextInput 
                  style={{ backgroundColor: "#F8FAFC", padding: 16, borderRadius: 12, fontSize: 16, color: "#1E293B", minHeight: 120, textAlignVertical: "top" }} 
                  placeholder={postType === "text" ? "Start typing..." : "Explain what it is..."}
                  multiline value={content} onChangeText={setContent} 
                />
              </View>

              {(postType === "project" || postType === "capstone") && (
                <>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 8 }}>Technologies Used</Text>
                    <TextInput 
                      style={{ backgroundColor: "#F8FAFC", padding: 16, borderRadius: 12, fontSize: 16, color: "#1E293B" }} 
                      placeholder="React Native, Node.js, etc." 
                      value={technologies} onChangeText={setTechnologies} 
                    />
                  </View>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 8 }}>Link (GitHub / Demo)</Text>
                    <TextInput 
                      style={{ backgroundColor: "#F8FAFC", padding: 16, borderRadius: 12, fontSize: 16, color: "#1E293B" }} 
                      placeholder="https://" 
                      value={githubUrl} onChangeText={setGithubUrl} autoCapitalize="none" keyboardType="url"
                    />
                  </View>
                </>
              )}
            </Animated.View>
          )}

          {step === 3 && (
            <Animated.View entering={FadeInRight} exiting={FadeOutLeft}>
              <View style={{ backgroundColor: "#F8FAFC", padding: 20, borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0" }}>
                {title ? <Text style={{ fontSize: 20, fontWeight: "800", color: "#1E293B", marginBottom: 12 }}>{title}</Text> : null}
                <Text style={{ fontSize: 16, color: "#334155", lineHeight: 24 }}>{content}</Text>
                
                {technologies ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                    {technologies.split(",").map(t => (
                      <View key={t} style={{ backgroundColor: "#DBEAFE", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ color: "#1D4ED8", fontSize: 12, fontWeight: "600" }}>{t.trim()}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </Animated.View>
          )}

        </ScrollView>

        <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: "#F1F5F9" }}>
          <TouchableOpacity 
            onPress={step === 3 ? handlePublish : handleNext}
            disabled={isPublishing}
            style={{ backgroundColor: isPublishing ? "#94A3B8" : "#1D4ED8", padding: 16, borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center" }}
            activeOpacity={0.8}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginRight: 8 }}>
              {isPublishing ? "Publishing..." : (step === 3 ? "Publish Post" : "Continue")}
            </Text>
            {step !== 3 && <ChevronRight size={20} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}