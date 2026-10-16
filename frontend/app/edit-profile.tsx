import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator, Alert } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { pickImage, uploadToStorage } from "../src/lib/upload";
import { Camera, X, Check } from "lucide-react-native";
import { apiFetch } from "../src/lib/api";

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [yearLevel, setYearLevel] = useState(profile?.year_level || "");
  const [skills, setSkills] = useState<string[]>(profile?.skills || []);
  const [newSkill, setNewSkill] = useState("");
  
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url || null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePickImage = async () => {
    const file = await pickImage();
    if (file) {
      setAvatarUri(file.uri);
    }
  };

  const handleSave = async () => {
    if (!session?.user) return;
    
    setSaving(true);
    try {
      let finalAvatarUrl = profile?.avatar_url;

      // If the user picked a new image (and it's a local file URI, not a remote http URL)
      if (avatarUri && !avatarUri.startsWith('http')) {
        setUploadingImage(true);
        const path = `avatars/${session.user.id}-${Date.now()}.jpg`;
        const uploadedUrl = await uploadToStorage(avatarUri, 'assets', path, 'image/jpeg');
        if (uploadedUrl) {
          finalAvatarUrl = uploadedUrl;
        }
        setUploadingImage(false);
      }

      const res = await apiFetch(`/users/${session.user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          full_name: fullName.trim(),
          bio: bio.trim(),
          year_level: yearLevel.trim(),
          skills: skills,
          avatar_url: finalAvatarUrl,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update profile via backend");
      }
      
      // Force context to re-fetch would be ideal, but for now we just dismiss modal
      router.back();
    } catch (error: any) {
      Alert.alert("Error saving profile", error.message);
      setSaving(false);
      setUploadingImage(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-[#F8FAFC]">
      {/* Header */}
      <View className="flex-row justify-between items-center px-4 py-4 bg-white border-b border-slate-200">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <X color="#64748B" size={24} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-slate-800">Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving || uploadingImage} className="p-2">
          {saving ? <ActivityIndicator size="small" color="#1D4ED8" /> : <Check color="#1D4ED8" size={24} />}
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
        
        {/* Avatar Picker */}
        <View className="items-center mb-8">
          <TouchableOpacity 
            onPress={handlePickImage} 
            className="w-28 h-28 rounded-full bg-slate-200 items-center justify-center overflow-hidden border-4 border-white shadow-sm"
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <Camera color="#94A3B8" size={32} />
            )}
            <View className="absolute bottom-0 w-full bg-black/40 py-1 items-center">
              <Text className="text-white text-[10px] font-bold uppercase tracking-wider">Edit</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View className="space-y-6 mb-12">
          <View>
            <Text className="text-sm font-bold text-slate-700 mb-2 ml-1 uppercase tracking-wider">Full Name</Text>
            <View className="bg-white rounded-2xl px-5 py-4 border border-slate-200">
              <TextInput
                className="text-slate-900 text-base font-medium outline-none"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Juan Dela Cruz"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View>
            <Text className="text-sm font-bold text-slate-700 mb-2 ml-1 uppercase tracking-wider">Bio</Text>
            <View className="bg-white rounded-2xl px-5 py-4 border border-slate-200 min-h-[100px]">
              <TextInput
                className="text-slate-900 text-base font-medium outline-none"
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself..."
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>

          <View>
            <Text className="text-sm font-bold text-slate-700 mb-2 ml-1 uppercase tracking-wider">Department &amp; Course</Text>
            <View className="bg-white rounded-2xl px-5 py-4 border border-slate-200">
              <Text className="text-slate-900 text-base font-semibold">
                {profile?.department_name || "—"}
              </Text>
              <Text className="text-slate-500 text-sm mt-1">
                {profile?.course_name || "—"}
              </Text>
              <Text className="text-slate-400 text-xs mt-2">
                Assigned at registration. Contact an administrator to change it.
              </Text>
            </View>
          </View>

          <View>
            <Text className="text-sm font-bold text-slate-700 mb-2 ml-1 uppercase tracking-wider">Year Level</Text>
            <View className="bg-white rounded-2xl px-5 py-4 border border-slate-200">
              <TextInput
                className="text-slate-900 text-base font-medium outline-none"
                value={yearLevel}
                onChangeText={setYearLevel}
                placeholder="e.g. 3rd Year"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View>
            <Text className="text-sm font-bold text-slate-700 mb-2 ml-1 uppercase tracking-wider">Skills</Text>
            <View className="bg-white rounded-2xl p-4 border border-slate-200">
              <View className="flex-row flex-wrap gap-2 mb-3">
                {skills.map((skill, index) => (
                  <View key={index} className="bg-[#DBEAFE] px-3 py-1.5 rounded-full flex-row items-center">
                    <Text className="text-[#1D4ED8] font-semibold text-sm">{skill}</Text>
                    <TouchableOpacity 
                      onPress={() => setSkills(skills.filter((_, i) => i !== index))}
                      className="ml-2 bg-[#BFDBFE] rounded-full p-0.5"
                    >
                      <X color="#1D4ED8" size={12} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <TextInput
                className="text-slate-900 text-base font-medium outline-none"
                value={newSkill}
                onChangeText={setNewSkill}
                placeholder="e.g. React Native (press enter to add)"
                placeholderTextColor="#94A3B8"
                onSubmitEditing={() => {
                  if (newSkill.trim() && !skills.includes(newSkill.trim())) {
                    setSkills([...skills, newSkill.trim()]);
                    setNewSkill("");
                  }
                }}
              />
            </View>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
