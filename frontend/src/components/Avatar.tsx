import React, { useState } from "react";
import { View, Text, type StyleProp, type ViewStyle } from "react-native";
import type { PresenceMode } from "../types";
import { useTheme } from "../contexts/ThemeContext";
import { resolveFileUrl } from "../lib/files";
import { AppImage } from "./AppImage";
import { type ThemeTokens } from "../lib/tokens";

/**
 * Shared avatar + presence dot. `mode === null` means "not tracked" (offline or
 * invisible), so no dot renders.
 */

export const PRESENCE_LABELS: Record<PresenceMode, string> = {
  online: "Online",
  away: "Away",
  busy: "Busy",
  dnd: "Do not disturb",
  invisible: "Invisible",
};

function presenceColor(mode: PresenceMode, colors: ThemeTokens) {
  switch (mode) {
    case "online":
      return colors.presenceOnline;
    case "away":
      return colors.presenceAway;
    case "busy":
      return colors.presenceBusy;
    case "dnd":
      return colors.presenceDnd;
    case "invisible":
      return colors.presenceInvisible;
  }
}

export function initialsOf(name?: string | null): string {
  if (!name) return "LC";
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

type Props = {
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  size?: number;
  mode?: PresenceMode | null;
  showPresence?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function Avatar({
  name,
  username,
  avatarUrl,
  size = 48,
  mode = null,
  showPresence = false,
  style,
}: Props) {
  const { colors } = useTheme();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const resolvedUrl = resolveFileUrl(avatarUrl);
  const showImage = Boolean(resolvedUrl && failedUrl !== resolvedUrl);

  const dot = Math.round(size * 0.3);
  const ring = Math.max(2, Math.round(size * 0.06));
  const displayName = name || username || "";

  return (
    <View style={[{ width: size, height: size }, style]}>
      {showImage && resolvedUrl ? (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: "hidden",
            backgroundColor: colors.surfaceSunken,
          }}
        >
          <AppImage
            source={{ uri: resolvedUrl }}
            style={{ width: size, height: size }}
            contentFit="cover"
            onError={() => setFailedUrl(resolvedUrl)}
          />
        </View>
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.actionSurfaceAlt,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: Math.round(size * 0.36),
              fontWeight: "700",
              color: colors.textPrimary,
            }}
          >
            {initialsOf(displayName)}
          </Text>
        </View>
      )}

      {showPresence && mode ? (
        <View
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: presenceColor(mode, colors),
            borderWidth: ring,
            borderColor: colors.surface,
          }}
        />
      ) : null}
    </View>
  );
}
