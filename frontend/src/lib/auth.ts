import { supabase } from "./supabase";
import { apiJson, ApiError } from "./api";

type SessionTokens = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

/**
 * Installs a session issued by the backend.
 *
 * Every sign-in goes through `POST /api/auth/login` now, because the API owns
 * one check the client cannot make: an Auth account whose `profiles` row is
 * gone has been deleted and must not receive a session. The server's 403
 * carries the user-facing explanation, so callers can show `err.message`.
 */
async function installSession(tokens: SessionTokens): Promise<void> {
  const { error } = await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
  if (error) throw new ApiError(error.message, 401);
}

/**
 * Signs in with either an email address or a student ID (plan §5 Phase 3).
 *
 * The student ID is resolved server-side so the ID→email mapping never reaches
 * the client. Wrong password, unknown ID, and a deleted account all produce the
 * same generic 401, except deletion which is explicitly reported.
 */
export async function signInWithIdentifier(
  identifier: string,
  password: string
): Promise<void> {
  const trimmed = identifier.trim();
  const normalized = trimmed.includes("@")
    ? trimmed.toLowerCase()
    : trimmed.toUpperCase();

  const tokens = await apiJson<SessionTokens>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier: normalized, password }),
  });

  await installSession(tokens);
}

/**
 * Exchanges the 6-digit signup code for a session.
 *
 * The backend verifies the OTP and creates the profile in the same call, so a
 * user can never hold a session without a profile row.
 */
export async function verifySignupCode(
  email: string,
  token: string
): Promise<void> {
  const tokens = await apiJson<SessionTokens>("/auth/verify-signup", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), token }),
  });

  await installSession(tokens);
}

/**
 * Resends the 6-digit signup OTP via the backend.
 * Backend rate limits: 3 requests per 10 minutes per email.
 */
export async function resendSignupCode(email: string): Promise<{ retry_after: number }> {
  return apiJson("/auth/resend-signup", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}

/**
 * Requests signup: creates Auth user and sends OTP email.
 * Backend-owned: never exposes anon key to client.
 */
export async function requestSignup(email: string, password: string, fullName: string): Promise<void> {
  await apiJson("/auth/request-signup", {
    method: "POST",
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      full_name: fullName.trim(),
    }),
  });
}
