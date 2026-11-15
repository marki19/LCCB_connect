# Implementation Plan: Group 4 — Lifecycle and Hygiene

**Date:** 2026-11-13  
**Status:** Ready to execute  
**Goal:** Implement clean process lifecycle management, error log hygiene, test artifact pruning, and memory bounding.

---

## 1. Scope & Items

1. **Graceful Shutdown (`backend/index.js`):**
   - Intercept `SIGTERM` and `SIGINT`.
   - Stop accepting new HTTP connections via `server.close()`.
   - Drain database connection pool via `pool.end()`.
   - 10-second unref'd timeout to force exit if cleanup hangs.
2. **Unhandled Exceptions & Rejections (`backend/index.js`):**
   - Attach listeners for `uncaughtException` and `unhandledRejection`.
   - Log errors safely with `redact()`.
   - Exit non-zero (`process.exit(1)`) so process managers (PM2, Docker, Kubernetes) restart cleanly.
3. **Gate Frontend Error Logging on `__DEV__` (`frontend/src/lib/errorCapture.ts`):**
   - Wrap `console.log('[Error captured]', fullError)` in `if (__DEV__)`.
4. **Untrack Stale Test Artifact & Update `.gitignore`:**
   - Remove `frontend/.vitest/json/output.json` from git index (`git rm --cached`).
   - Add `.vitest/` and `*/.vitest/` to `.gitignore`.
5. **Bound In-Memory Session Cache (`backend/services/mfaService.js`):**
   - Bound `checkSessionAge.cache` to prevent indefinite memory growth when users stay active without logging out.
   - Clean up expired entries and enforce a maximum cache size.

---

## 2. Verification

1. **Backend Tests:**
   - Verify MFA session cache limits and cleanup in tests.
   - Run `cd backend && node --require dotenv/config --test`.
2. **Frontend Typecheck:**
   - Run `cd frontend && npx tsc --noEmit`.
3. **Git Hygiene Check:**
   - Confirm `git ls-files frontend/.vitest` returns nothing.

