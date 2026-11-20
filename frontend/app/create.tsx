import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Switch,
  useWindowDimensions,
  Pressable,
  StyleSheet,
} from "react-native";
import { AppImage } from "../src/components/AppImage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  X,
  Plus,
  Image as ImageIcon,
  FolderOpen,
  GraduationCap,
  Globe,
  RefreshCw,
  SendHorizontal,
  ChevronDown,
  Layers,
  Lock,
  Users,
  UserCheck,
  Building2,
  FileText,
} from "lucide-react-native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useToast } from "../src/contexts/ToastContext";
import {
  uploadToStorage,
  pickImage,
  pickMultipleImages,
  pickDocuments,
  normalizeMimeType,
  MAX_UPLOAD_BYTES,
} from "../src/lib/upload";
import { apiFetch, updatePost } from "../src/lib/api";
import { resolveFileUrl } from "../src/lib/files";
import {
  fetchLinkPreview,
  LinkPreviewData,
  extractFirstUrl,
  normalizeWebsiteUrl,
} from "../src/lib/linkPreview";
import { safeBack } from "../src/lib/navigation";
import VisibilityPicker from "../src/components/VisibilityPicker";
import Avatar from "../src/components/Avatar";
import RepositoryFields from "../src/components/composer/RepositoryFields";
import AttachmentList, { ComposerAttachmentItem } from "../src/components/composer/AttachmentList";
import MentionInput from "../src/components/mentions/MentionInput";
import type { MentionToken } from "../src/lib/mentions";
import type { ContentVisibility, PostKind, RepositoryType } from "../src/types";
import { focusRing, RADIUS, SPACE, TYPE } from "../src/lib/tokens";
import { badgeTone, type BadgeTone } from "../src/components/admin/StatusBadge";
import Button, { IconButton } from "../src/components/ui/Button";
import Card from "../src/components/ui/Card";
import Reveal from "../src/components/ui/Reveal";
import Modal from "../src/components/ui/Modal";
import TextField from "../src/components/ui/TextField";

type PostType = "text" | "image" | "project" | "capstone" | "website";

/**
 * Values a quick action may pass as `?type=`. Each one already decides whether
 * the new post is a discussion or a repository entry, so the composer must not
 * offer the other door. Anything else (or no `type` at all) leaves the mode
 * open.
 */
const CREATE_INTENTS = [
  "project",
  "capstone",
  "thesis",
  "image",
  "text",
  "website",
  "discussion",
] as const;

function isCreateIntent(value?: string): boolean {
  return !!value && (CREATE_INTENTS as readonly string[]).includes(value);
}

export default function CreatePostModal() {
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;

  // Edit or pre-selected mode: params from PostCard / PostDetail / FeedComposer
  const {
    postId,
    type,
    kind: paramKind,
    editTitle,
    editContent,
    editType,
    editKind,
    editRepositoryType,
    editRepositoryCategory,
    editLiveUrl,
    editTech,
    editUrl,
    editVisibility,
    editImages,
    editAttachments,
    editMentions,
  } = useLocalSearchParams<{
    postId?: string;
    type?: string;
    kind?: string;
    editTitle?: string;
    editContent?: string;
    editType?: string;
    editKind?: string;
    editRepositoryType?: string;
    editRepositoryCategory?: string;
    editLiveUrl?: string;
    editTech?: string;
    editUrl?: string;
    editVisibility?: string;
    editImages?: string;
    editAttachments?: string;
    editMentions?: string;
  }>();

  const isEditing = !!postId;
  const initialType = ((editType || type) as PostType) || "text";

  const isRepositoryParam =
    editKind === "repository" ||
    paramKind === "repository" ||
    editType === "project" ||
    editType === "capstone" ||
    editType === "thesis" ||
    type === "project" ||
    type === "capstone" ||
    type === "thesis";

  const [postKind, setPostKind] = useState<PostKind>(
    isRepositoryParam ? "repository" : "discussion"
  );

  // A quick action has already picked the door: Project / Capstone / Thesis
  // create a repository post, Discuss / Photo / Discussion create a discussion
  // post. When one is set there is no mode to choose, so the Discussion |
  // Repository switch is not rendered. Reads `type` only — `editType` means
  // "editing an existing post" and must keep the switch so an edit can change
  // the post's kind.
  const modeIsLocked = paramKind === "repository" || isCreateIntent(type);

  const initialRepoType = (
    editRepositoryType ||
    (["project", "capstone", "thesis"].includes(editType || "") ? editType : null) ||
    (["project", "capstone", "thesis"].includes(type || "") ? type : null) ||
    "project"
  ) as RepositoryType;

  const [repositoryType, setRepositoryType] = useState<RepositoryType>(initialRepoType);
  const [repositoryCategory, setRepositoryCategory] = useState<string>(
    editRepositoryCategory || "Capstone"
  );
  const [liveUrl, setLiveUrl] = useState<string>(editLiveUrl || "");

  const [visibility, setVisibility] = useState<ContentVisibility>(
    (editVisibility as ContentVisibility) || "public"
  );
  const [audience, setAudience] = useState<string[]>([]);
  const [visibilityTouched, setVisibilityTouched] = useState(false);
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);

  const [postType, setPostType] = useState<PostType>(initialType);
  const [content, setContent] = useState(isEditing ? editContent ?? "" : "");
  const [title, setTitle] = useState(isEditing ? editTitle ?? "" : "");
  const [technologies, setTechnologies] = useState(isEditing ? editTech ?? "" : "");
  const [githubUrl, setGithubUrl] = useState(isEditing ? editUrl ?? "" : "");
  const [allowReposts, setAllowReposts] = useState(true);
  const [imageUris, setImageUris] = useState<string[]>(() => {
    if (editImages) {
      try {
        const parsed = JSON.parse(editImages);
        if (Array.isArray(parsed)) {
          return parsed.filter((item): item is string => typeof item === "string" && Boolean(item));
        }
      } catch {}
    }
    return [];
  });
  const [docList, setDocList] = useState<ComposerAttachmentItem[]>(() => {
    if (editAttachments) {
      try {
        const parsed = JSON.parse(editAttachments);
        if (Array.isArray(parsed)) {
          return parsed.map((att: any) => ({
            id: att.id,
            uri: att.url || att.storage_key,
            name: att.file_name,
            mime: att.mime_type,
            size: att.size_bytes,
            category: "documents" as const,
            key: att.storage_key,
          }));
        }
      } catch {}
    }
    return [];
  });
  const [mentions, setMentions] = useState<MentionToken[]>(() => {
    if (editMentions) {
      try {
        const parsed = JSON.parse(editMentions);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  });
  const [isPublishing, setIsPublishing] = useState(false);
  const [urlFocused, setUrlFocused] = useState(false);

  const [previewData, setPreviewData] = useState<LinkPreviewData | null>(null);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const [lastDetectedUrl, setLastDetectedUrl] = useState<string | null>(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  // Close modal on Escape key (web desktop)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        safeBack("/(tabs)");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const loadPreview = async (urlToFetch: string) => {
    const clean = (urlToFetch || "").trim();
    if (!clean) return;
    const normalized = normalizeWebsiteUrl(clean);
    if (!normalized || !normalized.includes(".")) return;
    try {
      setFetchingPreview(true);
      const data = await fetchLinkPreview(normalized);
      if (data) {
        setPreviewData(data);
        if (data.title && !title) {
          setTitle(data.title);
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setFetchingPreview(false);
    }
  };

  const handleContentChange = (text: string) => {
    setContent(text);
    if (!githubUrl.trim()) {
      const detected = extractFirstUrl(text);
      if (detected) {
        if (detected !== lastDetectedUrl) {
          setLastDetectedUrl(detected);
          setPreviewDismissed(false);
          loadPreview(detected);
        }
      } else if (lastDetectedUrl) {
        setLastDetectedUrl(null);
        setPreviewData(null);
      }
    }
  };

  const handleGithubUrlChange = (val: string) => {
    setGithubUrl(val);
    const clean = val.trim();
    if (clean.includes(".") && clean.length >= 4) {
      setPreviewDismissed(false);
      loadPreview(clean);
    } else if (!clean && !extractFirstUrl(content)) {
      setPreviewData(null);
    }
  };

  // Auto-detect link on mount if editing or initial content exists
  useEffect(() => {
    if (content && !previewData && !githubUrl) {
      const detected = extractFirstUrl(content);
      if (detected) {
        setLastDetectedUrl(detected);
        loadPreview(detected);
      }
    }
  }, []);

  const handlePickImage = async () => {
    if (imageUris.length >= 4) {
      Alert.alert("Limit Reached", "You can upload a maximum of 4 photos per post.");
      return;
    }
    const results = await pickMultipleImages({ selectionLimit: 4 - imageUris.length });
    if (results && results.length > 0) {
      const nextUris = [...imageUris, ...results.map((r) => r.uri)].slice(0, 4);
      setImageUris(nextUris);
      if (postType === "text" && nextUris.length > 0) setPostType("image");
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePickDocument = async () => {
    if (docList.length >= 10) {
      Alert.alert("Limit Reached", "You can attach a maximum of 10 documents per post.");
      return;
    }
    const results = await pickDocuments();
    if (results && results.length > 0) {
      const remaining = 10 - docList.length;
      const nextDocs: ComposerAttachmentItem[] = [
        ...docList,
        ...results.slice(0, remaining).map((doc) => ({
          uri: doc.uri,
          name: doc.name,
          mime: doc.type,
          size: doc.size,
          category: "documents" as const,
        })),
      ];
      setDocList(nextDocs);
    }
  };

  const handleRemoveDocument = (index: number) => {
    setDocList((prev) => prev.filter((_, i) => i !== index));
  };

  const trimmedContent = content.trim();
  const trimmedTitle = title.trim();
  const detectedUrlInContent = extractFirstUrl(trimmedContent);

  const isPostValid = Boolean(
    postKind === "repository"
      ? trimmedTitle.length > 0 && (repositoryType !== "thesis" || docList.length > 0)
      : (trimmedContent.length > 0 || imageUris.length > 0 || docList.length > 0 || previewData)
  );

  const handlePublish = async () => {
    const isStudent = profile?.role === "student";
    const isProfileIncomplete = !profile?.profile_completed && profile?.verification_status !== "verified";
    if (isStudent && isProfileIncomplete) {
      if (Platform.OS === "web") {
        const proceed = typeof window !== "undefined" && window.confirm
          ? window.confirm(
              "Complete your profile (student ID, department, and course) before creating posts.\n\nGo to profile setup now?"
            )
          : false;
        if (proceed) router.push("/onboarding");
      } else {
        Alert.alert(
          "Complete Your Profile",
          "Complete your profile (full name, student ID, department, and course) before creating posts.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Complete Profile", onPress: () => router.push("/onboarding") },
          ]
        );
      }
      return;
    }

    if (!isPostValid) {
      Alert.alert("Empty Post", "Please add some content, an image, or project details to post.");
      return;
    }

    if (postKind === "repository" && repositoryType === "thesis" && docList.length === 0) {
      Alert.alert("Document Required", "A thesis submission requires at least one document (PDF, Word, or presentation).");
      return;
    }
    if (postKind === "repository" && !trimmedTitle) {
      Alert.alert("Title Required", "Please provide a title for your repository.");
      return;
    }

    try {
      setIsPublishing(true);

      let finalImageKeys: string[] = [];
      if (imageUris.length > 0) {
        const uploadResults = await Promise.all(
          imageUris.map((uri) => uploadToStorage(uri, "posts"))
        );
        finalImageKeys = uploadResults.map((r) => r?.key).filter(Boolean) as string[];
        if (finalImageKeys.length < imageUris.length) {
          Alert.alert(
            "Upload Incomplete",
            "One or more images could not be uploaded. Please verify the image file format and try again."
          );
          setIsPublishing(false);
          return;
        }
      }
      const finalImageKey = finalImageKeys.length > 0 ? finalImageKeys[0] : null;

      const uploadedDocs: Array<{
        key: string;
        name: string;
        mime: string;
        size?: number | null;
      }> = [];
      for (const doc of docList) {
        if (doc.key) {
          uploadedDocs.push({
            key: doc.key,
            name: doc.name,
            mime: doc.mime,
            size: doc.size,
          });
        } else {
          const res = await uploadToStorage(
            doc.uri,
            "documents",
            doc.name,
            doc.mime,
            MAX_UPLOAD_BYTES.document,
            doc.size
          );
          if (!res?.key) {
            Alert.alert("Upload Incomplete", `Could not upload document "${doc.name}".`);
            setIsPublishing(false);
            return;
          }
          uploadedDocs.push({
            key: res.key,
            name: doc.name,
            mime: doc.mime,
            size: doc.size,
          });
        }
      }

      const attachmentsPayload = [
        ...finalImageKeys.map((key, i) => ({
          storage_key: key,
          file_name: `image-${i + 1}.${key.split('.').pop() || 'jpg'}`,
          mime_type: key.endsWith('.png') ? 'image/png' : key.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
          sort_order: i,
        })),
        ...uploadedDocs.map((doc, i) => ({
          storage_key: doc.key,
          file_name: doc.name,
          mime_type: normalizeMimeType(doc.name, doc.mime),
          size_bytes: doc.size ?? null,
          sort_order: finalImageKeys.length + i,
        })),
      ];

      const detectedInContent = extractFirstUrl(trimmedContent);
      const rawUrl = githubUrl.trim() || (!previewDismissed ? detectedInContent : null);
      const normalizedUrl = rawUrl ? normalizeWebsiteUrl(rawUrl) : null;
      let finalPreviewMetadata = previewDismissed ? null : previewData;
      if (normalizedUrl && !finalPreviewMetadata && !previewDismissed) {
        try {
          finalPreviewMetadata = await fetchLinkPreview(normalizedUrl);
        } catch {
          // Non-blocking
        }
      }
      const effectivePostType =
        postKind === "repository"
          ? (repositoryType === "thesis" ? "thesis" : repositoryType === "capstone" ? "capstone" : "project")
          : (postType === "text" && (finalPreviewMetadata || normalizedUrl) ? "website" : postType);

      const techArray = technologies ? technologies.split(",").map((t) => t.trim()).filter(Boolean) : null;
      const visibilityPayload = visibilityTouched
        ? { visibility, ...(visibility === "custom" ? { audience } : {}) }
        : {};

      const mentionIds = mentions.map((m) => m.user_id || m.id).filter(Boolean) as string[];

      if (isEditing && postId) {
        // Edit mode — PUT /posts/:id
        await updatePost(postId, {
          kind: postKind,
          repository_type: postKind === "repository" ? repositoryType : null,
          repository_category:
            postKind === "repository" && (repositoryType === "capstone" || repositoryType === "thesis")
              ? repositoryCategory
              : null,
          live_url: postKind === "repository" && repositoryType === "project" ? (liveUrl.trim() || null) : null,
          attachments: attachmentsPayload,
          mention_ids: mentionIds,
          content: trimmedContent || undefined,
          type: effectivePostType,
          title: trimmedTitle || finalPreviewMetadata?.title || null,
          technologies: techArray,
          github_url: postKind === "repository" && githubUrl.trim() ? githubUrl.trim() : normalizedUrl,
          preview_metadata: finalPreviewMetadata || null,
          allow_reposts: allowReposts,
          image_url: finalImageKey,
          image_urls: finalImageKeys,
          ...visibilityPayload,
        });
      } else {
        // Create mode — POST /posts
        const res = await apiFetch(`/posts`, {
          method: "POST",
          body: JSON.stringify({
            kind: postKind,
            repository_type: postKind === "repository" ? repositoryType : null,
            repository_category:
              postKind === "repository" && (repositoryType === "capstone" || repositoryType === "thesis")
                ? repositoryCategory
                : null,
            live_url: postKind === "repository" && repositoryType === "project" ? (liveUrl.trim() || null) : null,
            attachments: attachmentsPayload,
            mention_ids: mentionIds,
            content: trimmedContent || null,
            type: effectivePostType,
            title: trimmedTitle || finalPreviewMetadata?.title || null,
            technologies: techArray,
            github_url: postKind === "repository" && githubUrl.trim() ? githubUrl.trim() : normalizedUrl,
            image_url: finalImageKey,
            image_urls: finalImageKeys,
            preview_metadata: finalPreviewMetadata || null,
            visibility,
            allow_reposts: allowReposts,
            ...(visibility === "custom" ? { audience } : {}),
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.message || errData.error || "Failed to create post";
          if (errData.code === "PROFILE_INCOMPLETE" || errData.code === "VERIFICATION_REQUIRED" || errData.code === "not_verified") {
            if (Platform.OS === "web") {
              const proceed = typeof window !== "undefined" && window.confirm
                ? window.confirm(
                    errMsg + "\n\nGo to profile setup now?"
                  )
                : false;
              if (proceed) router.push("/onboarding");
            } else {
              Alert.alert(
                "Complete Your Profile",
                errMsg,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Complete Profile",
                    onPress: () => router.push("/onboarding"),
                  },
                ]
              );
            }
            return;
          }
          throw new Error(errMsg);
        }
      }

      showToast({
        message: isEditing ? "Post updated successfully." : "Post published successfully.",
        tone: "success",
      });
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

  const firstName = (profile?.full_name || profile?.username || "there").split(" ")[0];

  // ── COMPOSER BODY (Shared between desktop and mobile modal) ────────────────
  const renderComposerContent = () => (
    <View style={{ flex: 1, position: "relative" }}>
      {/* Invisible backdrop when visibility picker is open to close on tap outside */}
      {showVisibilityPicker && (
        <Pressable
          onPress={() => setShowVisibilityPicker(false)}
          style={[StyleSheet.absoluteFill, { zIndex: 90 }]}
        />
      )}

      {/* Two-door switch: Discussion | Repository. Hidden when the composer was
          opened by a quick action that already chose the door. */}
      {!modeIsLocked && (
        <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6, gap: 10 }}>
          <TouchableOpacity
            onPress={() => setPostKind("discussion")}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              backgroundColor: postKind === "discussion" ? colors.actionSurface : colors.surfaceSunken,
              borderColor: postKind === "discussion" ? colors.action : colors.border,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: postKind === "discussion" ? colors.action : colors.textSecondary }}>
              Discussion
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPostKind("repository")}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              backgroundColor: postKind === "repository" ? colors.actionSurface : colors.surfaceSunken,
              borderColor: postKind === "repository" ? colors.action : colors.border,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: postKind === "repository" ? colors.action : colors.textSecondary }}>
              Repository
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* User Row (Facebook style) */}
      <View style={[styles.modalUserRow, { position: "relative", zIndex: 100 }]}>
        <Avatar
          name={profile?.full_name ?? profile?.username}
          avatarUrl={profile?.avatar_url}
          size={44}
        />
        <View style={{ marginLeft: 12, flex: 1, position: "relative" }}>
          <Text
            style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}
            numberOfLines={1}
          >
            {profile?.full_name || profile?.username || "You"}
          </Text>

          {/* Privacy Pill Dropdown Button */}
          <TouchableOpacity
            onPress={() => setShowVisibilityPicker((v) => !v)}
            style={[
              styles.modalAudiencePill,
              {
                backgroundColor: colors.surfaceSunken,
                borderColor: showVisibilityPicker ? colors.action : colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Change audience"
          >
            {visibility === "public" ? (
              <Globe size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
            ) : visibility === "department" ? (
              <Building2 size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
            ) : visibility === "friends" ? (
              <Users size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
            ) : visibility === "custom" ? (
              <UserCheck size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
            ) : (
              <Lock size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
            )}
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginRight: 4 }}>
              {visibility === "public"
                ? "Public"
                : visibility === "department"
                ? "My Department"
                : visibility === "friends"
                ? "Friends"
                : visibility === "custom"
                ? "Custom"
                : "Private"}
            </Text>
            <ChevronDown size={13} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Small Floating Dropdown Popover */}
          {showVisibilityPicker && (
            <Animated.View
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(100)}
              style={{
                position: "absolute",
                top: 48,
                left: 0,
                width: 200,
                zIndex: 1000,
                backgroundColor: isDark ? colors.surfaceSunken : "#FFFFFF",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 4,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 10,
                elevation: 10,
              }}
            >
              <VisibilityPicker
                visibility={visibility}
                audience={audience}
                compact
                onChange={(v, a) => {
                  setVisibility(v);
                  setAudience(a);
                  setVisibilityTouched(true);
                }}
                onClose={() => setShowVisibilityPicker(false)}
              />
            </Animated.View>
          )}
        </View>

        {postKind === "repository" && (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: "rgba(99, 102, 241, 0.15)",
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "#6366F1",
              }}
            >
              {repositoryType}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.modalScrollView}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Repository Fields */}
        {postKind === "repository" && (
          <RepositoryFields
            repositoryType={repositoryType}
            values={{
              title,
              technologies,
              githubUrl,
              liveUrl,
              category: repositoryCategory,
            }}
            onChange={(fields) => {
              if (fields.title !== undefined) setTitle(fields.title);
              if (fields.technologies !== undefined) setTechnologies(fields.technologies);
              if (fields.githubUrl !== undefined) setGithubUrl(fields.githubUrl);
              if (fields.liveUrl !== undefined) setLiveUrl(fields.liveUrl);
              if (fields.category !== undefined) setRepositoryCategory(fields.category);
            }}
            onTypeChange={(t) => setRepositoryType(t)}
          />
        )}
        {/* Main Textarea */}
        <MentionInput
          placeholder={postKind === "discussion" ? `What's on your mind, ${firstName}?` : "Write a caption…"}
          placeholderTextColor={colors.textTertiary}
          multiline
          autoFocus={!isEditing}
          value={content}
          onChangeText={handleContentChange}
          onMentionsChange={setMentions}
          knownMentions={mentions}
          style={{
            minHeight: 120,
            fontSize: content.length > 80 ? 16 : 18,
            color: colors.textPrimary,
            textAlignVertical: "top",
            lineHeight: 24,
            paddingVertical: 8,
            ...(Platform.OS === "web" ? ({ outlineStyle: "none", borderWidth: 0 } as any) : {}),
          }}
        />

        {/* Document Attachments */}
        <AttachmentList attachments={docList} onRemove={handleRemoveDocument} />

        {/* Rich Link Preview Card (Facebook-style inline preview) */}
        {previewData && !previewDismissed && (
          <View
            style={{
              marginVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
              backgroundColor: colors.surfaceSunken,
              position: "relative",
            }}
          >
            {/* Dismiss preview button */}
            <TouchableOpacity
              onPress={() => {
                setPreviewDismissed(true);
                setPreviewData(null);
              }}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 10,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: "rgba(0, 0, 0, 0.65)",
                alignItems: "center",
                justifyContent: "center",
              }}
              accessibilityRole="button"
              accessibilityLabel="Remove link preview"
            >
              <X size={16} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>

            {previewData.image ? (
              <AppImage
                source={{ uri: previewData.image }}
                style={{ width: "100%", height: 160 }}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  height: 70,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  paddingHorizontal: 12,
                }}
              >
                <Globe size={22} color="#0284C7" />
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }} numberOfLines={1}>
                  {previewData.siteName || previewData.url}
                </Text>
              </View>
            )}
            <View style={{ padding: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <Globe size={13} color={colors.action} />
                <Text numberOfLines={1} style={{ fontSize: 11.5, color: colors.action, fontWeight: "700", marginLeft: 6, flex: 1 }}>
                  {previewData.siteName || previewData.url}
                </Text>
              </View>
              {previewData.title ? (
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 }}>
                  {previewData.title}
                </Text>
              ) : null}
              {previewData.description ? (
                <Text numberOfLines={2} style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                  {previewData.description}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Attached Images Preview Grid */}
        {imageUris.length > 0 && (
          <View style={{ marginVertical: 12 }}>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {imageUris.map((uri, idx) => {
                const isSingle = imageUris.length === 1;
                const widthStyle = isSingle ? "100%" : "48.5%";
                const heightVal = isSingle ? 220 : 130;
                return (
                  <View
                    key={uri + idx}
                    style={{
                      width: widthStyle,
                      height: heightVal,
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: colors.border,
                      position: "relative",
                      backgroundColor: colors.surfaceSunken,
                    }}
                  >
                    <Image
                      source={{ uri: resolveFileUrl(uri) || uri }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={() => handleRemoveImage(idx)}
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: "rgba(0, 0, 0, 0.7)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${idx + 1}`}
                    >
                      <X size={16} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            {imageUris.length < 4 && (
              <TouchableOpacity
                onPress={handlePickImage}
                style={{
                  marginTop: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: colors.border,
                  backgroundColor: colors.actionSurface,
                  gap: 6,
                }}
                accessibilityRole="button"
                accessibilityLabel="Add more photos"
              >
                <Plus size={16} color={colors.action} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.action }}>
                  Add more photos ({imageUris.length}/4)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Repost Permission Row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 10,
            marginTop: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>
              Allow others to repost
            </Text>
            <Text style={{ fontSize: 11, color: colors.textTertiary }}>
              Friends can quote or share this on their own profile
            </Text>
          </View>
          <Switch
            value={allowReposts}
            onValueChange={setAllowReposts}
            trackColor={{ false: colors.border, true: colors.action }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* "Add to your post" Toolbar (Facebook style) */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 16,
            paddingVertical: 10,
            marginTop: 10,
            backgroundColor: isDark ? colors.surfaceSunken : "#F0F2F5",
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>
            Add to your post
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {/* Photo / Image */}
            <TouchableOpacity
              onPress={handlePickImage}
              style={{ padding: 6, borderRadius: 20 }}
              accessibilityRole="button"
              accessibilityLabel="Add Photo"
            >
              <ImageIcon size={22} color="#10B981" />
            </TouchableOpacity>

            {/* Document */}
            <TouchableOpacity
              onPress={handlePickDocument}
              style={{ padding: 6, borderRadius: 20 }}
              accessibilityRole="button"
              accessibilityLabel="Add Document"
            >
              <FileText size={22} color="#0284C7" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Footer Post Button */}
      <View
        style={[
          styles.modalFooter,
          { borderTopColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <TouchableOpacity
          onPress={handlePublish}
          disabled={!isPostValid || isPublishing}
          style={[
            styles.modalActionBtn,
            {
              backgroundColor: !isPostValid || isPublishing ? colors.surfaceSunken : colors.action,
              opacity: !isPostValid ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={isEditing ? "Save changes" : "Post"}
        >
          {isPublishing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text
                style={[
                  styles.modalActionBtnText,
                  { color: !isPostValid ? colors.textTertiary : "#FFFFFF" },
                ]}
              >
                {isEditing ? "Save Changes" : "Post"}
              </Text>
              {isPostValid && <SendHorizontal color="#FFFFFF" size={17} />}
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── DESKTOP WEB: Centered Floating Modal Dialog (Facebook style) ────────────
  if (isDesktop) {
    return (
      <View
        style={[
          styles.desktopBackdrop,
          Platform.OS === "web" ? ({ position: "fixed", zIndex: 1200 } as any) : {},
        ]}
      >
        {/* Click outside backdrop to dismiss */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => safeBack("/(tabs)")}
          accessibilityLabel="Dismiss modal"
        />

        {/* Centered Modal Card */}
        <View
          style={[
            styles.desktopModalCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <View style={{ width: 36 }} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {isEditing ? "Edit post" : "Create post"}
            </Text>

            <TouchableOpacity
              onPress={() => safeBack("/(tabs)")}
              style={[styles.modalCircleBtn, { backgroundColor: colors.surfaceSunken }]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X color={colors.textPrimary} size={18} />
            </TouchableOpacity>
          </View>

          {renderComposerContent()}
        </View>
      </View>
    );
  }

  // ── MOBILE: Responsive Full-Screen Sheet ───────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={[
            styles.modalHeader,
            { borderBottomColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <TouchableOpacity onPress={() => safeBack("/(tabs)")} style={{ padding: 4 }}>
            <X color={colors.textPrimary} size={24} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            {isEditing ? "Edit post" : "Create post"}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        {renderComposerContent()}
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

const styles = StyleSheet.create({
  desktopBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 1200,
  },
  desktopModalCard: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "90vh" as any,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 24,
    zIndex: 1201,
  },
  modalHeader: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  modalCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalUserRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  modalAudiencePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
  },
  modalScrollView: {
    flex: 1,
    maxHeight: 460,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
  },
  modalActionBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  modalActionBtnText: {
    fontWeight: "700",
    fontSize: 15,
  },
});
