import {
  clearSession,
  getRefreshToken,
  getAccessToken,
} from "./session";
import { apiJson } from "./api";
import { supabase } from "./supabase";
import {
  refreshSession,
  installSession,
  type SessionTokens,
} from "./sessionRefresh";

export { refreshSession, installSession, type SessionTokens };

/**
 * Revokes refresh tokens on the server and clears client storage.
 */
export async function logout(): Promise<void> {
  try {
    const refreshToken = await getRefreshToken();
    const token = await getAccessToken();
    const API_URL = (
      process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api"
    ).replace(/\/+$/, "");

    await Promise.allSettled([
      fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }),
      supabase.auth.signOut(),
    ]);
  } finally {
    await clearSession();
  }
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
 * Signs in with Google using an ID token (native/GIS) or Supabase access token (web OAuth).
 */
export async function signInWithGoogle(
  idToken?: string,
  accessToken?: string
): Promise<SessionTokens | MfaChallengeResponse | MfaEnrollmentRequiredResponse> {
  const body: { id_token?: string; access_token?: string } = {};
  if (idToken) body.id_token = idToken;
  if (accessToken) body.access_token = accessToken;

  const response = await apiJson<SessionTokens | MfaChallengeResponse | MfaEnrollmentRequiredResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if ("mfa_required" in response && response.mfa_required === true) {
    return response;
  }

  if ("mfa_enrollment_required" in response && response.mfa_enrollment_required === true) {
    return response;
  }

  await installSession(response as SessionTokens);
  return response as SessionTokens;
}

/**
 * Response from signInWithIdentifier when MFA is required.
 */
export type MfaChallengeResponse = {
  mfa_required: true;
  challenge_token: string;
  message?: string;
};

/**
 * Response from signInWithIdentifier when admin MFA enrollment is required.
 */
export type MfaEnrollmentRequiredResponse = {
  mfa_enrollment_required: true;
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  message?: string;
};

export type MfaFactor = {
  id: string;
  type?: string;
  factor_type?: string;
  status: "verified" | "unverified";
  created_at: string;
  verified_at: string | null;
};

export type MfaEnrollResult = {
  factor_id: string;
  secret: string;
  uri: string;
  qr_code_url: string;
};

/**
 * Signs in with either an email address or a student ID.
 * Returns MfaChallengeResponse if MFA is required, MfaEnrollmentRequiredResponse
 * if admin MFA setup is required, otherwise installs session and returns void.
 */
export async function signInWithIdentifier(
  identifier: string,
  password: string
): Promise<void | MfaChallengeResponse | MfaEnrollmentRequiredResponse> {
  const trimmed = identifier.trim();
  const normalized = trimmed.includes("@")
    ? trimmed.toLowerCase()
    : trimmed;

  const response = await apiJson<SessionTokens | MfaChallengeResponse | MfaEnrollmentRequiredResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier: normalized, password }),
  });

  if ("mfa_required" in response && response.mfa_required === true) {
    return response;
  }

  if ("mfa_enrollment_required" in response && response.mfa_enrollment_required === true) {
    // Return to caller so the UI can prompt MFA enrollment modal BEFORE establishing session
    return response;
  }

  await installSession(response as SessionTokens);
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

/**
 * Initiates TOTP MFA enrollment.
 * Returns the secret, otpauth URI, and QR code data URL.
 * Accepts an optional tempToken when called during the login onboarding flow.
 */
export async function enrollMfa(tempToken?: string): Promise<MfaEnrollResult> {
  return apiJson<MfaEnrollResult>("/auth/mfa/enroll", {
    method: "POST",
    headers: tempToken ? { Authorization: `Bearer ${tempToken}` } : undefined,
  });
}

/**
 * Verifies initial TOTP code and activates the factor.
 * Accepts an optional tempToken when called during the login onboarding flow.
 */
export async function verifyMfaEnrollment(
  factorId: string,
  code: string,
  tempToken?: string
): Promise<{ message: string; factor_id: string; verified_at: string; session?: SessionTokens }> {
  const result = await apiJson<{ message: string; factor_id: string; verified_at: string; session?: SessionTokens }>(
    "/auth/mfa/enroll/verify",
    {
      method: "POST",
      headers: tempToken ? { Authorization: `Bearer ${tempToken}` } : undefined,
      body: JSON.stringify({ factor_id: factorId, code }),
    }
  );
  if (result?.session) {
    await installSession(result.session);
  }
  return result;
}

/**
 * Unenrolls an active TOTP factor.
 */
export async function unenrollMfa(
  factorId: string,
  code: string
): Promise<{ message: string }> {
  return apiJson<{ message: string }>("/auth/mfa/unenroll", {
    method: "POST",
    body: JSON.stringify({ factor_id: factorId, code }),
  });
}

/**
 * Lists enrolled MFA factors for the current user.
 */
export async function listMfaFactors(): Promise<MfaFactor[]> {
  return apiJson<MfaFactor[]>("/auth/mfa/list");
}
