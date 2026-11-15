import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export type SessionUser = {
  id: string;
  email?: string | null;
  role?: string | null;
  full_name?: string | null;
  username?: string | null;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
  aal?: string;
};

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at?: number; // Unix timestamp in seconds
  user?: SessionUser;
};

const STORAGE_KEY = "lccb_auth_session";

let memorySession: Session | null = null;
let initialized = false;
const listeners = new Set<(session: Session | null) => void>();

async function readFromPlatformStorage(): Promise<Session | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Session) : null;
      }
      return null;
    }

    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch (err) {
    console.warn("[session] Failed to read session from storage:", err);
    return null;
  }
}

async function writeToPlatformStorage(session: Session): Promise<void> {
  try {
    const raw = JSON.stringify(session);
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, raw);
      }
      return;
    }

    await SecureStore.setItemAsync(STORAGE_KEY, raw);
  } catch (err) {
    console.warn("[session] Failed to write session to storage:", err);
  }
}

async function removeFromPlatformStorage(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      return;
    }

    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch (err) {
    console.warn("[session] Failed to clear session from storage:", err);
  }
}

function notifyListeners(session: Session | null) {
  for (const listener of listeners) {
    try {
      listener(session);
    } catch (err) {
      console.error("[session] Error in session listener:", err);
    }
  }
}

/**
 * Returns the currently active session, loading from persistent storage if not yet cached.
 */
export async function getSession(): Promise<Session | null> {
  if (!initialized) {
    memorySession = await readFromPlatformStorage();
    initialized = true;
  }
  return memorySession;
}

/**
 * Saves and activates a new session in both memory and persistent storage.
 */
export async function setSession(session: Session): Promise<void> {
  memorySession = session;
  initialized = true;
  await writeToPlatformStorage(session);
  notifyListeners(memorySession);
}

/**
 * Clears the active session from memory and persistent storage.
 */
export async function clearSession(): Promise<void> {
  memorySession = null;
  initialized = true;
  await removeFromPlatformStorage();
  notifyListeners(null);
}

/**
 * Subscribes to session changes. Returns an unsubscribe function.
 */
export function subscribe(listener: (session: Session | null) => void): () => void {
  listeners.add(listener);
  // Emit current state immediately if already initialized
  if (initialized) {
    listener(memorySession);
  } else {
    getSession().then((s) => listener(s)).catch(() => {});
  }
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Checks whether a session's access token is expired or within the expiry buffer (default 30s).
 */
export function isExpired(session: Session | null, bufferSeconds = 30): boolean {
  if (!session || !session.access_token) return true;
  if (!session.expires_at) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return session.expires_at <= nowSec + bufferSeconds;
}

/**
 * Returns the active access token, if any.
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token || null;
}

/**
 * Returns the active refresh token, if any.
 */
export async function getRefreshToken(): Promise<string | null> {
  const session = await getSession();
  return session?.refresh_token || null;
}

/**
 * For test resets only.
 */
export function _resetMemorySessionForTesting(s: Session | null = null): void {
  memorySession = s;
  initialized = true;
  notifyListeners(s);
}
