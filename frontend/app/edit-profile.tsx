import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
/* router unused - back navigation happens via safeBack() */
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useToast } from "../src/contexts/ToastContext";
import { pickImage, uploadToStorage, MAX_UPLOAD_BYTES } from "../src/lib/upload";
import { ArrowLeft, Camera, X, Check } from "lucide-react-native";
import { apiFetch } from "../src/lib/api";
import { safeBack } from "../src/lib/navigation";
import { RADIUS, SPACE, TYPE } from "../src/lib/tokens";
import Button, { IconButton } from "../src/components/ui/Button";
import Card from "../src/components/ui/Card";
import Modal from "../src/components/ui/Modal";
import TextField from "../src/components/ui/TextField";

function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: SPACE.x4 }}>
      <Text
        style={{
          fontSize: 13,
          lineHeight: 18,
          fontWeight: "600",
          color: colors.textSecondary,
          marginBottom: SPACE.x2,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          backgroundColor: colors.surfaceSunken,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: colors.line,
          paddingHorizontal: SPACE.x3,
          paddingVertical: SPACE.x3,
        }}
      >
        <Text style={{ ...TYPE.body, fontWeight: "600", color: colors.ink }}>{value}</Text>
        {hint ? (
          <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 4 }}>{hint}</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function EditProfileScreen() {
  const { profile, session } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [bio, setBio] = useState(profile?.bio || "");
  const [yearLevel, setYearLevel] = useState(profile?.year_level || "");
  const [skills, setSkills] = useState<string[]>(profile?.skills || []);
  const [newSkill, setNewSkill] = useState("");

  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url || null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
      // If the user picked a new image (and it's a local file URI, not a remote http URL)
      let finalAvatarKey: string | null = null;
      if (avatarUri && !avatarUri.startsWith("http")) {
        setUploadingImage(true);
        const path = `avatars/${session.user.id}-${Date.now()}.jpg`;
        const uploaded = await uploadToStorage(
          avatarUri,
          "avatars",
          path,
          "image/jpeg",
          MAX_UPLOAD_BYTES.avatar
        );
        if (uploaded) finalAvatarKey = uploaded.key;
        setUploadingImage(false);
      }

      const res = await apiFetch(`/users/${session.user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          bio: bio.trim(),
          year_level: yearLevel.trim(),
          skills: skills,
          // Only sent when a new avatar was uploaded: the server stores object
          // keys, and the existing (URL-rendered) value must not be echoed back.
          ...(finalAvatarKey ? { avatar_url: finalAvatarKey } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update profile via backend");
      }

      // Show success confirmation toast and dismiss modal
      showToast({ message: "Profile updated successfully.", tone: "success" });
      safeBack("/(tabs)/profile");
    } catch (error: any) {
      setNotice(error.message || "Something went wrong while saving your profile.");
      setSaving(false);
      setUploadingImage(false);
    }
  };

  const addSkill = () => {
    const trimmed = newSkill.trim().slice(0, 50);
    if (!trimmed) return;
    if (skills.length >= 30) {
      setNotice("You can add at most 30 skills.");
      return;
    }
    if (skills.includes(trimmed)) {
      setNewSkill("");
      return;
    }
    setSkills([...skills, trimmed]);
    setNewSkill("");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.x3,
            paddingHorizontal: SPACE.x4,
            minHeight: 64,
            backgroundColor: colors.panel,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          }}
        >
          <IconButton icon={ArrowLeft} label="Back to profile" onPress={() => safeBack("/(tabs)/profile")} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>Account</Text>
            <Text style={{ ...TYPE.h2, color: colors.ink }}>Edit profile</Text>
          </View>
          <Button
            label="Save"
            size="sm"
            icon={Check}
            onPress={() => void handleSave()}
            loading={saving || uploadingImage}
            disabled={saving || uploadingImage}
          />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View
            style={{
              width: "100%",
              maxWidth: 640,
              alignSelf: "center",
              padding: SPACE.x4,
              paddingBottom: SPACE.x10,
            }}
          >
            {/* Avatar picker */}
            <View style={{ alignItems: "center", marginBottom: SPACE.x6 }}>
              <Pressable
                onPress={() => void handlePickImage()}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
                onFocus={() => {}}
                style={({ pressed }) => ({
                  width: 112,
                  height: 112,
                  borderRadius: 56,
                  backgroundColor: colors.surfaceSunken,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  borderWidth: 4,
                  borderColor: colors.surface,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                ) : (
                  <Camera color={colors.inkFaint} size={32} />
                )}
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    width: "100%",
                    backgroundColor: colors.surfaceOverlay,
                    paddingVertical: 5,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: colors.textOnBrandSolid,
                      fontSize: 10,
                      fontWeight: "700",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                    }}
                  >
                    Edit
                  </Text>
                </View>
              </Pressable>
              <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: SPACE.x2 }}>
                Tap to change your profile photo
              </Text>
            </View>

            <Card>
              <ReadOnlyField
                label="Full name"
                value={profile?.full_name || "—"}
                hint="Set during signup; contact an administrator to change it."
              />

              <TextField
                label="Bio"
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself…"
                multiline
                maxLength={500}
                minHeight={110}
                hint={`${bio.length}/500`}
                autoCapitalize="sentences"
              />

              <ReadOnlyField
                label="Department & course"
                value={profile?.department_name || "—"}
                hint={profile?.course_name || "Assigned by administrators."}
              />

              <TextField
                label="Year level"
                value={yearLevel}
                onChangeText={setYearLevel}
                placeholder="e.g. 3rd Year"
                autoCapitalize="words"
              />

              <View>
                <Text
                  style={{
                    fontSize: 13,
                    lineHeight: 18,
                    fontWeight: "600",
                    color: colors.textSecondary,
                    marginBottom: SPACE.x2,
                  }}
                >
                  Skills
                </Text>
                <View
                  style={{
                    backgroundColor: colors.inputBg,
                    borderRadius: RADIUS.md,
                    borderWidth: 1,
                    borderColor: colors.inputBorder,
                    padding: SPACE.x3,
                  }}
                >
                  {skills.length > 0 ? (
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: SPACE.x2,
                        marginBottom: SPACE.x3,
                      }}
                    >
                      {skills.map((skill, index) => (
                        <View
                          key={`${skill}-${index}`}
                          style={{
                            backgroundColor: colors.brandWash,
                            paddingHorizontal: SPACE.x3,
                            paddingVertical: 6,
                            borderRadius: RADIUS.pill,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: SPACE.x2,
                          }}
                        >
                          <Text style={{ ...TYPE.caption, fontWeight: "600", color: colors.brand }}>
                            {skill}
                          </Text>
                          <Pressable
                            onPress={() => setSkills(skills.filter((_, i) => i !== index))}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${skill}`}
                            hitSlop={6}
                            style={({ pressed }) => ({
                              borderRadius: 9,
                              padding: 2,
                              backgroundColor: colors.panel,
                              opacity: pressed ? 0.6 : 1,
                            })}
                          >
                            <X color={colors.brand} size={12} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <TextInput
                    style={{
                      color: colors.ink,
                      fontSize: 15,
                      fontWeight: "500",
                      paddingVertical: SPACE.x1,
                      outlineStyle: "none",
                    } as any}
                    value={newSkill}
                    onChangeText={setNewSkill}
                    placeholder="e.g. React Native (press enter to add)"
                    placeholderTextColor={colors.textTertiary}
                    accessibilityLabel="Add a skill"
                    onSubmitEditing={addSkill}
                    returnKeyType="done"
                  />
                </View>
                <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: SPACE.x2 }}>
                  Press enter after each skill to add it.
                </Text>
              </View>
            </Card>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={!!notice}
        onClose={() => setNotice(null)}
        maxWidth={440}
        accessibilityLabel="Could not save profile"
      >
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>Could not save profile</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>{notice}</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: SPACE.x5 }}>
            <Button label="Got it" onPress={() => setNotice(null)} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
