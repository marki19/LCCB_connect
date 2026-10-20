import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuth } from "./AuthContext";
import {
  getConnectionStatus,
  onPresence,
  onStatus,
  setPresenceMode as setTrackedPresenceMode,
  startRealtime,
  stopRealtime,
  type ConnectionStatus,
  type PresenceState,
} from "../lib/realtime";
import { heartbeat, setPresence } from "../lib/messages";
import { startOutbox } from "../lib/outbox";
import type { PresenceMode } from "../types";

/**
 * Presence (Messaging_plan.md §8). Owns the session-scoped Realtime client and
 * exposes the campus presence map + the caller's own mode.
 *
 *   * start/stop follows the auth session (never for guests);
 *   * `heartbeat` refreshes `profiles.last_seen_at` every 60 s while foregrounded;
 *   * backgrounding records a last-seen ping; foregrounding re-announces;
 *   * `setMode` updates the ephemeral Realtime presence and persists the choice.
 */

const HEARTBEAT_MS = 60_000;

type PresenceContextType = {
  mode: PresenceMode;
  setMode: (mode: PresenceMode) => Promise<void>;
  status: ConnectionStatus;
  presences: PresenceState;
  /** True when the user is connected and not `invisible`. */
  isOnline: (userId: string) => boolean;
  modeOf: (userId: string) => PresenceMode | null;
};

const PresenceContext = createContext<PresenceContextType>({
  mode: "online",
  setMode: async () => {},
  status: "disconnected",
  presences: {},
  isOnline: () => false,
  modeOf: () => null,
});

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { session, profile, isGuest } = useAuth();
  const userId = session?.user?.id ?? null;

  // A user-chosen mode overrides the persisted profile value once set. Deriving
  // `mode` (instead of copying it into state) means no effect has to sync it.
  const [modeOverride, setModeOverride] = useState<PresenceMode | null>(null);
  const profileMode = (profile?.presence_mode as PresenceMode | undefined) ?? "online";
  const mode = modeOverride ?? profileMode;

  const [status, setStatus] = useState<ConnectionStatus>(getConnectionStatus());
  const [presences, setPresences] = useState<PresenceState>({});

  // The AppState listener reads the mode outside render; keep the ref current.
  const modeRef = useRef<PresenceMode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Start/stop the Realtime client with the session.
  useEffect(() => {
    if (!userId || isGuest) {
      void stopRealtime();
      return;
    }
    void startRealtime(userId, { mode: modeRef.current });
    return () => {
      void stopRealtime();
    };
  }, [userId, isGuest]);

  // Apply mode changes (user choice or loaded profile) to the presence channel.
  useEffect(() => {
    if (!userId || isGuest) return;
    void setTrackedPresenceMode(mode);
  }, [userId, isGuest, mode]);

  // Bridge the module emitter into React state.
  useEffect(() => {
    // The offline outbox replays queued sends whenever Realtime (re)connects.
    startOutbox();
    const offPresence = onPresence((state) => setPresences(state));
    const offStatus = onStatus((next) => {
      setStatus(next);
      if (next === "disconnected") setPresences({});
    });
    return () => {
      offPresence();
      offStatus();
    };
  }, []);

  // Foreground heartbeat keeps `last_seen_at` fresh (plan §8: 60 s cadence).
  useEffect(() => {
    if (!userId || isGuest) return;
    const ping = () => {
      void heartbeat({}).catch(() => undefined);
    };
    ping();
    const timer = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [userId, isGuest]);

  // Background → record last-seen; foreground → re-announce + ping.
  useEffect(() => {
    if (!userId || isGuest) return;
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") {
        void setTrackedPresenceMode(modeRef.current);
        void heartbeat({ mode: modeRef.current }).catch(() => undefined);
      } else if (next === "background") {
        void heartbeat({}).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [userId, isGuest]);

  const setMode = useCallback(async (next: PresenceMode) => {
    setModeOverride(next);
    modeRef.current = next;
    try {
      await setPresence(next);
    } catch {
      // Persisting is best-effort; the derived mode above already applied live.
    }
  }, []);

  const isOnline = useCallback((id: string) => Boolean(presences[id]?.length), [presences]);
  const modeOf = useCallback((id: string) => presences[id]?.[0]?.mode ?? null, [presences]);

  const value = useMemo(
    () => ({ mode, setMode, status, presences, isOnline, modeOf }),
    [mode, setMode, status, presences, isOnline, modeOf]
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export const usePresence = () => useContext(PresenceContext);
