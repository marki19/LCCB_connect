import { supabase } from './supabase';

export type LinkPreviewData = {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string;
};

/**
 * Fetches metadata (Open Graph tags) for a given URL by calling our Supabase Edge Function.
 * This is used for generating rich link previews in the Broadcasting Feed or Messages.
 * 
 * @param url The URL to fetch a preview for
 * @returns A LinkPreviewData object or null if it fails
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  try {
    const { data, error } = await supabase.functions.invoke('link-preview', {
      body: { url },
    });

    if (error) {
      console.error('Error fetching link preview from edge function:', error.message);
      return null;
    }

    return data as LinkPreviewData;
  } catch (err) {
    console.error('Failed to invoke link-preview function', err);
    return null;
  }
}
