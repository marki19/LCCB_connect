import { Image } from "expo-image";
import { useCallback, useRef } from "react";
import { resolveFileUrls } from "../lib/files";

/**
 * Prefetches image URLs ahead of the viewport scroll to ensure instant rendering.
 * Tracks already-prefetched URLs in an in-memory Set to avoid redundant calls.
 */
export function usePrefetchImages() {
  const prefetchedRef = useRef<Set<string>>(new Set());

  const prefetch = useCallback((urls: (string | null | undefined)[]) => {
    const resolved = resolveFileUrls(urls);
    const toFetch = resolved.filter((url) => !prefetchedRef.current.has(url));

    if (toFetch.length === 0) return;

    for (const url of toFetch) {
      prefetchedRef.current.add(url);
    }

    try {
      void Image.prefetch(toFetch, "memory-disk");
    } catch {
      // Best-effort prefetch
    }
  }, []);

  return prefetch;
}
