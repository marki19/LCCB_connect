import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator, Alert } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { pickImage, uploadToStorage } from "../src/lib/upload";
import { Camera, X, Check } from "lucide-react-native";
import { apiFetch } from "../src/lib/api";
import { safeBack } from "../src/lib/navigation";

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const { colors, isDark } = useTheme();
  
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
      safeBack("/(tabs)/profile");
    } catch (error: any) {
      Alert.alert("Error saving profile", error.message);
      setSaving(false);
      setUploadingImage(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => safeBack("/(tabs)/profile")} style={{ padding: 6 }}>
          <X color={colors.textSecondary} size={22} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving || uploadingImage} style={{ padding: 6 }}>
          {saving ? <ActivityIndicator size="small" color={colors.action} /> : <Check color={colors.action} size={22} />}
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        
        {/* Avatar Picker */}
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <TouchableOpacity 
            onPress={handlePickImage} 
            style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.surfaceSunken, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 4, borderColor: colors.surface }}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
              <Camera color={colors.textTertiary} size={32} />
            )}
            <View style={{ position: "absolute", bottom: 0, width: "100%", backgroundColor: "rgba(0,0,0,0.45)", paddingVertical: 4, alignItems: "center" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 }}>Edit</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={{ gap: 20, marginBottom: 40 }}>
          <View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary, marginBottom: 8, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.6 }}>Full Name</Text>
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: colors.border }}>
              <TextInput
                style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "500" }}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Juan Dela Cruz"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          </View>

          <View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary, marginBottom: 8, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.6 }}>Bio</Text>
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: colors.border, minHeight: 100 }}>
              <TextInput
                style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "500" }}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself..."
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>

          <View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary, marginBottom: 8, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.6 }}>Department & Course</Text>
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "600" }}>
                {profile?.department_name || "—"}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4 }}>
                {profile?.course_name || "—"}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 8 }}>
                Assigned at registration. Contact an administrator to change it.
              </Text>
            </View>
          </View>

          <View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary, marginBottom: 8, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.6 }}>Year Level</Text>
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: colors.border }}>
              <TextInput
                style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "500" }}
                value={yearLevel}
                onChangeText={setYearLevel}
                placeholder="e.g. 3rd Year"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          </View>

          <View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textSecondary, marginBottom: 8, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.6 }}>Skills</Text>
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {skills.map((skill, index) => (
                  <View key={index} style={{ backgroundColor: colors.actionSurface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ color: colors.action, fontWeight: "600", fontSize: 13 }}>{skill}</Text>
                    <TouchableOpacity 
                      onPress={() => setSkills(skills.filter((_, i) => i !== index))}
                      style={{ marginLeft: 8, backgroundColor: colors.actionSurfaceAlt, borderRadius: 10, padding: 2 }}
                    >
                      <X color={colors.action} size={12} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <TextInput
                style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "500" }}
                value={newSkill}
                onChangeText={setNewSkill}
                placeholder="e.g. React Native (press enter to add)"
                placeholderTextColor={colors.textTertiary}
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
