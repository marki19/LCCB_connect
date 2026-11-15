# Concurrent Session Cap — Implementation Plan

> **Goal**: Limit the maximum number of concurrent active sessions per user account. When a user exceeds the cap upon logging in, the oldest sessions are terminated (FIFO eviction) and audited, preventing credential sharing and unbounded stale sessions.

## Status: Planned

---

## Architecture & Requirements

1. **Configurable Session Cap**:
   - `MAX_CONCURRENT_SESSIONS`: Environment variable defaulting to `5`.
   - Role-aware or global: Defaults to `5` for standard users, optionally tighter (`2` or `3`) for admins/superadmins.

2. **Session Eviction Mechanics (FIFO)**:
   - Evaluated on successful login/sign-in (password, OTP signup, Google OAuth, and verified MFA challenge).
   - Queries active sessions for `user_id` in `auth.sessions` ordered by `created_at DESC`.
   - If count > `MAX_CONCURRENT_SESSIONS`:
     - Selects oldest sessions (`OFFSET $maxSessions`).
     - Removes them from `auth.sessions` and deletes corresponding tokens from `auth.refresh_tokens`.
     - Records an audit event (`event_type: 'force_signout'`) in `public.session_events` with metadata `{ reason: 'session_cap_exceeded' }`.

3. **Separation of Concerns**:
   - Implemented in `backend/services/accountService.js` as `enforceSessionCap(userId, options)`.
   - Called from `backend/controllers/authController.js` after session issuance.

---

## Tasks

### Task 1: Add `enforceSessionCap` in `backend/services/accountService.js` (~15 min)

**File**: `backend/services/accountService.js`

- Implement `enforceSessionCap(userId, { maxSessions, role } = {})`:
  - Resolves `cap` from `MAX_CONCURRENT_SESSIONS` (fallback `5`; for `admin`/`superadmin`, fallback `3`).
  - Queries `auth.sessions WHERE user_id = $1::uuid ORDER BY created_at DESC`.
  - If count > cap:
    - Identifies IDs of excess oldest sessions.
    - Deletes from `auth.sessions` and `auth.refresh_tokens`.
    - Logs count of evicted sessions.
    - Records audit record in `session_events`.
  - Returns `{ evictedCount, evictedSessionIds }`.

---

### Task 2: Wire into `authController.js` (~10 min)

**File**: `backend/controllers/authController.js`

- Call `await accountService.enforceSessionCap(user.id, { role: profile?.role })` in:
  1. `login` (standard direct session flow)
  2. `mfaChallenge` (post-MFA completion flow)
  3. `verifySignupOtp` (post-signup session flow)
  4. `googleSignIn` (OAuth session flow)

---

### Task 3: Unit & Integration Tests (~15 min)

**File**: `backend/tests/session-cap.test.js` (new)

- Tests:
  1. Leaves sessions untouched when active count <= cap.
  2. Evicts the oldest session when count exceeds cap by 1.
  3. Evicts multiple oldest sessions when count exceeds cap by N.
  4. Applies stricter cap for admin/superadmin roles.
  5. Cleans up corresponding `auth.refresh_tokens` for evicted sessions.
  6. Handles missing or mock DB safely without throwing.

---

## Files Changed Summary

| File | Action | Lines |
|------|--------|-------|
| `backend/services/accountService.js` | Edit | ~45 |
| `backend/controllers/authController.js` | Edit | ~15 |
| `backend/tests/session-cap.test.js` | **New** | ~60 |

**Total**: ~105 lines of code, ~15 lines edited. Zero new dependencies, zero migrations.

