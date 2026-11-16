/**
 * chatMedia.ts — Chat media utilities for photo/image upload, message body
 * serialization, parsing, URL resolution, and preview formatting.
 */

import { resolveFileUrl } from "./files";
import { uploadToStorage, MAX_UPLOAD_BYTES } from "./upload";

export interface ParsedMessageContent {
  isMedia: boolean;
  type?: "image";
  mediaUrl?: string;
  text?: string;
}

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
 * Resolves a stored media key into a URL the app can render.
 *
 * Media messages carry the object key returned at upload time, never a URL.
 * Files are served by the backend, which authorises the request and redirects
 * to a short-lived presigned URL — so resolution is a string join: no network
 * call, no cache, and no expiry to track.
 *
 * @returns The key unchanged when it is already a local or remote URL, or
 *          `null` when there is nothing to render.
 */
export function resolveMediaUrl(keyOrUrl: string | null | undefined): string | null {
  return resolveFileUrl(keyOrUrl);
}

/**
 * Uploads a picked local chat image.
 *
 * Chat photos go to the `posts` category, which is where every user-supplied
 * image lands; the server derives the key. Returns that key on success.
 */
export async function uploadChatImage(localUri: string): Promise<string | null> {
  const result = await uploadToStorage(
    localUri,
    "posts",
    undefined,
    "image/jpeg",
    MAX_UPLOAD_BYTES.image
  );

  return result ? result.key : null;
}

