# Implementation Plan: Admin MFA Step-Up & Session Re-Authentication

**Date:** 2026-11-13  
**Status:** In Progress  
**Goal:** Enable admins to re-authenticate with their MFA authenticator app when their 24-hour admin session expires without locking them out of the main app or forcing a full sign-out.

---

## 1. Problem Statement & Architecture

1. **MFA Challenge Error (`TypeError: mfaService.verifyTotpTimingSafe is not a function`):**
   - In `backend/services/mfaService.js`, `verifyTotpTimingSafe` was imported but missing from `module.exports`.
   - Calling `mfaService.verifyTotpTimingSafe` threw a 500 error during MFA login challenge.
   - **Fix:** Exported `verifyTotpTimingSafe` from `mfaService.js`.

2. **Admin Console Session Lockout:**
   - Admin sessions expire after 24 hours (`checkSessionAge`), returning `401 { code: "session_expired" }` on `/api/admin/*`.
   - General app routes (posts, messages, social, theses) remain valid for 7 days.
   - Currently, an expired admin session renders a broken Admin Console ("Signal lost: Session expired").
   - **Solution (Step-Up Re-Authentication):**
     - Add `POST /api/auth/mfa/step-up` to let an authenticated admin enter their 6-digit TOTP code to refresh their 24h admin session (`mfa_challenge` session event + `clearSessionAgeCache`).
     - Add `GET /api/auth/mfa/admin-session` to check if the admin session is currently active.
     - Add `AdminMfaPromptModal` in frontend.
     - Intercept clicks on "Admin Console" (left rail, account popover): if admin session is expired, prompt for MFA verification before entering.
     - In `frontend/app/(admin)/_layout.tsx`, if the session has expired, show an inline MFA unlock prompt with a "Back to App" escape hatch.

3. **Reanimated Web Warning Cleanup:**
   - Clean up shared value `.value` inline styling in `PostCard.tsx` and `post/[id].tsx` to silence the repetitive web warnings.

---

## 2. Verification Plan

1. **Backend Tests:**
   - Unit test for `POST /api/auth/mfa/step-up` (valid code elevates session; invalid code rejected; replay rejected; non-admin rejected).
   - Unit test for `GET /api/auth/mfa/admin-session`.
   - Run: `cd backend && node --require dotenv/config --test`
2. **Frontend Typecheck:**
   - Run: `cd frontend && npx tsc --noEmit`
3. **Live UX Flow:**
   - Admin clicks Admin Console -> if expired, MFA modal opens -> code submitted -> admin session refreshed -> console loads without full logout.

