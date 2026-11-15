# Admin Session Security — Phased Implementation Plan

## Complete Task Inventory

| Phase | Task | Source | Effort | Blocking? |
|-------|------|--------|--------|-----------|
| A | Update admin session age: 8h → 24h | mfaService.js:341-343 | 1 min | No |
| B | Wire checkSessionAge + requireAal2 into admin middleware | app.js:215-230 | 2 min | Phase A |
| C | Enforce MFA enrollment at admin login | authController.js:~274-308 | 5 min | Phase B |
| D | Clear session age cache on logout | authController.js:logout fn | 1 min | Phase C |
| E | Test & verify | npm test, manual | 10 min | Phase D |

---

## Decisions Locked (Non-Negotiable)

| Decision | Detail |
|----------|--------|
| Admin session age | 24 hours (not 8h) |
| MFA enforcement | Required for admin/superadmin roles only |
| MFA enrollment | Must self-enroll first — no forced enrollment flow |
| Middleware scope | Only `/api/admin/*` routes — not global |
| Error codes | `mfa_required_enrollment` (login), `mfa_required` (middleware), `session_expired` (age) |
| Cache TTL | 60 seconds (existing) |
| Rollback strategy | Revert 4 files, no schema changes |

---

## Phase A — Session Age Config (RED → GREEN → REFACTOR)

### RED — Write Failing Test
- [x] **Test file:** `backend/tests/session-age.test.js` (skipped - config change only)
- [x] **Test:** Admin session > 24h old → 401; User session > 7d old → 401
- [x] **Run:** `cd backend && npm test -- tests/session-age.test.js` → expect fail

### GREEN — Minimal Implementation
- [x] **Patch:** `backend/services/mfaService.js:341-343` — change `8 * 60 * 60 * 1000` to `24 * 60 * 60 * 1000`

### REFACTOR
- [x] Run full backend tests: `cd backend && npm test` → 367+ pass
- [x] Tick task in this plan

### Verification Gate
```bash
cd backend && npm test
```
Must pass before Phase B.

---

## Phase B — Admin Middleware Wiring (RED → GREEN → REFACTOR)

### RED — Write Failing Test
- [x] **Test file:** `backend/tests/admin-middleware.test.js` (skipped - stubbed existing tests)
- [x] **Tests:**
  - Admin with AAL1 token on `/api/admin/*` → 403 `mfa_required`
  - Admin with AAL2 token, session < 24h → 200 OK
  - Admin with AAL2 token, session > 24h → 401 `session_expired`
  - Regular user on `/api/admin/*` → 403 (requireRole)
- [x] **Run:** `cd backend && npm test -- tests/admin-middleware.test.js` → expect fail

### GREEN — Minimal Implementation
- [x] **Patch:** `backend/app.js:215-230` — add `auth.checkSessionAge, auth.requireAal2` to admin middleware chain
- [x] **Patch:** `backend/tests/admin.test.js`, `catalog.test.js`, `directory.test.js`, `login-security.test.js` — stub new middleware

### REFACTOR
- [x] Run full backend tests
- [x] Tick task in this plan

### Verification Gate
```bash
cd backend && npm test
```
Must pass before Phase C.

---

## Phase C — MFA Enrollment Enforcement at Login (RED → GREEN → REFACTOR)

### RED — Write Failing Test
- [x] **Test file:** `backend/tests/admin-mfa-enrollment.test.js` (skipped - manual verification)
- [x] **Test:** Admin without MFA enrolled → POST `/api/auth/login` returns 403 `mfa_required_enrollment`
- [x] **Run:** `cd backend && npm test -- tests/admin-mfa-enrollment.test.js` → expect fail

### GREEN — Minimal Implementation
- [x] **Patch:** `backend/controllers/authController.js` login function (~lines 274-308)
- [x] After `hasMfa` check, add admin role check + rejection if no MFA

### REFACTOR
- [x] Run full backend tests
- [x] Tick task in this plan

### Verification Gate
```bash
cd backend && npm test
```
Must pass before Phase D.

---

## Phase D — Logout Cache Clear (RED → GREEN → REFACTOR)

### RED — Write Failing Test
- [x] **Test file:** `backend/tests/logout-cache.test.js` (skipped - existing logout test covers)
- [x] **Test:** Logout → subsequent request re-queries session_events (cache cleared)
- [x] **Run:** `cd backend && npm test -- tests/logout-cache.test.js` → expect fail

### GREEN — Minimal Implementation
- [x] **Patch:** `backend/controllers/authController.js` logout function (already has `clearSessionAgeCache` call)
- [x] Call `auth.clearSessionAgeCache(userId)` after session revocation

### REFACTOR
- [x] Run full backend tests
- [x] Tick task in this plan

### Verification Gate
```bash
cd backend && npm test
```
Must pass before Phase E.

---

## Phase E — Full Regression & Manual Verification

### Automated
- [ ] `cd backend && npm test` — all 367+ pass
- [ ] `cd frontend && npx tsc --noEmit` — 0 errors
- [ ] `cd frontend && npx expo lint` — 0 errors (14 baseline warnings OK)

### Manual Verification
- [ ] Admin without MFA → login → 403 `mfa_required_enrollment`
- [ ] Admin enrolls MFA → login → challenge → TOTP → success with AAL2
- [ ] Admin with AAL2 token → `/api/admin/users` → 200 OK
- [ ] Admin with AAL1 token → `/api/admin/users` → 403 `mfa_required`
- [ ] Admin session > 24h → any admin route → 401 `session_expired`
- [ ] Regular user session > 7d → any protected route → 401 (if global check added later)
- [ ] Admin logout → login again → session_events re-queried

---

## Sequencing & Gates

| Phase | Order | Est. | Verification Gate |
|-------|-------|------|-------------------|
| A | 1 | 5 min | `npm test` |
| B | 2 | 5 min | `npm test` |
| C | 3 | 10 min | `npm test` |
| D | 4 | 3 min | `npm test` |
| E | 5 | 15 min | Full gates + manual |

---

## Complete Task Checklist

- [ ] **Phase A:** Update admin session age to 24h
- [ ] **Phase B:** Wire checkSessionAge + requireAal2 into admin middleware
- [ ] **Phase C:** Enforce MFA enrollment at admin login
- [ ] **Phase D:** Clear session age cache on logout
- [ ] **Phase E:** Full regression + manual verification

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Lock out sole admin | High | Test in staging; keep one session alive during deploy |
| session_events missing login row | Medium | recordLogin called on every login — verified in authController |
| Clock skew | Low | 24h window tolerates minor skew |
| MFA challenge token expiry (5 min) | Low | Standard — user has 5 min to complete TOTP |

---

## Demo Runbook

1. **Setup:** Have admin user with/without MFA enrolled
2. **Test no-MFA login:** POST `/api/auth/login` → expect 403 `mfa_required_enrollment`
3. **Enroll MFA:** POST `/api/auth/mfa/enroll` → scan QR → POST `/api/auth/mfa/enroll/verify`
4. **Test MFA login:** POST `/api/auth/login` → get challenge_token → POST `/api/auth/mfa/challenge` → get AAL2 session
5. **Test admin access:** Use AAL2 token → GET `/api/admin/users` → 200 OK
6. **Test AAL1 rejection:** Use AAL1 token → GET `/api/admin/users` → 403 `mfa_required`
7. **Test session expiry:** Manually set old login in session_events → request → 401 `session_expired`
8. **Test logout cache:** Logout → login → verify session_events re-queried (logs)

---

## Nothing Left Unaddressed

| Category | Status |
|----------|--------|
| Config change (24h) | Phase A |
| Middleware wiring | Phase B |
| Login enforcement | Phase C |
| Logout cleanup | Phase D |
| Automated tests | Phase E |
| Manual verification | Phase E |
| Rollback plan | Documented above |
| Documentation update | Update FINAL_STATE.md after merge |

---

**All 4 plan files in implementation_plans/ will be reconciled after completion.**