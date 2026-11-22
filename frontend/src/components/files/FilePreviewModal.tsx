/**
 * FilePreviewModal.tsx — In-app document and media previewer modal.
 *
 * Supports cross-platform in-app preview for:
 *   - PDFs: Native iframe on web, WebView / Google Docs viewer on mobile.
 *   - Word (.docx, .doc) & PowerPoint (.pptx, .ppt): Embedded document viewer with fallback card.
 *   - Images (.png, .jpg, .webp): Full-bleed image preview.
 *   - Other files: Graceful fallback card with direct download/open action.
 */

import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  Linking,
} from "react-native";
import {
  X,
  FileText,
  Download,
  ExternalLink,
  File,
  Image as ImageIcon,
  Presentation,
  AlertCircle,
} from "lucide-react-native";
import { AppImage } from "../AppImage";
import { resolveFileUrl } from "../../lib/files";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";

export interface FilePreviewItem {
  url?: string | null;
  storage_key?: string | null;
  file_name: string;
  mime_type?: string | null;
  size_bytes?: number | null;
}

interface FilePreviewModalProps {
  visible: boolean;
  file: FilePreviewItem | null;
  onClose: () => void;
}

function formatSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Safely resolve native WebView on iOS/Android without crashing web or tests
let NativeWebView: any = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    NativeWebView = require("react-native-webview").WebView;
  } catch {
    NativeWebView = null;
  }
}

export default function FilePreviewModal({
  visible,
  file,
  onClose,
}: FilePreviewModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;

  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (!visible || !file) return null;

  const rawUrl = file.url || (file.storage_key ? resolveFileUrl(file.storage_key) : null);
  const fileName = file.file_name || "Document";
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const mime = (file.mime_type || "").toLowerCase();

  const isPdf = mime === "application/pdf" || ext === "pdf";
  const isImage = mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
  const isWord = mime.includes("word") || ["docx", "doc"].includes(ext);
  const isPowerPoint = mime.includes("presentation") || mime.includes("powerpoint") || ["pptx", "ppt"].includes(ext);
  const isOffice = isWord || isPowerPoint;

  const formattedSize = formatSize(file.size_bytes);

  // Badge color theme by file type
  const badgeStyle = isPdf
    ? { bg: isDark ? "#450A0A" : "#FEE2E2", color: isDark ? "#F87171" : "#DC2626", label: "PDF" }
    : isWord
    ? { bg: isDark ? "#1E3A8A" : "#DBEAFE", color: isDark ? "#60A5FA" : "#2563EB", label: "Word" }
    : isPowerPoint
    ? { bg: isDark ? "#431407" : "#FFEDD5", color: isDark ? "#FB923C" : "#EA580C", label: "PowerPoint" }
    : isImage
    ? { bg: isDark ? "#3B0764" : "#F3E8FF", color: isDark ? "#C084FC" : "#9333EA", label: "Image" }
    : { bg: colors.surfaceSunken, color: colors.textSecondary, label: ext.toUpperCase() || "File" };

  const handleOpenExternal = () => {
    if (rawUrl) {
      Linking.openURL(rawUrl).catch((err) => {
        console.error("Failed to open file externally:", err);
      });
    }
  };

  // Google Docs Viewer embed URL for Office documents
  const officeViewerUrl = rawUrl
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(rawUrl)}&embedded=true`
    : null;

  // Decide viewer body
  const renderViewerBody = () => {
    if (!rawUrl) {
      return (
        <View style={styles.centerContainer}>
          <AlertCircle size={40} color={colors.textTertiary} />
          <Text style={[styles.fallbackTitle, { color: colors.textPrimary }]}>
            Document URL not available
          </Text>
        </View>
      );
    }

    // 1. Image Viewer
    if (isImage) {
      return (
        <View style={styles.imageWrap}>
          <AppImage
            source={{ uri: rawUrl }}
            style={styles.fullImage}
            contentFit="contain"
            onLoad={() => setLoading(false)}
          />
        </View>
      );
    }

    // 2. PDF Viewer
    if (isPdf) {
      if (Platform.OS === "web") {
        return (
          <View style={styles.embedWrap}>
            {loading && (
              <View style={[styles.loadingOverlay, { backgroundColor: colors.surface }]}>
                <ActivityIndicator size="large" color={colors.brand} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Loading PDF preview…
                </Text>
              </View>
            )}
            <iframe
              src={rawUrl}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
              }}
              title={fileName}
              onLoad={() => setLoading(false)}
            />
          </View>
        );
      }

      // Mobile PDF: Use native WebView if available, or Google Docs viewer on Android
      if (NativeWebView) {
        const mobilePdfUrl =
          Platform.OS === "android"
            ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(rawUrl)}`
            : rawUrl;

        return (
          <View style={styles.embedWrap}>
            {loading && (
              <View style={[styles.loadingOverlay, { backgroundColor: colors.surface }]}>
                <ActivityIndicator size="large" color={colors.brand} />
              </View>
            )}
            <NativeWebView
              source={{ uri: mobilePdfUrl }}
              style={{ flex: 1 }}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setHasError(true);
              }}
            />
          </View>
        );
      }
    }

    // 3. Office Docs (Word, PowerPoint)
    // On web or mobile with external URL, attempt Google Docs Viewer
    const isLocalhost =
      rawUrl.includes("localhost") ||
      rawUrl.includes("127.0.0.1") ||
      rawUrl.startsWith("/");

    if (isOffice && !isLocalhost && officeViewerUrl && !hasError) {
      if (Platform.OS === "web") {
        return (
          <View style={styles.embedWrap}>
            {loading && (
              <View style={[styles.loadingOverlay, { backgroundColor: colors.surface }]}>
                <ActivityIndicator size="large" color={colors.brand} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Preparing document preview…
                </Text>
              </View>
            )}
            <iframe
              src={officeViewerUrl}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
              }}
              title={fileName}
              onLoad={() => setLoading(false)}
            />
          </View>
        );
      }

      if (NativeWebView) {
        return (
          <View style={styles.embedWrap}>
            {loading && (
              <View style={[styles.loadingOverlay, { backgroundColor: colors.surface }]}>
                <ActivityIndicator size="large" color={colors.brand} />
              </View>
            )}
            <NativeWebView
              source={{ uri: officeViewerUrl }}
              style={{ flex: 1 }}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setHasError(true);
              }}
            />
          </View>
        );
      }
    }

    // 4. Clean Fallback Card (for Office docs on localhost or unsupported formats)
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.surface }]}>
        <View style={[styles.largeIconWrap, { backgroundColor: badgeStyle.bg }]}>
          {isPowerPoint ? (
            <Presentation size={48} color={badgeStyle.color} />
          ) : (
            <FileText size={48} color={badgeStyle.color} />
          )}
        </View>

        <Text style={[styles.fallbackTitle, { color: colors.textPrimary }]} numberOfLines={2}>
          {fileName}
        </Text>

        <Text style={[styles.fallbackSubtitle, { color: colors.textSecondary }]}>
          {formattedSize ? `${formattedSize} • ` : ""}
          {isWord
            ? "Microsoft Word Document"
            : isPowerPoint
            ? "PowerPoint Presentation"
            : isPdf
            ? "PDF Document"
            : "Document File"}
        </Text>

        <Text style={[styles.fallbackHint, { color: colors.textTertiary }]}>
          Open externally to view full content, formatting, and annotations.
        </Text>

        <TouchableOpacity
          onPress={handleOpenExternal}
          style={[styles.primaryActionBtn, { backgroundColor: colors.brandSolid }]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Open ${fileName}`}
        >
          <ExternalLink size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.primaryActionText}>Open File</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.backdrop}>
        <View
          style={[
            styles.containerWrapper,
            isDesktop ? styles.desktopModal : styles.mobileModal,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Header Bar */}
          <View style={[styles.headerBar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.typeBadge, { backgroundColor: badgeStyle.bg }]}>
                {isImage ? (
                  <ImageIcon size={16} color={badgeStyle.color} />
                ) : isPowerPoint ? (
                  <Presentation size={16} color={badgeStyle.color} />
                ) : (
                  <FileText size={16} color={badgeStyle.color} />
                )}
              </View>
              <View style={styles.headerInfo}>
                <Text
                  style={[styles.fileNameText, { color: colors.textPrimary }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {fileName}
                </Text>
                {formattedSize ? (
                  <Text style={[styles.fileSizeText, { color: colors.textTertiary }]}>
                    {formattedSize}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Header Actions */}
            <View style={styles.headerRight}>
              {rawUrl && (
                <TouchableOpacity
                  onPress={handleOpenExternal}
                  style={[styles.iconButton, { backgroundColor: colors.surfaceSunken }]}
                  accessibilityRole="button"
                  accessibilityLabel="Download or open externally"
                >
                  <Download size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={onClose}
                style={[styles.iconButton, { backgroundColor: colors.surfaceSunken }]}
                accessibilityRole="button"
                accessibilityLabel="Close document preview"
              >
                <X size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Main Content Area */}
          <View style={[styles.bodyContent, { backgroundColor: colors.surfaceSunken }]}>
            {renderViewerBody()}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  containerWrapper: {
    overflow: "hidden",
    borderWidth: 1,
  },
  desktopModal: {
    width: "90%",
    maxWidth: 960,
    height: "86%",
    borderRadius: RADIUS.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  mobileModal: {
    width: "100%",
    height: "100%",
    borderRadius: 0,
    borderWidth: 0,
  },
  headerBar: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.x4,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: SPACE.x3,
  },
  typeBadge: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACE.x3,
  },
  headerInfo: {
    flex: 1,
  },
  fileNameText: {
    fontSize: 14,
    fontWeight: "700",
  },
  fileSizeText: {
    fontSize: 11,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  bodyContent: {
    flex: 1,
    position: "relative",
  },
  embedWrap: {
    flex: 1,
    position: "relative",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    gap: SPACE.x2,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "500",
  },
  imageWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACE.x3,
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.x6,
  },
  largeIconWrap: {
    width: 84,
    height: 84,
    borderRadius: RADIUS.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.x4,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  fallbackSubtitle: {
    fontSize: 13,
    marginBottom: SPACE.x3,
  },
  fallbackHint: {
    fontSize: 12,
    textAlign: "center",
    maxWidth: 320,
    marginBottom: SPACE.x6,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x5,
    paddingVertical: SPACE.x3,
    borderRadius: RADIUS.lg,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
