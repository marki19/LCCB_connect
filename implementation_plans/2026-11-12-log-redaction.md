# Log Redaction — Implementation Plan

> **Goal**: Prevent sensitive credentials, tokens, query-string secrets, and PII from leaking into backend logs, error dumps, and console output.

## Status: Planned

---

## Architecture & Threat Vectors

1. **Query Strings in Request Logs**:
   - `req.originalUrl` logged in `app.js` can contain `?token=...`, `?code=...`, `?key=...`.
   - **Fix**: Scrub sensitive query parameters with `sanitizeUrl(url)`.

2. **Unhandled Error Dumps**:
   - `err` passed to `console.error("[api][...]", err)` in `app.js` can include database queries with parameters, Axios/Supabase request configs with `Authorization` headers, or request bodies.
   - **Fix**: Redact error stacks, nested config objects, and headers before logging.

3. **Global Console Redaction Filter**:
   - Provide `backend/utils/redact.js` with deep object redaction + string regex scrubbing.
   - Install a transparent hook on `console.log`, `console.warn`, `console.error` in production/staging (or enabled globally) so any accidental `console.log(user)` or `console.error(err)` across all 140+ log sites is automatically sanitized.

4. **Sensitive Key Denylist**:
   - `password`, `newPassword`, `currentPassword`, `confirmPassword`
   - `secret`, `totpSecret`, `otp`, `otp_code`, `code`
   - `token`, `access_token`, `refresh_token`, `temp_token`, `challenge_token`
   - `authorization`, `cookie`, `apiKey`, `service_role_key`

5. **Regex Pattern Redactors**:
   - JWT tokens: `eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}` -> `[REDACTED_JWT]`
   - Bearer headers: `Bearer\s+[A-Za-z0-9._~+/-]+=*` -> `Bearer [REDACTED]`
   - URL query tokens: `([?&](?:token|code|secret|password|access_token)=)[^&]*` -> `$1[REDACTED]`

---

## Tasks

### Task 1: Create `backend/utils/redact.js` (~15 min)

**File**: `backend/utils/redact.js` (new)

- `redact(value, seen = new WeakSet())`: Deeply traverses objects, arrays, and Error instances, masking sensitive keys and string patterns.
- `sanitizeUrl(url)`: Replaces sensitive query parameter values with `[REDACTED]`.
- `installConsoleRedactor()`: Wraps `console.log`, `console.warn`, `console.error` with `redact()` so all output is automatically sanitized.

---

### Task 2: Install Redactor in `backend/app.js` & Sanitize Request Logging (~10 min)

**File**: `backend/app.js`

1. Call `installConsoleRedactor()` at startup.
2. In the request logger (`app.use(...)`):
   - Replace `req.originalUrl` with `sanitizeUrl(req.originalUrl)`.
3. In the centralized error handler:
   - Ensure `err` is sanitized before `console.error`.

---

### Task 3: Audit & Guard Specific High-Risk Log Sites (~10 min)

**Files**:
- `backend/services/emailService.js`: Ensure `[DEV EMAIL]` OTP printing is disabled in production (`NODE_ENV === "production"`).
- `backend/controllers/emailWebhookController.js`: Sanitize any webhook payload error logging.
- `backend/controllers/authController.js`: Verify no raw password or secret is passed to `console.error`.

---

### Task 4: Write Unit Tests (~10 min)

**File**: `backend/tests/redact.test.js` (new)

- Tests:
  1. Redacts sensitive object keys (`password`, `token`, `secret`, `authorization`, etc.).
  2. Redacts JWT strings and Bearer tokens inside raw text and errors.
  3. Redacts sensitive URL query parameters (`?token=xyz` -> `?token=[REDACTED]`).
  4. Handles circular references safely without throwing.
  5. Preserves non-sensitive data and standard error structures.

---

## Files Changed Summary

| File | Action | Lines |
|------|--------|-------|
| `backend/utils/redact.js` | **New** | ~75 |
| `backend/app.js` | Edit | ~10 |
| `backend/services/emailService.js` | Edit | ~5 |
| `backend/tests/redact.test.js` | **New** | ~50 |

---

## Estimated Time: 40-45 minutes

