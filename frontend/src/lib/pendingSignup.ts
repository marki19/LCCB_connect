/**
 * The in-flight signup password, held between the register and verify screens.
 *
 * The backend keeps only a bcrypt hash of the password until the code is
 * verified, so the plaintext has to be re-submitted with the code. It stays in
 * memory for the length of the flow: never in route params, never on disk.
 */

let pending: { email: string; password: string } | null = null;

export function rememberPendingSignup(email: string, password: string): void {
  pending = { email: email.trim().toLowerCase(), password };
}

export function peekPendingSignup(email: string): string | null {
  if (!pending || pending.email !== email.trim().toLowerCase()) return null;
  return pending.password;
}

export function clearPendingSignup(): void {
  pending = null;
}
