import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  CheckCircle2,
  BookOpen,
  AlertTriangle,
} from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { apiFetch, apiFetchMultipart, updateThesis } from "../src/lib/api";
import { safeBack } from "../src/lib/navigation";
import { focusRing, RADIUS, SPACE, TYPE } from "../src/lib/tokens";
import VisibilityPicker from "../src/components/VisibilityPicker";
import type { ContentVisibility } from "../src/types";
import Button, { IconButton } from "../src/components/ui/Button";
import Card from "../src/components/ui/Card";
import Modal from "../src/components/ui/Modal";
import Reveal from "../src/components/ui/Reveal";
import TextField from "../src/components/ui/TextField";
import EmptyState from "../src/components/admin/EmptyState";

type Notice = {
  title: string;
  message: string;
  tone?: "success" | "error";
  after?: () => void;
};

const CATEGORIES = [
  { value: "Undergraduate Capstone", label: "Undergraduate", hint: "Capstone" },
  { value: "Graduate Dissertation", label: "Graduate", hint: "Dissertation" },
];

export default function UploadThesisScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();

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
  const [notice, setNotice] = useState<Notice | null>(null);

  const [visibility, setVisibility] = useState<ContentVisibility>("public");
  const [audience, setAudience] = useState<string[]>([]);
  // Editing must not silently reset the stored visibility, so the picker is only
  // sent when the user actually changes it.
  const [visibilityTouched, setVisibilityTouched] = useState(false);

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
        if (t.visibility) setVisibility(t.visibility as ContentVisibility);
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
      setNotice({
        title: "Could not select the document",
        message: "The file picker ran into a problem. Try selecting the PDF again.",
        tone: "error",
      });
    }
  };

  const handleUpload = async () => {
    if (!title || !abstract || (!isEditing && !pdfFile)) {
      setNotice({
        title: "Missing fields",
        message: isEditing
          ? "Please fill out the manuscript title and abstract."
          : "Please fill out all fields and select a PDF manuscript.",
        tone: "error",
      });
      return;
    }
    if (!profile?.id) return;
    if (visibility === "custom" && audience.length === 0) {
      setNotice({
        title: "Pick an audience",
        message: "Choose at least one friend who can see this.",
        tone: "error",
      });
      return;
    }

    setIsUploading(true);
    try {
      if (!profile?.id) return;
      if (visibility === "custom" && audience.length === 0) {
        setNotice({
          title: "Pick an audience",
          message: "Choose at least one friend who can see this.",
          tone: "error",
        });
        return;
      }

      const visibilityPayload = visibilityTouched
        ? { visibility, ...(visibility === "custom" ? { audience } : {}) }
        : {};

      if (isEditing) {
        if (pdfFile) {
          // Multipart PUT: the new manuscript travels as a file, the rest as
          // form fields. The server uploads to Storage itself and stores only
          // the object key.
          const formData = new FormData();
          formData.append("pdf", {
            uri: pdfFile.uri,
            type: pdfFile.mimeType || "application/pdf",
            name: pdfFile.name,
          } as any);
          for (const [key, value] of Object.entries({
            title,
            abstract,
            category,
            ...visibilityPayload,
          })) {
            if (value !== undefined) formData.append(key, String(value));
          }

          const res = await apiFetchMultipart(`/theses/${thesisId}`, {
            method: "PUT" as any,
            body: formData,
          } as any);
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to update manuscript.");
          }
        } else {
          // No new file: plain JSON partial update.
          await updateThesis(thesisId!, {
            title,
            abstract,
            category,
            ...visibilityPayload,
          });
        }
      } else {
        // New deposit: the PDF is the first field, so the server can validate
        // magic bytes before touching Storage.
        const formData = new FormData();
        formData.append("pdf", {
          uri: pdfFile!.uri,
          type: pdfFile!.mimeType || "application/pdf",
          name: pdfFile!.name,
        } as any);
        for (const [key, value] of Object.entries({
          title,
          abstract,
          category,
          ...visibilityPayload,
        })) {
          if (value !== undefined) formData.append(key, String(value));
        }

        const res = await apiFetchMultipart(`/theses`, { body: formData } as any);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to save manuscript to backend database");
        }
      }

      setNotice({
        title: isEditing ? "Changes saved" : "Manuscript deposited",
        message: isEditing
          ? "Your changes are now live in the repository."
          : "Your manuscript has been added to the LCCB Digital Thesis Repository.",
        tone: "success",
        after: () => safeBack("/(tabs)/search"),
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      setNotice({
        title: "Upload failed",
        message: error.message || "An unknown error occurred.",
        tone: "error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const closeNotice = () => {
    const after = notice?.after;
    setNotice(null);
    after?.();
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.surfacePage,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.brand} />
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: SPACE.x6 }}>
          <Card style={{ width: "100%", maxWidth: 440 }}>
            <EmptyState
              icon={AlertTriangle}
              tone="danger"
              title="Could not open the manuscript"
              body={loadError}
              actionLabel="Go back"
              onAction={() => safeBack("/(tabs)/search")}
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
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
          <IconButton
            icon={ArrowLeft}
            label="Back"
            onPress={() => safeBack("/(tabs)/search")}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>Thesis repository</Text>
            <Text style={{ ...TYPE.h2, color: colors.ink }} numberOfLines={1}>
              {isEditing ? "Edit manuscript" : "Deposit manuscript"}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: SPACE.x4, paddingBottom: SPACE.x10 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: "100%", maxWidth: 680, alignSelf: "center" }}>
            <Reveal>
              <View style={{ alignItems: "center", marginBottom: SPACE.x6, marginTop: SPACE.x2 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: RADIUS.lg,
                    backgroundColor: colors.brandWash,
                    borderWidth: 1,
                    borderColor: colors.line,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: SPACE.x4,
                  }}
                >
                  <BookOpen size={26} color={colors.brand} />
                </View>
                <Text style={{ ...TYPE.h1, color: colors.ink, textAlign: "center" }}>
                  {isEditing ? "Update your manuscript" : "Contribute to the repository"}
                </Text>
                <Text
                  style={{
                    ...TYPE.body,
                    color: colors.inkSoft,
                    textAlign: "center",
                    marginTop: SPACE.x2,
                    maxWidth: 420,
                  }}
                >
                  {isEditing
                    ? "Apply changes to your deposited capstone or dissertation."
                    : "Upload your capstone or dissertation to the LCCB Digital Thesis Repository."}
                </Text>
              </View>
            </Reveal>

            <Card style={{ padding: SPACE.x5 }}>
              <TextField
                label="Manuscript title"
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. AI-Powered Farming Assistance for Smallholders"
                maxLength={300}
              />

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
                  Department / program
                </Text>
                <View
                  style={{
                    minHeight: 50,
                    justifyContent: "center",
                    borderRadius: RADIUS.md,
                    borderWidth: 1,
                    borderColor: colors.line,
                    backgroundColor: colors.surfaceSunken,
                    paddingHorizontal: SPACE.x3,
                  }}
                >
                  <Text style={{ fontSize: 15, color: colors.ink }} numberOfLines={1}>
                    {profile?.department_name || "No department on file"}
                  </Text>
                </View>
                <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: SPACE.x2 }}>
                  Your manuscript is filed under your department of record.
                </Text>
              </View>

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
                  Category
                </Text>
                <View style={{ flexDirection: "row", gap: SPACE.x3 }}>
                  {CATEGORIES.map((option) => (
                    <CategoryOption
                      key={option.value}
                      label={option.label}
                      hint={option.hint}
                      active={category === option.value}
                      onPress={() => setCategory(option.value)}
                    />
                  ))}
                </View>
              </View>

              <TextField
                label="Abstract"
                value={abstract}
                onChangeText={setAbstract}
                placeholder="Provide a brief summary of the research…"
                multiline
                minHeight={150}
                maxLength={12000}
                hint={`${abstract.trim().length.toLocaleString()} characters`}
                inputStyle={{ lineHeight: 22 }}
              />

              <View style={{ marginBottom: SPACE.x5 }}>
                <VisibilityPicker
                  visibility={visibility}
                  audience={audience}
                  onChange={(nextVisibility, nextAudience) => {
                    setVisibility(nextVisibility);
                    setAudience(nextAudience);
                    setVisibilityTouched(true);
                  }}
                />
              </View>

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
                  PDF document
                </Text>
                <PdfDropzone
                  fileName={pdfFile?.name}
                  isEditing={isEditing}
                  onPress={() => void pickDocument()}
                />
              </View>
            </Card>
          </View>
        </ScrollView>

        {/* Sticky action bar */}
        <View
          style={{
            padding: SPACE.x4,
            backgroundColor: colors.panel,
            borderTopWidth: 1,
            borderTopColor: colors.line,
          }}
        >
          <View style={{ width: "100%", maxWidth: 680, alignSelf: "center" }}>
            <Button
              label={isEditing ? "Save changes" : "Deposit to repository"}
              icon={UploadCloud}
              size="lg"
              fullWidth
              loading={isUploading}
              disabled={isUploading}
              onPress={() => void handleUpload()}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={!!notice}
        onClose={closeNotice}
        maxWidth={440}
        accessibilityLabel={notice?.title ?? "Notice"}
      >
        <View style={{ padding: SPACE.x6 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: RADIUS.md,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: SPACE.x4,
              backgroundColor:
                notice?.tone === "error" ? colors.coralWash : colors.jadeWash,
            }}
          >
            {notice?.tone === "error" ? (
              <AlertTriangle size={22} color={colors.coralText} />
            ) : (
              <CheckCircle2 size={22} color={colors.jadeText} />
            )}
          </View>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>{notice?.title}</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
            {notice?.message}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: SPACE.x5 }}>
            <Button label={notice?.tone === "error" ? "Got it" : "Done"} onPress={closeNotice} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function CategoryOption({
  label,
  hint,
  active,
  onPress,
}: {
  label: string;
  hint: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={active}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          minHeight: 60,
          justifyContent: "center",
          alignItems: "center",
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: active ? colors.brand : colors.inputBorder,
          backgroundColor: active
            ? colors.brandWash
            : pressed
            ? colors.surfaceSunken
            : colors.inputBg,
          paddingHorizontal: SPACE.x3,
        },
        focusRing(colors, false),
      ]}
    >
      <Text
        style={{
          ...TYPE.bodyStrong,
          fontWeight: "700",
          color: active ? colors.brand : colors.inkSoft,
        }}
      >
        {label}
      </Text>
      <Text style={{ ...TYPE.caption, color: active ? colors.brand : colors.inkFaint }}>
        {hint}
      </Text>
    </Pressable>
  );
}

function PdfDropzone({
  fileName,
  isEditing,
  onPress,
}: {
  fileName?: string;
  isEditing: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const hasFile = !!fileName;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hasFile ? `Selected PDF: ${fileName}` : "Select a PDF manuscript"}
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderRadius: RADIUS.lg,
          borderWidth: 2,
          borderStyle: "dashed",
          borderColor: hasFile ? colors.jade : colors.lineStrong,
          backgroundColor: hasFile
            ? colors.jadeWash
            : pressed
            ? colors.surfaceSunken
            : colors.inputBg,
          paddingVertical: SPACE.x6,
          paddingHorizontal: SPACE.x4,
          alignItems: "center",
          justifyContent: "center",
          gap: SPACE.x2,
        },
        focusRing(colors, false),
      ]}
    >
      {hasFile ? (
        <>
          <CheckCircle2 size={34} color={colors.jadeText} />
          <Text
            style={{
              ...TYPE.bodyStrong,
              fontWeight: "700",
              color: colors.jadeText,
              textAlign: "center",
            }}
            numberOfLines={2}
          >
            {fileName}
          </Text>
          <Text style={{ ...TYPE.caption, fontWeight: "600", color: colors.jadeText }}>
            Tap to change file
          </Text>
        </>
      ) : (
        <>
          <FileText size={34} color={colors.inkFaint} />
          <Text style={{ ...TYPE.bodyStrong, fontWeight: "600", color: colors.ink }}>
            {isEditing ? "Keep current PDF — tap to replace" : "Upload PDF manuscript"}
          </Text>
          <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>
            PDF only · maximum size 25MB
          </Text>
        </>
      )}
    </Pressable>
  );
}
