import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { apiFetchMultipart } from './api';

/**
 * Per-bucket upload policy. Anything not listed here (or not matching the
 * listed types) is refused before the file ever reaches Storage.
 */
const BUCKET_MIME_TYPES: Record<string, string[]> = {
  avatars: ['image/png', 'image/jpeg', 'image/webp'],
  assets: ['image/png', 'image/jpeg', 'image/webp'],
  posts: ['image/png', 'image/jpeg', 'image/webp'],
  theses: ['application/pdf'],
  documents: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ],
  videos: ['video/mp4', 'video/webm'],
  snaps: ['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'],
  covers: ['image/png', 'image/jpeg', 'image/webp'],
};

/**
 * Per-purpose upload ceilings, enforced before the file reaches Storage.
 * Keep in sync with the bucket limits in migrations/012_storage_size_limits.sql
 * (these are the stricter, client-side limits on top of the bucket ceiling).
 */
export const MAX_UPLOAD_BYTES = {
  /** Profile pictures. */
  avatar: 2 * 1024 * 1024, // 2 MB
  /** Profile cover banners. */
  cover: 5 * 1024 * 1024, // 5 MB
  /** Post images. */
  image: 5 * 1024 * 1024, // 5 MB
  /** Thesis manuscripts (free-plan ceiling). */
  pdf: 50 * 1024 * 1024, // 50 MB
  /** Quick Snap media (image/video). */
  snap: 25 * 1024 * 1024, // 25 MB
} as const;

function isAllowedMime(bucketName: string, contentType: string): boolean {
  const allowed = BUCKET_MIME_TYPES[bucketName];
  if (!allowed) return false; // unknown bucket -> refuse
  return allowed.includes(contentType.toLowerCase());
}

export interface PickedImage {
  uri: string;
  type: string;
  name: string;
  width?: number;
  height?: number;
}

export interface PickedSnapMedia {
  uri: string;
  type: string;
  name: string;
  mediaType: 'image' | 'video';
  durationMs?: number;
  width?: number;
  height?: number;
}

/**
 * Prompts the user to capture a snap using their device camera (photo or video up to 30s).
 */
export async function captureSnap(): Promise<PickedSnapMedia | null> {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images', 'videos'],
    videoMaxDuration: 30,
    quality: 0.8,
  });
  if (!result.canceled && result.assets && result.assets.length > 0) {
    const asset = result.assets[0];
    const isVideo = asset.type === 'video' || (asset.mimeType && asset.mimeType.startsWith('video/'));
    const ext = isVideo ? '.mp4' : '.jpg';
    return {
      uri: asset.uri,
      type: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
      name: asset.fileName || `snap-${Date.now()}${ext}`,
      mediaType: isVideo ? 'video' : 'image',
      durationMs: asset.duration ? Math.round(asset.duration * 1000) : undefined,
      width: asset.width,
      height: asset.height,
    };
  }
  return null;
}

/**
 * Prompts the user to pick a snap media (photo or video up to 30s) from their gallery.
 */
export async function pickSnap(): Promise<PickedSnapMedia | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    videoMaxDuration: 30,
    quality: 0.8,
  });
  if (!result.canceled && result.assets && result.assets.length > 0) {
    const asset = result.assets[0];
    const isVideo = asset.type === 'video' || (asset.mimeType && asset.mimeType.startsWith('video/'));
    const ext = isVideo ? '.mp4' : '.jpg';
    return {
      uri: asset.uri,
      type: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
      name: asset.fileName || `snap-${Date.now()}${ext}`,
      mediaType: isVideo ? 'video' : 'image',
      durationMs: asset.duration ? Math.round(asset.duration * 1000) : undefined,
      width: asset.width,
      height: asset.height,
    };
  }
  return null;
}

/**
 * Prompts the user to pick an image from their device gallery.
 * @returns An object with the local uri and mimetype, or null if cancelled.
 */
export async function pickImage(options: { allowsEditing?: boolean } = {}): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: options.allowsEditing ?? true, // Default to true for avatar crop
    quality: 0.8,
  });
  if (!result.canceled && result.assets && result.assets.length > 0) {
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      type: 'image/jpeg',
      name: asset.fileName || `image-${Date.now()}.jpg`,
      width: asset.width,
      height: asset.height,
    };
  }
  return null;
}

/**
 * Prompts the user to pick an image for a profile cover banner (16:9 aspect crop).
 */
export async function pickCoverImage(): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [16, 9],
    quality: 0.85,
  });
  if (!result.canceled && result.assets && result.assets.length > 0) {
    const asset = result.assets[0];
    const uri = asset.uri;
    const fileName = asset.fileName || uri.split('/').pop() || `cover-${Date.now()}.jpg`;
    return {
      uri,
      type: 'image/jpeg',
      name: fileName,
      width: asset.width,
      height: asset.height,
    };
  }
  return null;
}

/**
 * Prompts the user to select one or multiple images (up to selectionLimit, default 4).
 */
export async function pickMultipleImages(options: { selectionLimit?: number } = {}): Promise<PickedImage[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: options.selectionLimit ?? 4,
    quality: 0.8,
  });
  if (!result.canceled && result.assets && result.assets.length > 0) {
    return result.assets.map((asset, index) => ({
      uri: asset.uri,
      type: 'image/jpeg',
      name: asset.fileName || `image-${Date.now()}-${index}.jpg`,
      width: asset.width,
      height: asset.height,
    }));
  }
  return [];
}

/**
 * Prompts the user to pick a PDF document from their device files.
 * The repository accepts PDF manuscripts only.
 * @returns An object with the local uri, name, and mimetype, or null if cancelled.
 */
export async function pickDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf'],
    copyToCacheDirectory: true,
  });
  if (!result.canceled && result.assets && result.assets.length > 0) {
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      type: 'application/pdf',
      name: asset.name
    };
  }
  return null;
}

/**
 * Validates a file before it is handed to the upload endpoint.
 *
 * The app no longer talks to Supabase Storage directly for manuscripts: every
 * thesis upload is a multipart POST to the Express API, which enforces the
 * same rules server-side (magic-byte check, size cap, bucket policy) and
 * stores only the object key.
 *
 * @returns An error string, or null when the file is acceptable.
 */
export function validateUpload(
  bucketName: string,
  contentType: string,
  sizeBytes: number,
  maxBytes: number
): string | null {
  if (!isAllowedMime(bucketName, contentType)) {
    return `"${contentType}" is not allowed in "${bucketName}"`;
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return "Could not read the file size";
  }
  if (sizeBytes > maxBytes) {
    return `File is ${sizeBytes} bytes (max ${maxBytes})`;
  }
  return null;
}

/**
 * Uploads a file through the backend storage endpoint.
 *
 * Saves into categorized subdirectories (avatars, posts, theses, documents, videos)
 * with cryptographic SHA-256 collision-free hashing.
 *
 * @returns The object key (e.g. "posts/a1b2c3d4.jpg") on success, or null on failure.
 */
export async function uploadToStorage(
  uri: string,
  bucket: string = 'assets',
  path?: string,
  contentType: string = 'image/jpeg',
  maxBytes: number = MAX_UPLOAD_BYTES.image,
  sizeBytes: number | null = null
): Promise<{ key: string } | null> {
  const category = bucket === 'assets' ? 'posts' : bucket;
  const error = validateUpload(category, contentType, sizeBytes ?? 0, maxBytes);
  if (error) {
    console.error("[upload] validation failed:", error);
    return null;
  }

  try {
    const formData = new FormData();
    const fileName = path ? path.split('/').pop() || 'upload.jpg' : `upload-${Date.now()}.jpg`;

    if (Platform.OS === 'web') {
      const res = await fetch(uri);
      const blob = await res.blob();
      formData.append('file', blob, fileName);
    } else {
      formData.append('file', {
        uri,
        name: fileName,
        type: contentType,
      } as any);
    }

    const res = await apiFetchMultipart(`/upload/${category}`, formData);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error("[upload] backend upload failed:", errData.error || res.status);
      return null;
    }

    const data = await res.json();
    return { key: data.filename };
  } catch (err: any) {
    console.error("[upload] exception during upload:", err?.message || err);
    return null;
  }
}