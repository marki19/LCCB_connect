import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Upload, FileText, CheckCircle2 } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
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
      // 1. Upload PDF to Storage using our reliable helper
      const ext = pdfFile.name.split('.').pop() || "pdf";
      const filePath = `${profile.id}/${Date.now()}.${ext}`;

      const pdfUrl = await uploadToStorage(pdfFile.uri, 'theses', filePath, pdfFile.mimeType || 'application/pdf');

      if (!pdfUrl) throw new Error("Failed to upload the file to Supabase Storage.");

      // 2. Save metadata to Database
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <ArrowLeft color="#1E293B" size={24} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#1E293B" }}>Deposit Manuscript</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#475569", marginBottom: 6 }}>Manuscript Title</Text>
        <TextInput
          style={{ backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 14, fontSize: 16, color: "#1E293B", marginBottom: 20 }}
          placeholder="e.g. AI-Powered Farming Assistance..."
          value={title}
          onChangeText={setTitle}
        />

        <Text style={{ fontSize: 14, fontWeight: "600", color: "#475569", marginBottom: 6 }}>Department / Program</Text>
        <TextInput
          style={{ backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 14, fontSize: 16, color: "#1E293B", marginBottom: 20 }}
          placeholder="e.g. BS Information Technology"
          value={department}
          onChangeText={setDepartment}
        />

        <Text style={{ fontSize: 14, fontWeight: "600", color: "#475569", marginBottom: 6 }}>Category</Text>
        <View style={{ flexDirection: "row", marginBottom: 20 }}>
          <TouchableOpacity 
            onPress={() => setCategory("Undergraduate Capstone")}
            style={{ flex: 1, padding: 12, backgroundColor: category === "Undergraduate Capstone" ? "#1A56DB" : "#F8FAFC", borderWidth: 1, borderColor: category === "Undergraduate Capstone" ? "#1A56DB" : "#E2E8F0", borderRadius: 12, marginRight: 8, alignItems: "center" }}
          >
            <Text style={{ color: category === "Undergraduate Capstone" ? "#FFFFFF" : "#64748B", fontWeight: "600" }}>Undergraduate</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setCategory("Graduate Dissertation")}
            style={{ flex: 1, padding: 12, backgroundColor: category === "Graduate Dissertation" ? "#1A56DB" : "#F8FAFC", borderWidth: 1, borderColor: category === "Graduate Dissertation" ? "#1A56DB" : "#E2E8F0", borderRadius: 12, marginLeft: 8, alignItems: "center" }}
          >
            <Text style={{ color: category === "Graduate Dissertation" ? "#FFFFFF" : "#64748B", fontWeight: "600" }}>Graduate</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 14, fontWeight: "600", color: "#475569", marginBottom: 6 }}>Abstract</Text>
        <TextInput
          style={{ backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 14, fontSize: 16, color: "#1E293B", minHeight: 120, textAlignVertical: "top", marginBottom: 20 }}
          placeholder="Provide a brief summary of the research..."
          multiline
          value={abstract}
          onChangeText={setAbstract}
        />

        <Text style={{ fontSize: 14, fontWeight: "600", color: "#475569", marginBottom: 6 }}>PDF Document</Text>
        <TouchableOpacity 
          onPress={pickDocument}
          style={{ backgroundColor: pdfFile ? "#F0FDFA" : "#F8FAFC", borderWidth: 1, borderColor: pdfFile ? "#14B8A6" : "#E2E8F0", borderStyle: pdfFile ? "solid" : "dashed", borderRadius: 12, padding: 24, alignItems: "center", marginBottom: 30 }}
        >
          {pdfFile ? (
            <>
              <CheckCircle2 color="#14B8A6" size={32} style={{ marginBottom: 8 }} />
              <Text style={{ color: "#0F766E", fontWeight: "600", textAlign: "center" }}>{pdfFile.name}</Text>
              <Text style={{ color: "#14B8A6", fontSize: 12, marginTop: 4 }}>Tap to change file</Text>
            </>
          ) : (
            <>
              <FileText color="#94A3B8" size={32} style={{ marginBottom: 8 }} />
              <Text style={{ color: "#64748B", fontWeight: "500" }}>Upload PDF Manuscript</Text>
              <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 4 }}>Maximum size: 25MB</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handleUpload}
          disabled={isUploading}
          style={{ backgroundColor: isUploading ? "#93C5FD" : "#1A56DB", padding: 16, borderRadius: 16, alignItems: "center", shadowColor: "#1A56DB", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}
        >
          {isUploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>Deposit to Repository</Text>
          )}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
