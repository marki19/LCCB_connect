import React, { useEffect, useMemo } from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useVideoPlayer, VideoView, type VideoContentFit } from "expo-video";
import { resolveFileUrl } from "../lib/files";
import { AppImage } from "./AppImage";

export interface AppVideoProps {
  source: string | null | undefined;
  style?: StyleProp<ViewStyle>;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  paused?: boolean;
  contentFit?: VideoContentFit;
  nativeControls?: boolean;
  onEnd?: () => void;
  onProgress?: (currentTime: number, duration: number) => void;
  poster?: string | null;
}

export function AppVideo({
  source,
  style,
  autoPlay = false,
  loop = false,
  muted = false,
  paused = false,
  contentFit = "contain",
  nativeControls = true,
  onEnd,
  onProgress,
  poster,
}: AppVideoProps) {
  const resolvedUrl = useMemo(() => resolveFileUrl(source), [source]);

  const player = useVideoPlayer(resolvedUrl, (p) => {
    p.loop = loop;
    p.muted = muted;
    if (autoPlay && !paused) {
      p.play();
    }
  });

  useEffect(() => {
    if (!player) return;
    player.loop = loop;
  }, [player, loop]);

  useEffect(() => {
    if (!player) return;
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    if (!player) return;
    if (paused) {
      player.pause();
    } else if (autoPlay) {
      player.play();
    }
  }, [player, paused, autoPlay]);

  useEffect(() => {
    if (!player) return;
    if (onProgress) {
      player.timeUpdateEventInterval = 0.1;
    }
    const endSub = player.addListener("playToEnd", () => {
      onEnd?.();
    });
    const progressSub = onProgress
      ? player.addListener("timeUpdate", (payload) => {
          onProgress(payload.currentTime, player.duration);
        })
      : null;

    return () => {
      endSub.remove();
      progressSub?.remove();
    };
  }, [player, onEnd, onProgress]);

  if (!resolvedUrl) {
    if (poster) {
      return (
        <View style={[styles.container, style]}>
          <AppImage source={poster} style={StyleSheet.absoluteFill} contentFit={contentFit} />
        </View>
      );
    }
    return <View style={[styles.container, style]} />;
  }

  return (
    <View style={[styles.container, style]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        nativeControls={nativeControls}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000000",
  },
});

export default AppVideo;
