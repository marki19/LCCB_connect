import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, UploadCloud, FileText, CheckCircle2, ChevronRight, BookOpen } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/contexts/AuthContext";
import { uploadToStorage } from "../src/lib/upload";

export default function UploadThesisScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [department, setDepartment] = useState("");
  const [category, setCategory] = useState<"Undergraduate Capstone" | "Graduate Dissertation">("Undergraduate Capstone");
  const [pdfFile, setPdfFile] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);

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
    if (!title || !abstract || !department || !pdfFile) {
      Alert.alert("Missing Fields", "Please fill out all fields and select a PDF manuscript.");
      return;
    }
    if (!profile?.id) return;

    setIsUploading(true);
    try {
      const ext = pdfFile.name.split('.').pop() || "pdf";
      const filePath = `${profile.id}/${Date.now()}.${ext}`;

      const pdfUrl = await uploadToStorage(pdfFile.uri, 'theses', filePath, pdfFile.mimeType || 'application/pdf');

      if (!pdfUrl) throw new Error("Failed to upload the file to Supabase Storage.");

      const { error: dbError } = await supabase.from('theses').insert({
        uploader_id: profile.id,
        title,
        abstract,
        department,
        category,
        pdf_url: pdfUrl
      });

      if (dbError) throw dbError;

      Alert.alert("Success", "Manuscript successfully uploaded to the repository!");
      router.back();
    } catch (error: any) {
      console.error("Upload error:", error);
      Alert.alert("Upload Failed", error.message || "An unknown error occurred.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <LinearGradient colors={["#F8FAFC", "#EEF2FF"]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View className="flex-row items-center justify-between px-6 py-4 bg-white/80 border-b border-slate-200/50">
            <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
              <ArrowLeft color="#1E293B" size={28} />
            </TouchableOpacity>
            <Text className="text-slate-900 font-extrabold text-xl tracking-tight">Deposit Manuscript</Text>
            <View className="w-10" />
          </View>

          <ScrollView contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
            
            <Animated.View entering={FadeInDown.duration(400).springify()} className="mb-8 items-center">
              <View className="w-16 h-16 bg-indigo-100 rounded-full items-center justify-center mb-4">
                <BookOpen color="#4F46E5" size={32} />
              </View>
              <Text className="text-slate-900 font-extrabold text-2xl text-center">Contribute to the Repository</Text>
              <Text className="text-slate-500 text-center mt-2 px-4 leading-5">Upload your capstone or dissertation to the LCCB Digital Thesis Repository.</Text>
            </Animated.View>

            <Animated.View entering={FadeInRight.delay(100).duration(400).springify()}>
              <View className="mb-6">
                <Text className="text-slate-700 font-bold mb-2 uppercase tracking-wide text-xs">Manuscript Title</Text>
                <TextInput
                  className="bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base font-semibold text-slate-900 shadow-sm shadow-slate-100"
                  placeholder="e.g. AI-Powered Farming Assistance..."
                  placeholderTextColor="#94A3B8"
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              <View className="mb-6">
                <Text className="text-slate-700 font-bold mb-2 uppercase tracking-wide text-xs">Department / Program</Text>
                <TextInput
                  className="bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base text-slate-900 shadow-sm shadow-slate-100"
                  placeholder="e.g. BS Information Technology"
                  placeholderTextColor="#94A3B8"
                  value={department}
                  onChangeText={setDepartment}
                />
              </View>

              <View className="mb-6">
                <Text className="text-slate-700 font-bold mb-2 uppercase tracking-wide text-xs">Category</Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity 
                    onPress={() => setCategory("Undergraduate Capstone")}
                    className={`flex-1 p-4 rounded-2xl border items-center justify-center ${category === "Undergraduate Capstone" ? "bg-indigo-50 border-indigo-500 shadow-sm shadow-indigo-100" : "bg-white border-slate-200"}`}
                  >
                    <Text className={`font-bold ${category === "Undergraduate Capstone" ? "text-indigo-700" : "text-slate-500"}`}>Undergraduate</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setCategory("Graduate Dissertation")}
                    className={`flex-1 p-4 rounded-2xl border items-center justify-center ${category === "Graduate Dissertation" ? "bg-indigo-50 border-indigo-500 shadow-sm shadow-indigo-100" : "bg-white border-slate-200"}`}
                  >
                    <Text className={`font-bold ${category === "Graduate Dissertation" ? "text-indigo-700" : "text-slate-500"}`}>Graduate</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="mb-6">
                <Text className="text-slate-700 font-bold mb-2 uppercase tracking-wide text-xs">Abstract</Text>
                <TextInput
                  className="bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base text-slate-800 min-h-[140px] shadow-sm shadow-slate-100"
                  placeholder="Provide a brief summary of the research..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  textAlignVertical="top"
                  value={abstract}
                  onChangeText={setAbstract}
                />
              </View>

              <View className="mb-8">
                <Text className="text-slate-700 font-bold mb-2 uppercase tracking-wide text-xs">PDF Document</Text>
                <TouchableOpacity 
                  onPress={pickDocument}
                  className={`border-2 border-dashed rounded-2xl p-8 items-center justify-center ${pdfFile ? "bg-emerald-50/50 border-emerald-200" : "bg-white border-slate-300"}`}
                >
                  {pdfFile ? (
                    <>
                      <CheckCircle2 color="#10B981" size={40} className="mb-2" />
                      <Text className="text-emerald-700 font-bold mt-2 text-center">{pdfFile.name}</Text>
                      <Text className="text-emerald-500 font-semibold mt-1 text-xs">Tap to change file</Text>
                    </>
                  ) : (
                    <>
                      <FileText color="#94A3B8" size={40} className="mb-2" />
                      <Text className="text-slate-700 font-semibold mt-2">Upload PDF Manuscript</Text>
                      <Text className="text-slate-500 text-xs mt-1">Maximum size: 25MB</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

            </Animated.View>
            <View className="h-10" />
          </ScrollView>

          <View className="p-6 bg-white/90 border-t border-slate-100">
            <TouchableOpacity 
              onPress={handleUpload}
              disabled={isUploading}
              className={`w-full py-4 rounded-2xl flex-row justify-center items-center shadow-lg ${isUploading ? 'bg-indigo-400 shadow-indigo-400/20' : 'bg-indigo-600 shadow-indigo-600/40'}`}
            >
              {isUploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <UploadCloud color="#FFFFFF" size={20} className="mr-2" />
                  <Text className="text-white font-bold text-lg">Deposit to Repository</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}
