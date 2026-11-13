# Strict CORS HTTPS Enforcement — Implementation Plan

> **Goal**: Restrict allowed CORS web origins to strict `https://` schemes in production and staging environments, preventing insecure `http://` origins and localhost defaults from being trusted in production.

## Status: Planned

---

## Architecture & Requirements

1. **Production HTTPS Enforcement**:
   - In production (`NODE_ENV === "production"`), all configured origins in `CORS_ORIGINS` must use the `https://` protocol.
   - Any origin using `http://` is discarded or rejected in production, with a clear startup/runtime warning.
   - If `CORS_ORIGINS` is not specified in production, the fallback is empty (`[]`), NOT local `http://localhost` origins.

2. **Development & Test Environments**:
   - When `NODE_ENV !== "production"`, `http://localhost:*` and `http://127.0.0.1:*` remain permitted for Expo web and local dev tools.

3. **Origin Matcher & Validation**:
   - Standardize origin normalization (lowercase, trim trailing slashes).
   - Native apps (no `Origin` header), curl, same-origin, and server-to-server requests are allowed without restriction.
   - Unknown web origins receive no CORS allow headers (`callback(null, false)`), causing browser engines to block access.

4. **Modular Architecture**:
   - Extract logic to `backend/utils/corsConfig.js` for clear separation of concerns and thorough unit testing.
   - Wire into `backend/app.js`.

---

## Tasks

### Task 1: Create `backend/utils/corsConfig.js` (~10 min)

**File**: `backend/utils/corsConfig.js` (new)

- `getAllowedOrigins({ env = process.env.NODE_ENV, corsOrigins = process.env.CORS_ORIGINS } = {})`:
  - Parses comma-separated `CORS_ORIGINS`.
  - Normalizes origins (trims, removes trailing slash).
  - In production (`env === "production"`):
    - Filters out any origin that does NOT start with `https://`.
    - Logs a warning if any insecure `http://` origin was dropped.
    - Does NOT inject `DEFAULT_ORIGINS` (localhost).
  - In dev/test:
    - Allows `http://` and falls back to `DEFAULT_ORIGINS` if unset.
- `createCorsOptions(options = {})`:
  - Returns the Express `cors` configuration object with origin checking callback.

---

### Task 2: Mount in `backend/app.js` (~5 min)

**File**: `backend/app.js`

- Replace inline CORS options with `createCorsOptions()`.

---

### Task 3: Unit Tests in `backend/tests/cors.test.js` (~5 min)

**File**: `backend/tests/cors.test.js` (new)

- Tests:
  1. Allows `http://localhost:*` in development (`NODE_ENV=development`).
  2. Discards `http://` origins in production (`NODE_ENV=production`).
  3. Rejects `http://localhost` fallback in production when `CORS_ORIGINS` is unset.
  4. Allows valid `https://` origins in production.
  5. Allows requests with no `Origin` header (mobile apps, server-to-server).

---

## Files Changed Summary

| File | Action | Lines |
|------|--------|-------|
| `backend/utils/corsConfig.js` | **New** | ~50 |
| `backend/app.js` | Edit | ~15 |
| `backend/tests/cors.test.js` | **New** | ~40 |

**Total**: ~90 lines of new code, ~15 lines edited. Zero new dependencies, zero migrations.

