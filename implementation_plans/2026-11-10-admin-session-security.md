# Admin Session Security — Implementation Plan

## Current State

| Component | Status |
|-----------|--------|
| `checkSessionAge` middleware | Defined in `mfaService.js:306`, exported from `auth.js:422` — **not mounted** |
| `requireAal2` middleware | Defined in `mfaService.js:285`, exported from `auth.js:421` — **not mounted** |
| Admin route mount (`/api/admin`) | Has `requireRole("admin", "superadmin")` only |
| Login MFA flow | Records `aal: "aal2"` when MFA challenged, `aal: "aal1"` otherwise — **working** |
| `session_events` table | Created in migration 019 — **working** |
| Admin session age limit | 8 hours (config in `mfaService.js:341-343`) |
| User session age limit | 7 days |

---

## Required Changes

### 1. Update Admin Session Age to 24 Hours

**File:** `backend/services/mfaService.js:341-343`

```javascript
// Change from 8 hours to 24 hours
const maxAgeMs = (role === "admin" || role === "superadmin")
  ? 24 * 60 * 60 * 1000  // 24 hours
  : 7 * 24 * 60 * 60 * 1000; // 7 days
```

### 2. Wire `checkSessionAge` + `requireAal2` into Admin Mount

**File:** `backend/app.js:215-230`

Current:
```javascript
app.use(
  "/api/admin",
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  auth.requireRole("admin", "superadmin"),
  adminRouter
);
app.use(
  "/api/admin",
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  auth.requireRole("admin", "superadmin"),
  adminCatalogRouter
);
```

**Change to:**
```javascript
// Admin API — require AAL2 + session age check
const adminMiddleware = [
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  auth.requireRole("admin", "superadmin"),
  auth.checkSessionAge,    // ← NEW: 24h admin / 7d user
  auth.requireAal2,        // ← NEW: enforce MFA for admin actions
];

app.use("/api/admin", ...adminMiddleware, adminRouter);
app.use("/api/admin", ...adminMiddleware, adminCatalogRouter);
```

### 3. Enforce MFA Enrollment for Admins at Login

**File:** `backend/controllers/authController.js` — `login` function (lines ~274-308)

Current logic:
```javascript
const hasMfa = await mfaService.hasVerifiedTotp(data.user.id);

if (hasMfa) {
  // Return challenge token
} else {
  // Return tokens directly (AAL1)
}
```

**Change:** After `hasMfa` check, if user is admin/superadmin AND no MFA enrolled → reject with `MFA_REQUIRED_ENROLLMENT` or force enrollment flow.

```javascript
const role = profile?.role?.toLowerCase().replace(/[-_]/g, "");
const isAdmin = role === "admin" || role === "superadmin";

if (isAdmin && !hasMfa) {
  return res.status(403).json({
    error: "Admin accounts require MFA. Please enroll in MFA first.",
    code: "mfa_required_enrollment",
    mfa_enrollment_required: true,
  });
}
```

### 4. Clear Session Age Cache on Logout

**File:** `backend/controllers/authController.js` — `logout` function

Add call to `auth.clearSessionAgeCache(userId)` after session revocation.

---

## Testing Checklist

| Test | Expected |
|------|----------|
| Admin logs in without MFA enrolled | 403 `mfa_required_enrollment` |
| Admin logs in with MFA enrolled | Returns challenge token → after TOTP verify, returns session with AAL2 |
| Admin accesses `/api/admin/*` with AAL1 token | 403 `mfa_required` |
| Admin accesses `/api/admin/*` with AAL2 token, session < 24h old | 200 OK |
| Admin accesses `/api/admin/*` with AAL2 token, session > 24h old | 401 `session_expired` |
| Regular user accesses `/api/admin/*` | 403 (from `requireRole`) |
| Regular user session > 7 days old | 401 `session_expired` (on any protected route if we add `checkSessionAge` globally) |
| Logout clears session age cache | Subsequent requests re-query `session_events` |

---

## Implementation Order

1. **Update session age** (`mfaService.js:341`) — 1 min
2. **Wire middleware in `app.js`** — 2 min
3. **Enforce MFA enrollment at login for admins** (`authController.js`) — 5 min
4. **Clear cache on logout** (`authController.js`) — 1 min
5. **Run tests** (`cd backend && npm test`) — verify 367+ pass
6. **Manual verification** — admin login, MFA, session expiry

---

## Files to Modify

| File | Lines | Change Type |
|------|-------|-------------|
| `backend/services/mfaService.js` | 341-343 | Patch: 8h → 24h |
| `backend/app.js` | 215-230 | Patch: add `checkSessionAge`, `requireAal2` to admin middleware chain |
| `backend/controllers/authController.js` | ~274-308 | Patch: reject admin login if no MFA enrolled |
| `backend/controllers/authController.js` | ~logout fn | Patch: call `clearSessionAgeCache` |

---

## Non-Goals

- Global `checkSessionAge` on all routes (would break unverified students, API clients)
- Forced MFA enrollment flow (admin must self-enroll via `/auth/mfa/enroll` first)
- Per-user config via Supabase dashboard (code-based is explicit and auditable)

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Lock out sole admin | Keep one admin session alive during deploy; test in staging first |
| `session_events` missing login row | `recordLogin` called on every successful login — already verified |
| Clock skew between servers | `session_events.created_at` is DB time; middleware uses `Date.now()` (server clock). Acceptable for 24h window. |
| MFA challenge token expiry (5 min) | Standard — user has 5 min to complete TOTP after first factor |

---

## Rollback Plan

If issues:
1. Revert `app.js` admin middleware to previous state
2. Revert `mfaService.js` age to 8h
3. Revert `authController.js` login check

All changes are additive and localized — no schema changes, no migration needed.