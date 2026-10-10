import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabase';
import { Platform } from 'react-native';

/**
 * Uploads a file (by its local URI) to Supabase Storage.
 * @param uri The local file URI (from image picker or document picker)
 * @param bucketName The name of the Supabase bucket (e.g. 'assets')
 * @param path The target path inside the bucket (e.g. 'avatars/user-id.jpg' or 'thesis/doc-id.pdf')
 * @param contentType The MIME type of the file
 * @returns The public URL of the uploaded file, or null if it failed.
 */
export async function uploadToStorage(
  uri: string, 
  bucketName: string, 
  path: string, 
  contentType: string = 'application/octet-stream'
): Promise<string | null> {
  try {
    // 1. Convert local URI to a Blob
    const response = await fetch(uri);
    const blob = await response.blob();

    // 2. Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(path, blob, {
        contentType,
        upsert: true, // Overwrite if a file with the same name exists
      });

    if (error) {
      console.error('Upload Error:', error);
      throw error;
    }

    // 3. Get the public URL
    const { data: publicData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(path);

    return publicData.publicUrl;
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
      type: asset.mimeType || 'image/jpeg',
      name: asset.fileName || `image-${Date.now()}.jpg`
    };
  }
  return null;
}

/**
 * Prompts the user to pick a document (PDF, DOCX) from their device files.
 * @returns An object with the local uri, name, and mimetype, or null if cancelled.
 */
export async function pickDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    copyToCacheDirectory: true,
  });

  if (!result.canceled && result.assets && result.assets.length > 0) {
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      type: asset.mimeType || 'application/pdf',
      name: asset.name
    };
  }
  return null;
}
