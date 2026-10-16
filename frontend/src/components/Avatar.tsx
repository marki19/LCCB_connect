import { View, Text } from "react-native";
import type { PresenceMode } from "../types";

/**
 * Shared avatar + presence dot. `mode === null` means "not tracked" (offline or
 * invisible), so no dot renders.
 */

export const PRESENCE_COLORS: Record<PresenceMode, string> = {
  online: "#22C55E",
  away: "#F59E0B",
  busy: "#EF4444",
  dnd: "#EF4444",
  invisible: "#CBD5E1",
};

export const PRESENCE_LABELS: Record<PresenceMode, string> = {
  online: "Online",
  away: "Away",
  busy: "Busy",
  dnd: "Do not disturb",
  invisible: "Invisible",
};

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
  size?: number;
  mode?: PresenceMode | null;
  showPresence?: boolean;
};

export default function Avatar({ name, size = 48, mode = null, showPresence = false }: Props) {
  const dot = Math.round(size * 0.3);
  const ring = Math.max(2, Math.round(size * 0.06));
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#DBEAFE",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: Math.round(size * 0.36), fontWeight: "700", color: "#1E293B" }}>
          {initialsOf(name)}
        </Text>
      </View>
      {showPresence && mode ? (
        <View
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: PRESENCE_COLORS[mode] ?? "#CBD5E1",
            borderWidth: ring,
            borderColor: "#FFFFFF",
          }}
        />
      ) : null}
    </View>
  );
}
