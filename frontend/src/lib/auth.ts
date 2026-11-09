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
 * Exchanges the 6-digit signup code for a session.
 *
 * The backend verifies the OTP and creates the profile in the same call, so a
 * user can never hold a session without a profile row. The password is sent
 * again because only its bcrypt hash was kept while the code was pending.
 */
export async function verifySignupCode(
  email: string,
  token: string,
  password: string
): Promise<void> {
  const tokens = await apiJson<SessionTokens>("/auth/verify-signup", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), token, password }),
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

/**
 * Signs in with Google using an ID token.
 * Requires @react-native-google-signin/google-signin (dev build only).
 */
export async function signInWithGoogle(idToken: string): Promise<void> {
  const tokens = await apiJson<SessionTokens>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  });

  await installSession(tokens);
}

/**
 * Response from signInWithIdentifier when MFA is required.
 */
export type MfaChallengeResponse = {
  mfa_required: true;
  challenge_token: string;
  message: string;
};

/**
 * Signs in with either an email address or a student ID.
 * Returns MfaChallengeResponse if MFA is required, otherwise installs session and returns void.
 */
export async function signInWithIdentifier(
  identifier: string,
  password: string
): Promise<void | MfaChallengeResponse> {
  const trimmed = identifier.trim();
  const normalized = trimmed.includes("@")
    ? trimmed.toLowerCase()
    : trimmed;

  const response = await apiJson<SessionTokens | MfaChallengeResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier: normalized, password }),
  });

  // Type guard to check if response is MfaChallengeResponse
  const isMfaChallenge = (res: SessionTokens | MfaChallengeResponse): res is MfaChallengeResponse => {
    return "mfa_required" in res && res.mfa_required === true;
  };

  if (isMfaChallenge(response)) {
    return response;
  }

  await installSession(response);
}

/**
 * Completes MFA challenge during login.
 * Returns void on success (session installed), throws on failure.
 */
export async function completeMfaChallenge(
  challengeToken: string,
  code: string
): Promise<void> {
  const tokens = await apiJson<SessionTokens>("/auth/mfa/challenge", {
    method: "POST",
    body: JSON.stringify({ challenge_token: challengeToken, code }),
  });

  await installSession(tokens);
}
