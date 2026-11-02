import { apiJson, ApiError } from "./api";

export type LinkPreviewData = {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string;
  siteName?: string | null;
};

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

