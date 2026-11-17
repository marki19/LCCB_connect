import { apiJson, ApiError } from "./api";

export type LinkPreviewData = {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string;
  siteName?: string | null;
};

/**
 * Normalizes raw website / link inputs: prefixes https:// if scheme is missing.
 */
export function normalizeWebsiteUrl(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Extracts the first valid URL from raw text (e.g. pasted into a post body).
 * Supports both full protocols (https://...) and naked domains (e.g. lccb-connect.vercel.app).
 * Ignores email addresses and common filename extensions.
 */
export function extractFirstUrl(text: string | null | undefined): string | null {
  if (!text || typeof text !== "string") return null;

  const tokens = text.split(/\s+/);
  for (const rawToken of tokens) {
    const token = rawToken.replace(/^[<(\[{'"]+/, "").replace(/[>,:;"')\]}.]+$/, "");
    if (!token || token.includes("@")) continue;

    if (/^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/.*)?$/i.test(token)) {
      return token;
    }
    if (
      /^[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/.*)?$/i.test(token) ||
      /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/.*)?$/i.test(token)
    ) {
      if (!token.includes("/") && /\.(jpg|jpeg|png|gif|webp|svg|pdf|docx?|txt)$/i.test(token)) {
        continue;
      }
      return token;
    }
  }

  return null;
}

/**
 * Fetches metadata (Open Graph tags) for a given URL by calling our Express backend.
 * This is used for generating rich link previews for IT student websites and live apps.
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  try {
    const data = await apiJson<LinkPreviewData>("/posts/preview", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      console.warn("Backend link preview returned status", err.status);
    } else {
      console.error("Failed to fetch link preview from backend", err);
    }
    return null;
  }
}

