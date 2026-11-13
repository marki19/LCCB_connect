# Tasks: Group 1 — Latency Multipliers

Tracking implementation plan: [2026-11-13-group-1-latency-multipliers.md](file:///c:/Programming%20Projects/third-year/LCCB_connect/implementation_plans/2026-11-13-group-1-latency-multipliers.md)

---

## Task 1: Deduplicate Feed Query Columns (Both Locations)
**Description:** Remove redundant `p.image_urls` duplicate selection in `backend/models/postModel.js` in BOTH `getAllPosts` (lines 88-89) and `buildPostSelect` (lines 206-207).

**Acceptance criteria:**
- [x] Remove duplicate `p.image_urls` in `getAllPosts` (`backend/models/postModel.js:88-89`).
- [x] Remove duplicate `p.image_urls` in `buildPostSelect` (`backend/models/postModel.js:206-207`).
- [x] Feed query returns standard post shape without duplicate attributes.

**Verification:**
- [x] Run: `cd backend && node --require dotenv/config --test tests/postModel.test.js` (PASSED)

**Dependencies:** None

**Files touched:**
- `backend/models/postModel.js`

---

## Task 2: Reduce Default Pagination Limit to 25 (Global)
**Description:** Change `DEFAULT_LIMIT` in `backend/models/pagination.js` from 100 to 25. This sets a sane 25-item default across every list endpoint (feed, messages, conversations, admin tables, theses, notifications).

**Acceptance criteria:**
- [x] Update `DEFAULT_LIMIT = 25` in `backend/models/pagination.js`.
- [x] Keep `MAX_LIMIT = 100`.
- [x] Requests omitting `?limit=` receive 25 items maximum globally.

**Verification:**
- [x] Run: `cd backend && node --require dotenv/config --test tests/postModel.test.js tests/admin.test.js tests/feed-filters.test.js` (PASSED)

**Dependencies:** None

**Files touched:**
- `backend/models/pagination.js`
- `backend/tests/routes.test.js`

---

## Task 3: Add Express Response Compression Middleware
**Description:** Add `compression` package to `backend/package.json` and mount `app.use(compression())` in `backend/app.js` before `helmet()` to enable gzip/deflate response compression.

**Acceptance criteria:**
- [x] Install `compression` in `backend/package.json`.
- [x] Mount `app.use(compression())` before `helmet()` in `backend/app.js`.
- [x] Responses with `Accept-Encoding: gzip` receive compressed payloads and correct `Vary: Accept-Encoding`.

**Verification:**
- [x] Run: `cd backend && node --require dotenv/config --test tests/routes.test.js` (PASSED)
- [x] Verified `content-encoding: gzip` on responses > 1KB.

**Dependencies:** None

**Files touched:**
- `backend/package.json`
- `backend/app.js`

---

## Task 4: Bulk Signed URLs with LRU Cache & Timeout in Storage Service
**Description:** Refactor `backend/services/storageService.js` to replace sequential per-image signing with two-phase bulk resolution (`createSignedUrls`), in-memory LRU cache, and a 3-second `Promise.race` timeout guard that unblocks the response on timeout without throwing.

**Acceptance criteria:**
- [x] Implement in-memory LRU cache for signed URLs (`Map<bucket:key, { url, expiresAt }>`) with TTL = `expiresIn - 60s`.
- [x] Implement two-phase resolver in `withStorageUrls`:
  - Phase 1: Collect unique `{ bucket, key }` sets from object payload.
  - Phase 2: Check cache; batch resolve uncached keys with `createSignedUrls` (chunks ≤ 100).
- [x] Add 3000ms `Promise.race` timeout guard: on timeout or error, returns raw keys so the response unblocks in ≤ 3s.
- [x] Explicit invariant: `withStorageUrls` never throws; on any error, return raw keys.
- [x] Delete dead branches (`PUBLIC_BUCKETS.has("assets")`).
- [x] Update `tests/storageService.test.js` and `tests/multi-image-posts.test.js` to stub `createSignedUrls` (plural) and assert bulk API is called once per bucket.

**Verification:**
- [x] Run: `cd backend && node --require dotenv/config --test tests/storageService.test.js tests/multi-image-posts.test.js` (PASSED)

**Dependencies:** None

**Files touched:**
- `backend/services/storageService.js`
- `backend/tests/storageService.test.js`
- `backend/tests/multi-image-posts.test.js`

---

## Task 5: Configure Frontend Axios Client Timeout
**Description:** Add `timeout: 15000` to the shared Axios client in `frontend/src/lib/api.ts` with explicit exemption for FormData / upload routes.

**Acceptance criteria:**
- [x] Add `timeout: 15000` in `client` configuration in `frontend/src/lib/api.ts`.
- [x] Interceptor permits FormData / upload requests to bypass or extend timeout (e.g. 60000ms).
- [x] TypeScript check succeeds.

**Verification:**
- [x] Run: `cd frontend && npx tsc --noEmit` (PASSED: 0 errors)

**Dependencies:** None

**Files touched:**
- `frontend/src/lib/api.ts`

---

## Task 6: End-to-End Suite Verification
**Description:** Run full verification across backend and frontend to confirm 0 regressions.

**Acceptance criteria:**
- [x] All 531 backend tests passing: `cd backend && node --require dotenv/config --test` (PASSED)
- [x] Frontend TypeScript type check: 0 errors (`cd frontend && npx tsc --noEmit`) (PASSED)

**Verification:**
- [x] `cd backend && node --require dotenv/config --test` (531 pass, 0 fail, 131 suites)
- [x] `cd frontend && npx tsc --noEmit` (0 errors)

**Dependencies:** Tasks 1, 2, 3, 4, 5

**Files touched:** None
