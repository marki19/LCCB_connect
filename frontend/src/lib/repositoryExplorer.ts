import type { Post, PostAttachment } from "../types";

export interface RepositoryLinkItem {
  id: string;
  title: string;
  url: string;
  type: "demo" | "repo" | "resource" | "link";
  description?: string;
}

export interface CategorizedRepositoryAssets {
  documents: PostAttachment[];
  media: PostAttachment[];
  links: RepositoryLinkItem[];
  allCount: number;
}

export type VirtualFolderKey = "documents" | "media" | "links";

export interface VirtualFolderInfo {
  key: VirtualFolderKey;
  name: string;
  count: number;
  totalSizeBytes: number;
  description: string;
}

/**
 * Format raw byte size into human readable string (KB / MB).
 */
export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Extract clean extension from filename or storage key.
 */
export function getFileExtension(filename?: string | null): string {
  if (!filename) return "";
  const clean = filename.split("?")[0].split("#")[0];
  const parts = clean.split(".");
  if (parts.length <= 1) return "";
  return parts[parts.length - 1].toLowerCase();
}

const DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "doc",
  "pptx",
  "ppt",
  "xlsx",
  "xls",
  "txt",
  "rtf",
  "csv",
  "odt",
  "ods",
  "odp",
]);

const MEDIA_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
  "bmp",
  "heic",
  "mp4",
  "mov",
]);

/**
 * Determines whether an attachment is a document manuscript or media asset.
 */
export function isDocumentAttachment(attachment: PostAttachment): boolean {
  const mime = (attachment.mime_type || "").toLowerCase();
  const ext = getFileExtension(attachment.file_name || attachment.storage_key);

  if (
    mime.includes("pdf") ||
    mime.includes("word") ||
    mime.includes("officedocument") ||
    mime.includes("text/") ||
    mime.includes("presentation") ||
    mime.includes("spreadsheet")
  ) {
    return true;
  }
  return DOCUMENT_EXTENSIONS.has(ext);
}

export function isMediaAttachment(attachment: PostAttachment): boolean {
  const mime = (attachment.mime_type || "").toLowerCase();
  const ext = getFileExtension(attachment.file_name || attachment.storage_key);

  if (mime.startsWith("image/") || mime.startsWith("video/")) {
    return true;
  }
  return MEDIA_EXTENSIONS.has(ext);
}

/**
 * Classifies all assets, files, images, and external resource links from a post
 * into structured virtual folders (Documents, Media, Links).
 */
export function classifyRepositoryAssets(post: Post | any): CategorizedRepositoryAssets {
  const documents: PostAttachment[] = [];
  const media: PostAttachment[] = [];
  const links: RepositoryLinkItem[] = [];

  const rawAttachments: PostAttachment[] = Array.isArray(post.attachments)
    ? post.attachments
    : [];

  const seenKeys = new Set<string>();

  // 1. Process explicit attachments
  for (const att of rawAttachments) {
    const key = att.storage_key || att.file_name || att.url;
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);

    if (isDocumentAttachment(att)) {
      documents.push(att);
    } else if (isMediaAttachment(att)) {
      media.push(att);
    } else {
      // Default to documents folder for generalized coursework assets
      documents.push(att);
    }
  }

  // 2. Incorporate legacy image_urls or imageUrl if not already present
  const imageUrls: string[] = [];
  if (Array.isArray(post.image_urls) && post.image_urls.length > 0) {
    imageUrls.push(...post.image_urls);
  } else if (post.imageUrl || post.image_url) {
    imageUrls.push(post.imageUrl || post.image_url);
  }

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    if (url && !seenKeys.has(url)) {
      seenKeys.add(url);
      const name = url.split("/").pop() || `image-${i + 1}.png`;
      media.push({
        id: `img-${i}-${post.id}`,
        storage_key: url,
        file_name: name,
        mime_type: "image/jpeg",
        size_bytes: null,
        url: url,
      });
    }
  }

  // 3. Process Links & Live References
  if (post.live_url) {
    links.push({
      id: "link-live",
      title: "Live Application / Presentation Demo",
      url: post.live_url,
      type: "demo",
      description: "Deployed website, live simulation, or presentation link",
    });
  }

  if (post.previewUrl && post.previewUrl !== post.live_url) {
    links.push({
      id: "link-preview",
      title: post.preview_metadata?.title || "Project Resource Link",
      url: post.previewUrl,
      type: "resource",
      description: post.preview_metadata?.description || "External portfolio, cloud folder, or reference",
    });
  }

  if (post.github_url && post.github_url !== post.live_url && post.github_url !== post.previewUrl) {
    links.push({
      id: "link-github",
      title: "GitHub Repository",
      url: post.github_url,
      type: "repo",
      description: "Source code repository and release history",
    });
  }

  return {
    documents,
    media,
    links,
    allCount: documents.length + media.length + links.length,
  };
}

/**
 * Returns summary cards for virtual root folders.
 */
export function getVirtualFolders(assets: CategorizedRepositoryAssets): VirtualFolderInfo[] {
  const docsSize = assets.documents.reduce((acc, curr) => acc + (curr.size_bytes || 0), 0);
  const mediaSize = assets.media.reduce((acc, curr) => acc + (curr.size_bytes || 0), 0);

  return [
    {
      key: "documents",
      name: "Documents & Manuscripts",
      count: assets.documents.length,
      totalSizeBytes: docsSize,
      description: "PDFs, Word docs, research papers, and slide decks",
    },
    {
      key: "media",
      name: "Media & Visual Assets",
      count: assets.media.length,
      totalSizeBytes: mediaSize,
      description: "Designs, screenshots, renders, and schematics",
    },
    {
      key: "links",
      name: "External Links & Resources",
      count: assets.links.length,
      totalSizeBytes: 0,
      description: "Live demos, source repositories, and cloud drives",
    },
  ];
}
