import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ArrowLeft, UploadCloud, FileText, CheckCircle2, ChevronRight, BookOpen, AlertCircle } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { uploadToStorage, MAX_UPLOAD_BYTES } from "../src/lib/upload";
import { apiFetch, updateThesis } from "../src/lib/api";
import { safeBack } from "../src/lib/navigation";

export default function UploadThesisScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();

  // Edit mode: set when the uploader opens "Edit" on their own thesis card.
  const { thesisId } = useLocalSearchParams<{ thesisId?: string }>();
  const isEditing = !!thesisId;

  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [category, setCategory] = useState<string>("Undergraduate Capstone");
  const [pdfFile, setPdfFile] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [loadError, setLoadError] = useState("");

  // In edit mode, prefill from the stored manuscript (fetch-on-mount avoids
  // passing a 10k-character abstract through router params).
  useEffect(() => {
    if (!thesisId) return;
    let active = true;
    (async () => {
      try {
        const res = await apiFetch(`/theses/${thesisId}`);
        if (!res.ok) throw new Error(`Could not load the manuscript (${res.status})`);
        const t = await res.json();
        if (!active) return;
        setTitle(t.title || "");
        setAbstract(t.abstract || "");
        if (t.category) setCategory(t.category);
      } catch (e: any) {
        if (active) setLoadError(e.message || "Could not load the manuscript.");
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [thesisId]);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        setPdfFile(result.assets[0]);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not select the document.");
    }
  };

  const handleUpload = async () => {
    if (!title || !abstract || (!isEditing && !pdfFile)) {
      Alert.alert(
        "Missing Fields",
        isEditing
          ? "Please fill out the manuscript title and abstract."
          : "Please fill out all fields and select a PDF manuscript."
      );
      return;
    }
    if (!profile?.id) return;

    setIsUploading(true);
    try {
      // Only upload when a file was picked; in edit mode an untouched picker
      // means "keep the stored manuscript".
      let pdfKey: string | null = null;
      if (pdfFile) {
        const ext = pdfFile.name.split('.').pop() || "pdf";
        const filePath = `${profile.id}/${Date.now()}.${ext}`;
        const uploaded = await uploadToStorage(pdfFile.uri, 'theses', filePath, pdfFile.mimeType || 'application/pdf', MAX_UPLOAD_BYTES.pdf);
        if (!uploaded) throw new Error("Failed to upload the file to Supabase Storage.");
        pdfKey = uploaded.key;
      }

      if (isEditing) {
        // Partial update — ownership is enforced server-side (404 otherwise).
        await updateThesis(thesisId!, {
          title,
          abstract,
          category,
          ...(pdfKey ? { pdf_url: pdfKey } : {}),
        });
      } else {
        const res = await apiFetch(`/theses`, {
          method: "POST",
          body: JSON.stringify({
            title,
            abstract,
            category,
            pdf_url: pdfKey,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to save manuscript to backend database");
        }
      }

      Alert.alert(
        "Success",
        isEditing
          ? "Changes saved to the repository!"
          : "Manuscript successfully uploaded to the repository!"
      );
      safeBack("/(tabs)/search");
    } catch (error: any) {
      console.error("Upload error:", error);
      Alert.alert("Upload Failed", error.message || "An unknown error occurred.");
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.action} />
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <AlertCircle size={44} color={colors.destructive} />
        <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 18, marginTop: 16, textAlign: "center" }}>{loadError}</Text>
        <TouchableOpacity onPress={() => safeBack("/(tabs)/search")} style={{ marginTop: 24 }}>
          <Text style={{ color: colors.action, fontWeight: "600" }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <LinearGradient colors={[colors.surfacePage, isDark ? "hsl(215, 30%, 14%)" : "#EEF2FF"]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => safeBack("/(tabs)/search")} style={{ padding: 6, marginLeft: -6 }}>
              <ArrowLeft color={colors.textPrimary} size={24} />
            </TouchableOpacity>
            <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 18, letterSpacing: -0.3 }}>{isEditing ? "Edit Manuscript" : "Deposit Manuscript"}</Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
            
            <Animated.View entering={FadeInDown.duration(400).springify()} style={{ marginBottom: 28, alignItems: "center" }}>
              <View style={{ width: 60, height: 60, backgroundColor: colors.actionSurface, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <BookOpen color={colors.action} size={28} />
              </View>
              <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 22, textAlign: "center" }}>{isEditing ? "Update Your Manuscript" : "Contribute to the Repository"}</Text>
              <Text style={{ color: colors.textTertiary, textAlign: "center", marginTop: 8, paddingHorizontal: 16, lineHeight: 20, fontSize: 14 }}>{isEditing ? "Apply changes to your deposited capstone or dissertation." : "Upload your capstone or dissertation to the LCCB Digital Thesis Repository."}</Text>
            </Animated.View>

            <Animated.View entering={FadeInRight.delay(100).duration(400).springify()}>
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 12 }}>Manuscript Title</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontWeight: "600", color: colors.textPrimary }}
                  placeholder="e.g. AI-Powered Farming Assistance..."
                  placeholderTextColor={colors.textTertiary}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 12 }}>Department / Program</Text>
                <View style={{ backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 }}>
                  <Text style={{ fontSize: 16, color: colors.textPrimary }}>
                    {profile?.department_name || "No department on file"}
                  </Text>
                </View>
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 8 }}>
                  Your manuscript is filed under your department of record.
                </Text>
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 12 }}>Category</Text>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TouchableOpacity 
                    onPress={() => setCategory("Undergraduate Capstone")}
                    style={{ flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: category === "Undergraduate Capstone" ? colors.actionSurface : colors.surface, borderColor: category === "Undergraduate Capstone" ? colors.action : colors.border }}
                  >
                    <Text style={{ fontWeight: "700", color: category === "Undergraduate Capstone" ? colors.action : colors.textTertiary }}>Undergraduate</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setCategory("Graduate Dissertation")}
                    style={{ flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: category === "Graduate Dissertation" ? colors.actionSurface : colors.surface, borderColor: category === "Graduate Dissertation" ? colors.action : colors.border }}
                  >
                    <Text style={{ fontWeight: "700", color: category === "Graduate Dissertation" ? colors.action : colors.textTertiary }}>Graduate</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 12 }}>Abstract</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.textPrimary, minHeight: 140 }}
                  placeholder="Provide a brief summary of the research..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  textAlignVertical="top"
                  value={abstract}
                  onChangeText={setAbstract}
                />
              </View>

              <View style={{ marginBottom: 28 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 12 }}>PDF Document</Text>
                <TouchableOpacity 
                  onPress={pickDocument}
                  style={{ borderWidth: 2, borderStyle: "dashed", borderRadius: 16, padding: 28, alignItems: "center", justifyContent: "center", backgroundColor: pdfFile ? (isDark ? "hsl(150, 30%, 15%)" : "#ECFDF5") : colors.surface, borderColor: pdfFile ? "#10B981" : colors.border }}
                >
                  {pdfFile ? (
                    <>
                      <CheckCircle2 color="#10B981" size={38} />
                      <Text style={{ color: isDark ? "#6EE7B7" : "#047857", fontWeight: "700", marginTop: 8, textAlign: "center" }}>{pdfFile.name}</Text>
                      <Text style={{ color: isDark ? "#34D399" : "#059669", fontWeight: "600", marginTop: 4, fontSize: 12 }}>Tap to change file</Text>
                    </>
                  ) : (
                    <>
                      <FileText color={colors.textTertiary} size={38} />
                      <Text style={{ color: colors.textPrimary, fontWeight: "600", marginTop: 8 }}>{isEditing ? "Keep current PDF — tap to replace" : "Upload PDF Manuscript"}</Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>Maximum size: 25MB</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

            </Animated.View>
            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={{ padding: 18, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity 
              onPress={handleUpload}
              disabled={isUploading}
              style={{ width: "100%", paddingVertical: 14, borderRadius: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", backgroundColor: isUploading ? colors.surfaceSunken : colors.action }}
            >
              {isUploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <UploadCloud color="#FFFFFF" size={20} style={{ marginRight: 8 }} />
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>{isEditing ? "Save Changes" : "Deposit to Repository"}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}
