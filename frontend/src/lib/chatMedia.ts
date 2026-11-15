/**
 * chatMedia.ts — Chat media utilities for photo/image upload, message body
 * serialization, parsing, signed URL resolution, and preview formatting.
 */

import { supabase } from "./supabase";
import { uploadToStorage, MAX_UPLOAD_BYTES } from "./upload";

export interface ParsedMessageContent {
  isMedia: boolean;
  type?: "image";
  mediaUrl?: string;
  text?: string;
}

// In-memory cache for resolved signed URLs to avoid redundant signing requests
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = 20 * 60 * 60 * 1000; // 20 hours (signed for 24h)

/**
 * Parses message body string into structured media content or plain text.
 */
export function parseMessageContent(body: string | null | undefined): ParsedMessageContent {
  if (!body) {
    return { isMedia: false, text: "" };
  }

  const trimmed = body.trim();

  // 1. JSON payload: {"type":"image","url":"...","text":"..."}
  if (trimmed.startsWith('{"type":"image"') || (trimmed.startsWith("{") && trimmed.includes('"type":"image"'))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.type === "image" && typeof parsed.url === "string") {
        return {
          isMedia: true,
          type: "image",
          mediaUrl: parsed.url,
          text: typeof parsed.text === "string" ? parsed.text : undefined,
        };
      }
    } catch {
      // Fall through if not valid JSON
    }
  }

  // 2. Fallback tag syntax: [image:keyOrUrl] optional caption
  const tagMatch = trimmed.match(/^\[image:([^\]]+)\](?:\s*([\s\S]*))?$/);
  if (tagMatch) {
    return {
      isMedia: true,
      type: "image",
      mediaUrl: tagMatch[1],
      text: tagMatch[2]?.trim() || undefined,
    };
  }

  return {
    isMedia: false,
    text: body,
  };
}

/**
 * Formats an image media message body.
 */
export function formatMediaMessage(mediaKeyOrUrl: string, caption?: string): string {
  const payload: { type: "image"; url: string; text?: string } = {
    type: "image",
    url: mediaKeyOrUrl,
  };
  const trimmedCaption = caption?.trim();
  if (trimmedCaption) {
    payload.text = trimmedCaption;
  }
  return JSON.stringify(payload);
}

/**
 * Returns human-readable preview text for inbox lists or push notifications.
 */
export function formatMessagePreview(body: string | null | undefined): string {
  const parsed = parseMessageContent(body);
  if (parsed.isMedia) {
    return parsed.text ? `Photo: ${parsed.text}` : "Photo";
  }
  return parsed.text || "";
}

/**
 * Resolves a storage key or URL into a viewable signed URL for private bucket `assets`.
 */
export async function getResolvedMediaUrl(keyOrUrl: string | null | undefined): Promise<string | null> {
  if (!keyOrUrl) return null;

  // Local file or blob URI (e.g. freshly picked image before upload)
  if (
    keyOrUrl.startsWith("file://") ||
    keyOrUrl.startsWith("blob:") ||
    keyOrUrl.startsWith("data:")
  ) {
    return keyOrUrl;
  }

  // Remote full URL that already has token or is public
  if (keyOrUrl.startsWith("http://") || keyOrUrl.startsWith("https://")) {
    return keyOrUrl;
  }

  // Check in-memory cache
  const cached = signedUrlCache.get(keyOrUrl);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  // Clean key: strip leading 'assets/' if included
  const cleanPath = keyOrUrl.replace(/^assets\//, "");

  try {
    const { data, error } = await supabase.storage
      .from("assets")
      .createSignedUrl(cleanPath, 86400); // 24 hours

    if (!error && data?.signedUrl) {
      signedUrlCache.set(keyOrUrl, {
        url: data.signedUrl,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return data.signedUrl;
    }

    // Fallback: public url
    const { data: pubData } = supabase.storage.from("assets").getPublicUrl(cleanPath);
    if (pubData?.publicUrl) {
      return pubData.publicUrl;
    }
  } catch (err) {
    console.error("[chatMedia] Failed to sign storage URL:", err);
  }

  return null;
}

/**
 * Uploads a picked local chat image to the `assets` bucket.
 * Returns the stored relative key on success (e.g. `chat/{conversationId}/{timestamp}-{random}.jpg`).
 */
export async function uploadChatImage(
  localUri: string,
  conversationId?: string | null
): Promise<string | null> {
  const folder = conversationId ? `chat/${conversationId}` : "chat/dm";
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
  const storagePath = `${folder}/${filename}`;

  const result = await uploadToStorage(
    localUri,
    "assets",
    storagePath,
    "image/jpeg",
    MAX_UPLOAD_BYTES.image
  );

  return result ? result.key : null;
}

