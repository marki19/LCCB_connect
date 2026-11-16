import React, { forwardRef } from "react";
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
 * - Caches to memory & disk so rotating presigned URLs do not re-fetch existing bytes
 * - Defaults contentFit="cover" and smooth 150ms cross-fade transition
 */
export const AppImage = forwardRef<ExpoImage, AppImageProps>(function AppImage(
  {
    source,
    cachePolicy = "memory-disk",
    contentFit = "cover",
    transition = 150,
    recyclingKey,
    ...props
  },
  ref
) {
  if (!source) return null;

  let resolvedSource: any = source;
  let derivedCacheKey: string | undefined;

  if (typeof source === "string") {
    derivedCacheKey = fileKeyFromUrl(source);
    resolvedSource = {
      uri: source,
      ...(derivedCacheKey ? { cacheKey: derivedCacheKey } : {}),
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
      ...(derivedCacheKey && !(source as any).cacheKey
        ? { cacheKey: derivedCacheKey }
        : {}),
    };
  }

  const finalRecyclingKey =
    recyclingKey ||
    derivedCacheKey ||
    (typeof source === "string"
      ? source
      : typeof source === "object" && source !== null && "uri" in source
      ? (source as any).uri
      : undefined);

  return (
    <ExpoImage
      ref={ref}
      source={resolvedSource}
      cachePolicy={cachePolicy}
      contentFit={contentFit}
      transition={transition}
      recyclingKey={finalRecyclingKey}
      {...props}
    />
  );
});
