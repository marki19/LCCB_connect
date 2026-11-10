import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import {
  X,
  Type,
  Image as ImageIcon,
  FolderOpen,
  GraduationCap,
  Globe,
  RefreshCw,
  ChevronLeft,
  CheckCircle2,
  SendHorizontal,
} from "lucide-react-native";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { uploadToStorage, pickImage, MAX_UPLOAD_BYTES } from "../src/lib/upload";
import { apiFetch, updatePost } from "../src/lib/api";
import { fetchLinkPreview, LinkPreviewData } from "../src/lib/linkPreview";
import { safeBack } from "../src/lib/navigation";
import VisibilityPicker from "../src/components/VisibilityPicker";
import type { ContentVisibility } from "../src/types";
import { focusRing, RADIUS, SPACE, TYPE } from "../src/lib/tokens";
import { badgeTone, type BadgeTone } from "../src/components/admin/StatusBadge";
import Button, { IconButton } from "../src/components/ui/Button";
import Card from "../src/components/ui/Card";
import Reveal from "../src/components/ui/Reveal";
import Modal from "../src/components/ui/Modal";
import TextField from "../src/components/ui/TextField";

type PostType = "text" | "image" | "project" | "capstone" | "website" | null;
type ConcretePostType = Exclude<PostType, null>;

const FORMATS: {
  type: ConcretePostType;
  title: string;
  desc: string;
  Icon: any;
  tone: BadgeTone;
}[] = [
  {
    type: "website",
    title: "Live website / web app",
    desc: "Share a hosted project with an automatic link preview.",
    Icon: Globe,
    tone: "info",
  },
  {
    type: "project",
    title: "Showcase project",
    desc: "Display a coding project with its stack and repository.",
    Icon: FolderOpen,
    tone: "success",
  },
  {
    type: "capstone",
    title: "Publish capstone",
    desc: "Officially share your final-year capstone.",
    Icon: GraduationCap,
    tone: "warning",
  },
  {
    type: "text",
    title: "Start a discussion",
    desc: "Share thoughts, ask questions, or start a debate.",
    Icon: Type,
    tone: "brand",
  },
  {
    type: "image",
    title: "Share an update",
    desc: "Post an image with a caption of your recent work.",
    Icon: ImageIcon,
    tone: "accent",
  },
];

function OptionCard({
  format,
  selected,
  onSelect,
}: {
  format: (typeof FORMATS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const { colors } = useTheme();
  const palette = badgeTone(format.tone, colors);
  const Icon = format.Icon;

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      aria-checked={selected}
      onFocus={() => {}}
      style={({ pressed }) => ({
        padding: SPACE.x4,
        borderRadius: RADIUS.lg,
        marginBottom: SPACE.x3,
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.x3,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.brand : colors.line,
        backgroundColor: selected ? colors.brandWash : pressed ? colors.surfaceSunken : colors.panel,
      })}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: RADIUS.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.bg,
        }}
      >
        <Icon size={22} color={palette.fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...TYPE.bodyStrong, fontWeight: "700", color: colors.ink }}>
          {format.title}
        </Text>
        <Text style={{ ...TYPE.caption, color: colors.inkSoft, marginTop: 2, lineHeight: 18 }}>
          {format.desc}
        </Text>
      </View>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: selected ? colors.brand : colors.borderStrong,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? colors.brand : "transparent",
        }}
      >
        {selected ? <CheckCircle2 color={colors.textOnPrimary} size={14} /> : null}
      </View>
    </Pressable>
  );
}

export default function CreatePostModal() {
  const { profile } = useAuth();
  const { colors } = useTheme();

  // Edit mode: these params are set when navigating from PostCard / PostDetail
  const { postId, editTitle, editContent, editType, editTech, editUrl, editVisibility } =
    useLocalSearchParams<{
      postId?: string;
      editTitle?: string;
      editContent?: string;
      editType?: string;
      editTech?: string;
      editUrl?: string;
      editVisibility?: string;
    }>();

  const isEditing = !!postId;

  const [visibility, setVisibility] = useState<ContentVisibility>(
    (editVisibility as ContentVisibility) || "public"
  );
  const [audience, setAudience] = useState<string[]>([]);
  // Editing must not silently reset the stored visibility, so the picker is only
  // sent when the user actually changes it.
  const [visibilityTouched, setVisibilityTouched] = useState(false);

  const [step, setStep] = useState<1 | 2 | 3>(isEditing ? 2 : 1);
  const [postType, setPostType] = useState<PostType>(
    isEditing ? ((editType as PostType) ?? "text") : null
  );

  const [content, setContent] = useState(isEditing ? editContent ?? "" : "");
  const [title, setTitle] = useState(isEditing ? editTitle ?? "" : "");
  const [technologies, setTechnologies] = useState(isEditing ? editTech ?? "" : "");
  const [githubUrl, setGithubUrl] = useState(isEditing ? editUrl ?? "" : "");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [urlFocused, setUrlFocused] = useState(false);

  const [previewData, setPreviewData] = useState<LinkPreviewData | null>(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  const loadPreview = async (urlToFetch: string) => {
    const trimmed = (urlToFetch || "").trim();
    if (!trimmed || (!trimmed.startsWith("http://") && !trimmed.startsWith("https://"))) {
      setNotice({
        title: "Invalid URL",
        message: "Please enter a full URL starting with http:// or https://.",
      });
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
        setNotice({
          title: "Preview unavailable",
          message:
            "Could not automatically fetch metadata for this link. You can still publish it with your own title and description.",
        });
      }
    } catch {
      // Non-blocking
    } finally {
      setFetchingPreview(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && !postType) {
      setNotice({ title: "Select a format", message: "Please choose a post type to continue." });
      return;
    }
    if (step === 2) {
      if (postType === "text" && !content) {
        setNotice({ title: "Content required", message: "Please enter some content." });
        return;
      }
      if (postType === "website" && !githubUrl) {
        setNotice({ title: "URL required", message: "Please enter a live website URL." });
        return;
      }
      if ((postType === "project" || postType === "capstone") && !title) {
        setNotice({ title: "Title required", message: "Please enter a title." });
        return;
      }
    }
    setStep((s) => (s + 1) as 1 | 2 | 3);
  };

  const handlePublish = async () => {
    if (!profile?.id) return;
    if (visibility === "custom" && audience.length === 0) {
      setNotice({
        title: "Pick an audience",
        message: "Choose at least one friend who can see this.",
      });
      return;
    }
    setIsPublishing(true);

    try {
      let finalImageKey: string | null = null;
      if (imageUri) {
        const path = `posts/${profile.id}-${Date.now()}.jpg`;
        const uploaded = await uploadToStorage(
          imageUri,
          "assets",
          path,
          "image/jpeg",
          MAX_UPLOAD_BYTES.image
        );
        if (uploaded) finalImageKey = uploaded.key;
      }

      let finalPreviewMetadata = previewData;
      if (postType === "website" && !finalPreviewMetadata && githubUrl) {
        try {
          finalPreviewMetadata = await fetchLinkPreview(githubUrl.trim());
        } catch {
          // Non-blocking
        }
      }

      const techArray = technologies ? technologies.split(",").map((t) => t.trim()) : null;
      const visibilityPayload = visibilityTouched
        ? { visibility, ...(visibility === "custom" ? { audience } : {}) }
        : {};

      if (isEditing && postId) {
        // Edit mode — PUT /posts/:id
        await updatePost(postId, {
          content,
          type: postType || "text",
          title: title || (finalPreviewMetadata?.title ?? null),
          technologies: techArray,
          github_url: githubUrl || null,
          preview_metadata: finalPreviewMetadata || null,
          ...(finalImageKey ? { image_url: finalImageKey } : {}),
          ...visibilityPayload,
        });
      } else {
        // Create mode — POST /posts
        const res = await apiFetch(`/posts`, {
          method: "POST",
          body: JSON.stringify({
            content,
            type: postType || "text",
            title: title || (finalPreviewMetadata?.title ?? null),
            technologies: techArray,
            github_url: githubUrl || null,
            image_url: finalImageKey,
            preview_metadata: finalPreviewMetadata || null,
            visibility,
            ...(visibility === "custom" ? { audience } : {}),
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to create post");
        }
      }

      safeBack("/(tabs)");
    } catch (err: any) {
      setNotice({
        title: "Could not publish",
        message: err.message || "Failed to publish post",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePickImage = async () => {
    const result = await pickImage();
    if (result) setImageUri(result.uri);
  };

  const stepTitle =
    step === 1 ? "Select format" : step === 2 ? "Add content" : "Final details";
  const showProjectFields =
    postType === "project" || postType === "capstone" || postType === "website";

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
            minHeight: 60,
            backgroundColor: colors.panel,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          }}
        >
          {step > 1 ? (
            <IconButton
              icon={ChevronLeft}
              label="Back to previous step"
              onPress={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
            />
          ) : (
            <IconButton icon={X} label="Close" onPress={() => safeBack("/(tabs)")} />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>
              Step {step} of 3
            </Text>
            <Text style={{ ...TYPE.title, color: colors.ink }} numberOfLines={1}>
              {isEditing ? "Edit post" : "Create post"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 4 }} accessibilityElementsHidden>
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                style={{
                  width: n === step ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: n <= step ? colors.brandSolid : colors.line,
                }}
              />
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: SPACE.x4 }} showsVerticalScrollIndicator={false}>
          <View style={{ width: "100%", maxWidth: 680, alignSelf: "center" }}>
            <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginBottom: SPACE.x4 }}>
              {stepTitle}
            </Text>

            {step === 1 && (
              <Reveal key="step-1">
                {FORMATS.map((format) => (
                  <OptionCard
                    key={format.type}
                    format={format}
                    selected={postType === format.type}
                    onSelect={() => setPostType(format.type)}
                  />
                ))}
              </Reveal>
            )}

            {step === 2 && (
              <Reveal key="step-2">
                {postType === "website" && (
                  <View style={{ marginBottom: SPACE.x2 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        lineHeight: 18,
                        fontWeight: "600",
                        color: colors.textSecondary,
                        marginBottom: SPACE.x2,
                      }}
                    >
                      Live website URL
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2 }}>
                      <View
                        style={[
                          {
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            minHeight: 50,
                            borderRadius: RADIUS.md,
                            borderWidth: 1,
                            borderColor: urlFocused ? colors.inputBorderFocus : colors.inputBorder,
                            backgroundColor: colors.inputBg,
                            paddingHorizontal: SPACE.x3,
                          },
                          focusRing(colors, urlFocused),
                        ]}
                      >
                        <TextInput
                          style={{
                            flex: 1,
                            fontSize: 15,
                            color: colors.ink,
                            paddingVertical: SPACE.x3,
                            outlineStyle: "none",
                          } as any}
                          placeholder="https://my-app.vercel.app"
                          placeholderTextColor={colors.textTertiary}
                          autoCapitalize="none"
                          keyboardType="url"
                          value={githubUrl}
                          onChangeText={setGithubUrl}
                          onFocus={() => setUrlFocused(true)}
                          onBlur={() => {
                            setUrlFocused(false);
                            void loadPreview(githubUrl);
                          }}
                          accessibilityLabel="Live website URL"
                        />
                      </View>
                      <Pressable
                        onPress={() => void loadPreview(githubUrl)}
                        disabled={fetchingPreview || !githubUrl.trim()}
                        accessibilityRole="button"
                        accessibilityLabel="Fetch link preview"
                        style={({ pressed }) => ({
                          width: 50,
                          height: 50,
                          borderRadius: RADIUS.md,
                          backgroundColor:
                            fetchingPreview || !githubUrl.trim()
                              ? colors.surfaceSunken
                              : colors.brandSolid,
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        {fetchingPreview ? (
                          <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.textOnBrandSolid} />
                        ) : (
                          <RefreshCw
                            size={18}
                            color={
                              !githubUrl.trim() ? colors.inkFaint : colors.textOnBrandSolid
                            }
                          />
                        )}
                      </Pressable>
                    </View>
                    <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: SPACE.x2 }}>
                      Tap refresh to scan Open Graph preview metadata.
                    </Text>
                  </View>
                )}

                {postType === "website" && previewData && (
                  <Card style={{ marginBottom: SPACE.x4 }}>
                    <Text
                      style={{
                        ...TYPE.micro,
                        color: colors.brand,
                        marginBottom: SPACE.x2,
                      }}
                    >
                      Live preview detected
                    </Text>
                    {previewData.image ? (
                      <Image
                        source={{ uri: previewData.image }}
                        style={{
                          width: "100%",
                          height: 140,
                          borderRadius: RADIUS.md,
                          marginBottom: SPACE.x3,
                          backgroundColor: colors.surfaceSunken,
                        }}
                        resizeMode="cover"
                      />
                    ) : null}
                    <Text style={{ ...TYPE.bodyStrong, fontWeight: "700", color: colors.ink }}>
                      {previewData.title || title}
                    </Text>
                    {previewData.description ? (
                      <Text
                        numberOfLines={2}
                        style={{ ...TYPE.caption, color: colors.inkSoft, lineHeight: 18, marginTop: 4 }}
                      >
                        {previewData.description}
                      </Text>
                    ) : null}
                  </Card>
                )}

                {showProjectFields && (
                  <TextField
                    label={postType === "website" ? "Website title" : "Project title"}
                    value={title}
                    onChangeText={setTitle}
                    placeholder={
                      postType === "website" ? "e.g. IT Student Portfolio" : "e.g. LCCB Connect App"
                    }
                    autoCapitalize="words"
                  />
                )}

                <TextField
                  label={postType === "text" ? "Discussion topic" : "Description & details"}
                  value={content}
                  onChangeText={setContent}
                  placeholder="What's on your mind? Be descriptive…"
                  multiline
                  minHeight={140}
                  autoCapitalize="sentences"
                />

                {(postType === "image" || postType === "project" || postType === "capstone") && (
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
                      Cover image
                    </Text>
                    <Pressable
                      onPress={() => void handlePickImage()}
                      accessibilityRole="button"
                      accessibilityLabel={imageUri ? "Change cover image" : "Upload a cover image"}
                      style={({ pressed }) => ({
                        backgroundColor: colors.surfaceSunken,
                        borderWidth: 1,
                        borderStyle: "dashed",
                        borderColor: imageUri ? colors.brand : colors.borderStrong,
                        borderRadius: RADIUS.lg,
                        padding: SPACE.x6,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      {imageUri ? (
                        <>
                          <CheckCircle2 color={colors.brand} size={34} />
                          <Text
                            style={{
                              ...TYPE.caption,
                              color: colors.brand,
                              fontWeight: "700",
                              marginTop: SPACE.x2,
                            }}
                          >
                            Image selected
                          </Text>
                        </>
                      ) : (
                        <>
                          <ImageIcon color={colors.inkFaint} size={34} />
                          <Text
                            style={{
                              ...TYPE.caption,
                              color: colors.inkSoft,
                              fontWeight: "600",
                              marginTop: SPACE.x2,
                            }}
                          >
                            Tap to upload from gallery
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                )}
              </Reveal>
            )}

            {step === 3 && (
              <Reveal key="step-3">
                <VisibilityPicker
                  visibility={visibility}
                  audience={audience}
                  onChange={(nextVisibility, nextAudience) => {
                    setVisibility(nextVisibility);
                    setAudience(nextAudience);
                    setVisibilityTouched(true);
                  }}
                />

                {showProjectFields ? (
                  <>
                    <TextField
                      label="Tech stack (comma separated)"
                      value={technologies}
                      onChangeText={setTechnologies}
                      placeholder="React, Next.js, Node.js, Tailwind"
                      autoCapitalize="words"
                    />
                    <TextField
                      label="Repository link (optional)"
                      value={githubUrl}
                      onChangeText={setGithubUrl}
                      placeholder="https://github.com/username/repo"
                      keyboardType="url"
                      hint="Link the source code so others can explore it."
                    />
                  </>
                ) : (
                  <Card style={{ alignItems: "center", padding: SPACE.x6 }}>
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: colors.jadeWash,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CheckCircle2 color={colors.jade} size={32} />
                    </View>
                    <Text
                      style={{
                        ...TYPE.h2,
                        color: colors.ink,
                        textAlign: "center",
                        marginTop: SPACE.x3,
                      }}
                    >
                      Ready to publish
                    </Text>
                    <Text
                      style={{
                        ...TYPE.caption,
                        color: colors.inkSoft,
                        textAlign: "center",
                        marginTop: SPACE.x2,
                        lineHeight: 20,
                        maxWidth: 340,
                      }}
                    >
                      Your post is formatted and ready to be shared with the LCCB community.
                    </Text>
                  </Card>
                )}
              </Reveal>
            )}

            <View style={{ height: SPACE.x4 }} />
          </View>
        </ScrollView>

        {/* Footer */}
        <View
          style={{
            padding: SPACE.x4,
            backgroundColor: colors.panel,
            borderTopWidth: 1,
            borderTopColor: colors.line,
          }}
        >
          <View style={{ width: "100%", maxWidth: 680, alignSelf: "center" }}>
            {step < 3 ? (
              <Button
                label="Continue"
                iconRight={SendHorizontal}
                onPress={handleNext}
                fullWidth
              />
            ) : (
              <Button
                label={
                  isPublishing
                    ? isEditing
                      ? "Saving…"
                      : "Publishing…"
                    : isEditing
                    ? "Save changes"
                    : "Publish post"
                }
                icon={isPublishing ? undefined : SendHorizontal}
                onPress={() => void handlePublish()}
                loading={isPublishing}
                disabled={isPublishing}
                fullWidth
              />
            )}
          </View>
        </View>
      </SafeAreaView>

      <Modal
        visible={!!notice}
        onClose={() => setNotice(null)}
        maxWidth={440}
        accessibilityLabel={notice?.title ?? "Notice"}
      >
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>{notice?.title}</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
            {notice?.message}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: SPACE.x5 }}>
            <Button label="Got it" onPress={() => setNotice(null)} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
