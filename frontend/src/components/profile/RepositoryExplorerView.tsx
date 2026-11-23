import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Linking,
  Alert,
  StyleSheet,
} from "react-native";
import {
  ArrowLeft,
  Folder,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  ChevronRight,
  Globe,
  Code2,
  Link as LinkIcon,
  HardDrive,
  Eye,
} from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";
import {
  classifyRepositoryAssets,
  getVirtualFolders,
  formatBytes,
  getFileExtension,
  VirtualFolderKey,
  RepositoryLinkItem,
} from "../../lib/repositoryExplorer";
import RepositoryReadmeCard from "./RepositoryReadmeCard";
import FilePreviewModal, { FilePreviewItem } from "../files/FilePreviewModal";
import type { Post, PostAttachment } from "../../types";

interface RepositoryExplorerViewProps {
  post: Post | any;
  onBack: () => void;
}

export default function RepositoryExplorerView({
  post,
  onBack,
}: RepositoryExplorerViewProps) {
  const { colors } = useTheme();

  const [activeFolder, setActiveFolder] = useState<VirtualFolderKey | null>(null);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<FilePreviewItem | null>(null);

  const assets = classifyRepositoryAssets(post);
  const virtualFolders = getVirtualFolders(assets);

  const repoType = (
    post.repository_type ||
    (post.type === "thesis" ? "thesis" : "project")
  ).toUpperCase();

  const handleOpenFile = (att: PostAttachment) => {
    const fileUrl = att.url || (att as any).direct_url || (att as any).pdf_url;
    setSelectedPreviewFile({
      url: fileUrl || null,
      storage_key: att.storage_key || null,
      file_name: att.file_name || "Document",
      mime_type: att.mime_type || null,
      size_bytes: att.size_bytes || null,
    });
  };

  const handleOpenLink = async (link: RepositoryLinkItem) => {
    try {
      await Linking.openURL(link.url);
    } catch {
      Alert.alert("Error", `Cannot open link: ${link.url}`);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Breadcrumbs Bar */}
      <View style={[styles.breadcrumbBar, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Pressable
          onPress={activeFolder ? () => setActiveFolder(null) : onBack}
          style={({ pressed, hovered }: any) => [
            styles.backNavBtn,
            {
              backgroundColor: pressed || hovered ? colors.hoverOverlay : "transparent",
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Back navigation"
        >
          <ArrowLeft size={16} color={colors.ink} style={{ marginRight: 6 }} />
          <Text style={[styles.backNavText, { color: colors.ink }]}>
            {activeFolder ? "Parent Folder" : "Repositories"}
          </Text>
        </Pressable>

        <View style={styles.breadcrumbTrail}>
          <ChevronRight size={14} color={colors.inkFaint} />
          <Text style={[styles.crumbRoot, { color: colors.inkSoft }]} numberOfLines={1}>
            {post.title || "Project"}
          </Text>
          {activeFolder && (
            <>
              <ChevronRight size={14} color={colors.inkFaint} />
              <Text style={[styles.crumbActive, { color: colors.brand }]} numberOfLines={1}>
                {activeFolder === "documents"
                  ? "Documents & Manuscripts"
                  : activeFolder === "media"
                  ? "Media & Visual Assets"
                  : "External Links"}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* 2. Repository Meta Header */}
      <View style={[styles.repoHeaderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.titleWithBadge}>
            <Text style={[styles.headerTitle, { color: colors.ink }]}>{post.title}</Text>
            <View style={[styles.typeBadge, { backgroundColor: colors.brandWash, borderColor: colors.brand }]}>
              <Text style={[styles.typeBadgeText, { color: colors.brand }]}>{repoType}</Text>
            </View>
          </View>
        </View>

        {post.description || post.content ? (
          <Text style={[styles.headerDescription, { color: colors.inkSoft }]} numberOfLines={2}>
            {post.description || post.content}
          </Text>
        ) : null}

        {/* Quick External Actions */}
        {(post.live_url || post.previewUrl || post.github_url) && (
          <View style={styles.quickLinksRow}>
            {post.live_url && (
              <Pressable
                onPress={() => Linking.openURL(post.live_url)}
                style={({ pressed, hovered }: any) => [
                  styles.quickLinkBtn,
                  {
                    backgroundColor: colors.surfaceSunken,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : hovered ? 0.9 : 1,
                  },
                ]}
              >
                <Globe size={13} color={colors.brand} />
                <Text style={[styles.quickLinkText, { color: colors.brand }]}>Live Demo</Text>
                <ExternalLink size={12} color={colors.brand} />
              </Pressable>
            )}
            {post.previewUrl && post.previewUrl !== post.live_url && (
              <Pressable
                onPress={() => Linking.openURL(post.previewUrl)}
                style={({ pressed, hovered }: any) => [
                  styles.quickLinkBtn,
                  {
                    backgroundColor: colors.surfaceSunken,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : hovered ? 0.9 : 1,
                  },
                ]}
              >
                <LinkIcon size={13} color={colors.ink} />
                <Text style={[styles.quickLinkText, { color: colors.ink }]}>Project Link</Text>
                <ExternalLink size={12} color={colors.inkFaint} />
              </Pressable>
            )}
            {post.github_url && (
              <Pressable
                onPress={() => Linking.openURL(post.github_url)}
                style={({ pressed, hovered }: any) => [
                  styles.quickLinkBtn,
                  {
                    backgroundColor: colors.surfaceSunken,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : hovered ? 0.9 : 1,
                  },
                ]}
              >
                <Code2 size={13} color={colors.ink} />
                <Text style={[styles.quickLinkText, { color: colors.ink }]}>Repository</Text>
                <ExternalLink size={12} color={colors.inkFaint} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* 3. GitHub-Style File Tree / Folder Explorer */}
      <View style={[styles.explorerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Explorer Header */}
        <View style={[styles.explorerHeader, { backgroundColor: colors.surfaceSunken, borderBottomColor: colors.border }]}>
          <View style={styles.explorerHeaderLeft}>
            {activeFolder ? (
              <FolderOpen size={16} color={colors.brand} style={{ marginRight: 8 }} />
            ) : (
              <HardDrive size={16} color={colors.inkSoft} style={{ marginRight: 8 }} />
            )}
            <Text style={[styles.explorerBranchText, { color: colors.ink }]}>
              {activeFolder ? `main / ${activeFolder}` : "main / root"}
            </Text>
          </View>
          <Text style={[styles.explorerCountText, { color: colors.inkFaint }]}>
            {activeFolder === "documents"
              ? `${assets.documents.length} document${assets.documents.length === 1 ? "" : "s"}`
              : activeFolder === "media"
              ? `${assets.media.length} media asset${assets.media.length === 1 ? "" : "s"}`
              : activeFolder === "links"
              ? `${assets.links.length} external link${assets.links.length === 1 ? "" : "s"}`
              : `${assets.allCount} total item${assets.allCount === 1 ? "" : "s"}`}
          </Text>
        </View>

        {/* Root Level: Virtual Folders */}
        {!activeFolder && (
          <View style={styles.folderList}>
            {virtualFolders.map((folder) => (
              <Pressable
                key={folder.key}
                onPress={() => setActiveFolder(folder.key)}
                style={({ pressed, hovered }: any) => [
                  styles.folderRow,
                  {
                    borderBottomColor: colors.line,
                    backgroundColor: pressed || hovered ? colors.hoverOverlay : "transparent",
                  },
                ]}
              >
                <View style={styles.folderRowLeft}>
                  <Folder size={18} color={colors.brand} style={{ marginRight: 10 }} />
                  <View>
                    <Text style={[styles.folderName, { color: colors.ink }]}>{folder.name}</Text>
                    <Text style={[styles.folderDesc, { color: colors.inkFaint }]}>
                      {folder.description}
                    </Text>
                  </View>
                </View>
                <View style={styles.folderRowRight}>
                  <Text style={[styles.folderCount, { color: colors.inkSoft }]}>
                    {folder.count} items
                  </Text>
                  {folder.totalSizeBytes > 0 && (
                    <Text style={[styles.folderSize, { color: colors.inkFaint }]}>
                      {formatBytes(folder.totalSizeBytes)}
                    </Text>
                  )}
                  <ChevronRight size={16} color={colors.inkFaint} style={{ marginLeft: 6 }} />
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Inside Folder View */}
        {activeFolder && (
          <View style={styles.folderContentsList}>
            {/* Parent Directory Link */}
            <Pressable
              onPress={() => setActiveFolder(null)}
              style={({ pressed, hovered }: any) => [
                styles.parentDirRow,
                {
                  borderBottomColor: colors.line,
                  backgroundColor: pressed || hovered ? colors.hoverOverlay : "transparent",
                },
              ]}
            >
              <FolderOpen size={16} color={colors.inkFaint} style={{ marginRight: 8 }} />
              <Text style={[styles.parentDirText, { color: colors.brand }]}>.. (Back to root)</Text>
            </Pressable>

            {/* Documents List */}
            {activeFolder === "documents" && (
              <>
                {assets.documents.length === 0 ? (
                  <View style={styles.emptyFolderBox}>
                    <Text style={[styles.emptyFolderText, { color: colors.inkFaint }]}>
                      No document files in this folder.
                    </Text>
                  </View>
                ) : (
                  assets.documents.map((doc, idx) => {
                    const ext = getFileExtension(doc.file_name);
                    return (
                      <Pressable
                        key={doc.id || idx}
                        onPress={() => handleOpenFile(doc)}
                        style={({ pressed, hovered }: any) => [
                          styles.fileRow,
                          {
                            borderBottomColor: colors.line,
                            backgroundColor: pressed || hovered ? colors.hoverOverlay : "transparent",
                          },
                        ]}
                      >
                        <View style={styles.fileRowLeft}>
                          <FileText
                            size={16}
                            color={ext === "pdf" ? "#EF4444" : colors.brand}
                            style={{ marginRight: 10 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.fileNameText, { color: colors.ink }]} numberOfLines={1}>
                              {doc.file_name}
                            </Text>
                            <Text style={[styles.fileExtText, { color: colors.inkFaint }]}>
                              {ext ? ext.toUpperCase() : "DOC"} FILE
                            </Text>
                          </View>
                        </View>
                        <View style={styles.fileRowRight}>
                          {doc.size_bytes ? (
                            <Text style={[styles.fileSizeText, { color: colors.inkFaint }]}>
                              {formatBytes(doc.size_bytes)}
                            </Text>
                          ) : null}
                          <Eye size={15} color={colors.inkSoft} style={{ marginLeft: 10 }} />
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </>
            )}

            {/* Media Assets List */}
            {activeFolder === "media" && (
              <>
                {assets.media.length === 0 ? (
                  <View style={styles.emptyFolderBox}>
                    <Text style={[styles.emptyFolderText, { color: colors.inkFaint }]}>
                      No image or media assets in this folder.
                    </Text>
                  </View>
                ) : (
                  assets.media.map((med, idx) => (
                    <Pressable
                      key={med.id || idx}
                      onPress={() => handleOpenFile(med)}
                      style={({ pressed, hovered }: any) => [
                        styles.fileRow,
                        {
                          borderBottomColor: colors.line,
                          backgroundColor: pressed || hovered ? colors.hoverOverlay : "transparent",
                        },
                      ]}
                    >
                      <View style={styles.fileRowLeft}>
                        <ImageIcon size={16} color="#10B981" style={{ marginRight: 10 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fileNameText, { color: colors.ink }]} numberOfLines={1}>
                            {med.file_name}
                          </Text>
                          <Text style={[styles.fileExtText, { color: colors.inkFaint }]}>
                            VISUAL ASSET
                          </Text>
                        </View>
                      </View>
                      <View style={styles.fileRowRight}>
                        {med.size_bytes ? (
                          <Text style={[styles.fileSizeText, { color: colors.inkFaint }]}>
                            {formatBytes(med.size_bytes)}
                          </Text>
                        ) : null}
                        <Eye size={15} color={colors.inkSoft} style={{ marginLeft: 10 }} />
                      </View>
                    </Pressable>
                  ))
                )}
              </>
            )}

            {/* External Links List */}
            {activeFolder === "links" && (
              <>
                {assets.links.length === 0 ? (
                  <View style={styles.emptyFolderBox}>
                    <Text style={[styles.emptyFolderText, { color: colors.inkFaint }]}>
                      No external links configured for this project.
                    </Text>
                  </View>
                ) : (
                  assets.links.map((link) => (
                    <Pressable
                      key={link.id}
                      onPress={() => handleOpenLink(link)}
                      style={({ pressed, hovered }: any) => [
                        styles.fileRow,
                        {
                          borderBottomColor: colors.line,
                          backgroundColor: pressed || hovered ? colors.hoverOverlay : "transparent",
                        },
                      ]}
                    >
                      <View style={styles.fileRowLeft}>
                        <ExternalLink size={16} color={colors.brand} style={{ marginRight: 10 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fileNameText, { color: colors.ink }]} numberOfLines={1}>
                            {link.title}
                          </Text>
                          <Text style={[styles.fileExtText, { color: colors.inkFaint }]} numberOfLines={1}>
                            {link.url}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.fileRowRight}>
                        <Text style={[styles.fileExtText, { color: colors.brand, fontWeight: "600" }]}>
                          VISIT
                        </Text>
                      </View>
                    </Pressable>
                  ))
                )}
              </>
            )}
          </View>
        )}
      </View>

      {/* 4. GitHub-Style README / Project Summary */}
      <RepositoryReadmeCard post={post} />

      {/* 5. Integrated File Previewer Modal */}
      <FilePreviewModal
        visible={!!selectedPreviewFile}
        file={selectedPreviewFile}
        onClose={() => setSelectedPreviewFile(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  breadcrumbBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACE.x3,
    gap: SPACE.x2,
  },
  backNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x2,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  backNavText: {
    fontSize: 13,
    fontWeight: "600",
  },
  breadcrumbTrail: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 4,
  },
  crumbRoot: {
    fontSize: 13,
    fontWeight: "500",
    maxWidth: 200,
  },
  crumbActive: {
    fontSize: 13,
    fontWeight: "700",
    maxWidth: 200,
  },
  repoHeaderCard: {
    padding: SPACE.x4,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACE.x3,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACE.x2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  headerDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  quickLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACE.x2,
    marginTop: SPACE.x3,
  },
  quickLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACE.x3,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  quickLinkText: {
    fontSize: 12,
    fontWeight: "600",
  },
  explorerCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  explorerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x2 + 2,
    borderBottomWidth: 1,
  },
  explorerHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  explorerBranchText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  explorerCountText: {
    fontSize: 12,
    fontWeight: "500",
  },
  folderList: {
    paddingVertical: 4,
  },
  folderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x3,
    borderBottomWidth: 1,
  },
  folderRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  folderName: {
    fontSize: 14,
    fontWeight: "600",
  },
  folderDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  folderRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  folderCount: {
    fontSize: 12,
    fontWeight: "500",
  },
  folderSize: {
    fontSize: 11,
  },
  folderContentsList: {
    paddingVertical: 4,
  },
  parentDirRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x3,
    borderBottomWidth: 1,
  },
  parentDirText: {
    fontSize: 13,
    fontWeight: "600",
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x3,
    borderBottomWidth: 1,
  },
  fileRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: SPACE.x2,
  },
  fileNameText: {
    fontSize: 13,
    fontWeight: "500",
  },
  fileExtText: {
    fontSize: 11,
    marginTop: 2,
  },
  fileRowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  fileSizeText: {
    fontSize: 12,
  },
  emptyFolderBox: {
    padding: SPACE.x6,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyFolderText: {
    fontSize: 13,
  },
});
