# Implementation Plan: Group 3 — Input Caps and Abuse Surface

**Date:** 2026-11-13  
**Status:** Ready to execute  
**Goal:** Harden the backend against expensive search scans and log credential leakage by adding query caps, offset bounds, per-user search rate limiting, header-based Gemini authentication, and request timeouts.

---

## 1. Problem Statement & Scope

1. **Unbounded Search Query & Offset (`backend/controllers/searchController.js`):**
   Search inputs are forwarded directly to `%...%` ILIKE and `plainto_tsquery` without a character ceiling, and `offset` is parsed without an upper bound. A large payload or `offset=999999` forces heavy trigram scans and deep index offsets.
2. **Missing Per-User Search Limiter (`backend/routes/searchRouter.js`):**
   Search is the most compute-intensive endpoint (performing FTS and trigram calculations across people, posts, and theses). Currently only an IP-level backstop exists.
3. **Gemini API Key in URL Query Parameter (`backend/services/moderationService.js`):**
   The Gemini API key is passed in the query string (`?key=${apiKey}`), causing it to appear in proxy, CDN, and access logs. In addition, moderation calls lack a timeout and prompt input length cap.
4. **In-Memory Rate Limiting Documentation:**
   `express-rate-limit` defaults to per-process `MemoryStore`. Multi-instance deployments must use a shared Redis store.

---

## 2. Architecture & Design

### Search Input Hardening
- `q`: Trimmed and sliced to a maximum of 100 characters in `search` and `suggestions`.
- `offset`: Clamped to `[0, 1000]`.

### Per-User Search Limiting
- Add `searchLimiter` to `backend/middleware/actionLimits.js` with a default of 30 requests/minute per authenticated user, skipping superadmin/admin roles.
- Mount `searchLimiter` in `backend/routes/searchRouter.js`.

### Secure Gemini Moderation Calls
- Target URL: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent` (no query params).
- Headers: `{ "Content-Type": "application/json", "x-goog-api-key": apiKey }`.
- Prompt input capped at 5,000 characters.
- Timeout: `AbortSignal.timeout(5000)` (falls back gracefully to local rule scan if timed out).

---

## 3. Verification Plan

1. **Search Tests:**
   - Verify search caps `q` at 100 characters and clamps `offset` to 1000.
   - Verify `searchLimiter` limits rapid requests.
2. **Moderation Tests:**
   - Verify Gemini call sends `x-goog-api-key` header and omits key from URL.
3. **Regression Check:**
   - Backend suite: `cd backend && node --require dotenv/config --test`
   - Frontend typecheck: `cd frontend && npx tsc --noEmit`
