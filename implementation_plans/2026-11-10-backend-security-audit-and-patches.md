# Backend Security Audit & Patch Plan

## 1. Security Score: 7.5 / 10

| Category | Score | Assessment |
|----------|-------|------------|
| Injection & Query Safety | 10 / 10 | 100% parameterized SQL, zero raw interpolation |
| Authorization & Access Control (IDOR) | 9 / 10 | Strong RLS, ownership in WHERE clauses, strict role hierarchy |
| Cryptography & Secrets | 9 / 10 | Bcrypt-12, HMAC-hashed OTPs, timing-safe TOTP comparisons |
| Input Validation & Sanitization | 9 / 10 | Strict Zod schemas, URL validation, magic-byte PDF checks |
| Admin MFA & Session Architecture | 4 / 10 | Two critical breaking flaws: Lockout Catch-22 & JWT claim disconnect |

---

## 2. Key Findings

### Critical Finding 1: Admin MFA Lockout Catch-22 (High / Breaking)
- **Location:** `backend/controllers/authController.js:278-286`
- **Cause:** When an admin logs in without MFA enrolled, `login()` returns `403 { code: "mfa_required_enrollment" }` without a session token.
- **Problem:** All MFA enrollment endpoints (`POST /api/auth/mfa/enroll`, `POST /api/auth/mfa/enroll/verify`) require `requireAuth`. Without a token, the admin cannot enroll and is permanently locked out.
- **Fix:** Issue a scoped temporary session token or allow AAL1 login with `mfa_enrollment_required: true` so the admin can access `/api/auth/mfa/enroll` while keeping `/api/admin/*` locked.

### Critical Finding 2: JWT `aal` Disconnect in Custom MFA (High / Breaking)
- **Location:** `backend/services/mfaService.js:269-279` (`getAalFromToken`) & `backend/middleware/auth.js:299-312` (`requireAal2`)
- **Cause:** `getAalFromToken` reads `payload.aal` from Supabase's JWT. Because MFA is handled via custom PostgreSQL tables rather than Supabase's native MFA API, Supabase's JWT always has `aal: "aal1"`.
- **Problem:** Even after an admin completes the TOTP challenge, `requireAal2` rejects all admin requests with `403 mfa_required`.
- **Fix:** Check MFA verification status against `session_events` or user MFA record, or issue an elevated token/session state.

### High Finding 3: Session Age Tracking Misses MFA Logins
- **Location:** `backend/services/mfaService.js:382-385` & `checkSessionAge:329-335`
- **Cause:** `recordLogin` records `event_type: "mfa_challenge"`, but `checkSessionAge` queries `event_type = 'login'`.
- **Problem:** `checkSessionAge` finds zero login events for MFA users and defaults to `valid = true`, bypassing the 24-hour expiration.
- **Fix:** In `mfaChallenge`, record a successful `login` event with `aal: "aal2"`.

### Medium Finding 4: Untested Admin Security Middleware
- **Location:** `backend/tests/admin.test.js`, `catalog.test.js`, `directory.test.js`, `login-security.test.js`
- **Cause:** `checkSessionAge` and `requireAal2` were stubbed out in all tests to pass without testing.
- **Fix:** Add targeted unit tests for `requireAal2` and `checkSessionAge`.

---

## 3. Patch Plan (Phased)

### Phase 1: Fix Admin MFA Login & Enrollment Flow (Est: 15 min)
1. Allow admin without MFA to receive an initial session with `mfa_enrollment_required: true` to call `/api/auth/mfa/enroll`.
2. Keep `/api/admin/*` blocked until MFA is verified.

### Phase 2: Align AAL2 Verification with Custom MFA (Est: 20 min)
1. Update `requireAal2` to verify that the user's active session in `session_events` has `aal: 'aal2'`, or verify active verified TOTP factor.
2. In `mfaChallenge`, record `event_type: 'login'` with `aal: 'aal2'` upon successful TOTP verification.

### Phase 3: Fix Session Age Verification (Est: 10 min)
1. Ensure `checkSessionAge` queries the latest `login` event recorded by `mfaChallenge`.
2. Clear session age cache on logout.

### Phase 4: Unit Test Coverage for Security Middleware (Est: 15 min)
1. Test `requireAal2` with AAL1 vs AAL2 sessions.
2. Test `checkSessionAge` with expired vs fresh sessions.
3. Verify admin login without MFA can enroll and then access admin routes.

