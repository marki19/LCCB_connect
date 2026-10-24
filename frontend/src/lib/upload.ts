import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabase';

/**
 * Per-bucket upload policy. Anything not listed here (or not matching the
 * listed types) is refused before the file ever reaches Storage.
 */
const BUCKET_MIME_TYPES: Record<string, string[]> = {
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
 * Uploads a file (by its local URI) to Supabase Storage.
 * @param uri The local file URI (from image picker or document picker)
 * @param bucketName The name of the Supabase bucket (e.g. 'assets')
 * @param path The target path inside the bucket (e.g. 'avatars/user-id.jpg' or 'thesis/doc-id.pdf')
 * @param contentType The MIME type of the file
 * @param maxBytes The size ceiling for this purpose (see MAX_UPLOAD_BYTES)
 * @returns The stored object key and public URL, or null if it failed.
 */
export async function uploadToStorage(
  uri: string,
  bucketName: string,
  path: string,
  contentType: string = 'application/octet-stream',
  maxBytes: number
): Promise<{ key: string; url: string } | null> {
  try {
    // 0. Reject disallowed file types for this bucket.
    if (!isAllowedMime(bucketName, contentType)) {
      console.error(`Upload rejected: "${contentType}" is not allowed in "${bucketName}"`);
      return null;
    }

    // 1. Convert local URI to a Blob
    const response = await fetch(uri);
    const blob = await response.blob();

    // 2. Reject oversized files before uploading.
    if (blob.size > maxBytes) {
      console.error(`Upload rejected: file is ${blob.size} bytes (max ${maxBytes})`);
      return null;
    }

    // 3. Upload to Supabase Storage.
    //    `upsert: false` — never silently overwrite an existing object.
    const { error } = await supabase.storage
      .from(bucketName)
      .upload(path, blob, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error('Upload Error:', error);
      throw error;
    }

    // 4. The API stores the *key*; the URL is only needed as a preview if the
    //    UI wants to render the file again after a response round-trip.
    const { data: publicData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(path);

    return { key: path, url: publicData.publicUrl };
  } catch (err) {
    console.error('Failed to upload file to storage', err);
    return null;
  }
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
