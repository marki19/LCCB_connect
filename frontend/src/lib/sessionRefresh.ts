import {
  setSession,
  clearSession,
  getRefreshToken,
  type SessionUser,
} from "./session";
import { ApiError } from "./errors";

export type SessionTokens = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user?: SessionUser;
};

/**
 * Installs a session issued by the backend.
 *
 * Every sign-in goes through `POST /api/auth/login` now, because the API owns
 * one check the client cannot make: an Auth account whose `profiles` row is
 * gone has been deleted and must not receive a session. The server's 403
 * carries the user-facing explanation, so callers can show `err.message`.
 */
export async function installSession(tokens: SessionTokens): Promise<void> {
  if (!tokens || !tokens.access_token) {
    throw new ApiError("Invalid session payload", 401);
  }
  await setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at,
    user: tokens.user,
  });
}

let refreshPromise: Promise<string> | null = null;

/**
 * Proactively or reactively refreshes the access token using the stored refresh token.
 * Deduplicates concurrent refresh attempts so multiple 401s don't race.
 */
export async function refreshSession(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        await clearSession();
        throw new ApiError("No refresh token available", 401);
      }

      const API_URL = (
        process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api"
      ).replace(/\/+$/, "");

      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        await clearSession();
        let message = "Session expired";
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {}
        throw new ApiError(message, res.status);
      }

      const tokens = (await res.json()) as SessionTokens;
      await installSession(tokens);
      return tokens.access_token;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
