import React, { forwardRef } from "react";
import { Platform } from "react-native";
import {
  Image as ExpoImage,
  type ImageProps as ExpoImageProps,
  type ImageSource,
} from "expo-image";
import { fileKeyFromUrl } from "../lib/files";

export type AppImageProps = Omit<ExpoImageProps, "source"> & {
  source: ImageSource | string | number | null | undefined;
};

/**
 * Universal Image component for LCCB Connect.
 * - Powered by `expo-image`
 * - Automatically derives a content-addressed `cacheKey` from storage keys (`posts/<hash>.jpg`)
 * - Caches to memory & disk on native so rotating presigned URLs do not re-fetch existing bytes
 * - Uses browser native image caching on web to avoid Cache API / CORS issues
 * - Defaults contentFit="cover" and smooth 150ms cross-fade transition
 */
export const AppImage = forwardRef<ExpoImage, AppImageProps>(function AppImage(
  {
    source,
    cachePolicy,
    contentFit = "cover",
    transition = 150,
    recyclingKey,
    ...props
  },
  ref
) {
  if (!source) return null;

  const effectiveCachePolicy =
    cachePolicy !== undefined
      ? cachePolicy
      : Platform.OS === "web"
      ? "none"
      : "memory-disk";

  let resolvedSource: any = source;
  let derivedCacheKey: string | undefined;

  if (typeof source === "string") {
    derivedCacheKey = fileKeyFromUrl(source);
    resolvedSource = {
      uri: source,
      ...(derivedCacheKey && Platform.OS !== "web" ? { cacheKey: derivedCacheKey } : {}),
    };
  } else if (
    typeof source === "object" &&
    source !== null &&
    "uri" in source &&
    typeof (source as any).uri === "string"
  ) {
    derivedCacheKey = fileKeyFromUrl((source as any).uri);
    resolvedSource = {
      ...source,
      ...(derivedCacheKey && !(source as any).cacheKey && Platform.OS !== "web"
        ? { cacheKey: derivedCacheKey }
        : {}),
    };
  }

  const finalRecyclingKey =
    recyclingKey ||
    (Platform.OS !== "web" ? derivedCacheKey : undefined) ||
    (typeof source === "string"
      ? source
      : typeof source === "object" && source !== null && "uri" in source
      ? (source as any).uri
      : undefined);

  return (
    <ExpoImage
      ref={ref}
      source={resolvedSource}
      cachePolicy={effectiveCachePolicy}
      contentFit={contentFit}
      transition={transition}
      recyclingKey={finalRecyclingKey}
      {...props}
    />
  );
});
