import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabase';

/**
 * Per-bucket upload policy. Anything not listed here (or not matching the
 * listed types) is refused before the file ever reaches Storage.
 */
const BUCKET_MIME_TYPES: Record<string, string[]> = {
  avatars: ['image/png', 'image/jpeg', 'image/webp'],
  assets: ['image/png', 'image/jpeg', 'image/webp'],
  theses: ['application/pdf'],
};

/**
 * Per-purpose upload ceilings, enforced before the file reaches Storage.
 * Keep in sync with the bucket limits in migrations/012_storage_size_limits.sql
 * (these are the stricter, client-side limits on top of the bucket ceiling).
 */
export const MAX_UPLOAD_BYTES = {
  /** Profile pictures. */
  avatar: 2 * 1024 * 1024, // 2 MB
  /** Post images. */
  image: 5 * 1024 * 1024, // 5 MB
  /** Thesis manuscripts (free-plan ceiling). */
  pdf: 50 * 1024 * 1024, // 50 MB
} as const;

function isAllowedMime(bucketName: string, contentType: string): boolean {
  const allowed = BUCKET_MIME_TYPES[bucketName];
  if (!allowed) return false; // unknown bucket -> refuse
  return allowed.includes(contentType.toLowerCase());
}

/**
 * Prompts the user to pick an image from their device gallery.
 * @returns An object with the local uri and mimetype, or null if cancelled.
 */
export async function pickImage() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true, // Let users crop avatars
    quality: 0.8,
  });
  if (!result.canceled && result.assets && result.assets.length > 0) {
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      type: 'image/jpeg',
      name: asset.fileName || `image-${Date.now()}.jpg`
    };
  }
  return null;
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
 * Direct Supabase upload for public buckets.
 *
 * Manuscripts (theses) are NOT uploaded through this path — they go through
 * the backend so the bytes never touch the client's Supabase key. Avatars
 * stay here because `avatars` is a public bucket and the client's anon key is
 * sufficient; the server only needs the object key to render the profile.
 *
 * @returns The object key on success, or null on failure.
 */
export async function uploadToStorage(
  uri: string,
  bucket: string,
  path: string,
  contentType: string,
  maxBytes: number,
  sizeBytes: number | null = null
): Promise<{ key: string } | null> {
  const error = validateUpload(bucket, contentType, sizeBytes ?? 0, maxBytes);
  if (error) {
    console.error("[upload] validation failed:", error);
    return null;
  }

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, uri, { contentType, upsert: true });

  if (uploadError) {
    console.error("[upload] Supabase upload failed:", uploadError.message);
    return null;
  }

  return { key: path };
}