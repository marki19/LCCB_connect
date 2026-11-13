# Implementation Plan: Group 1 — Latency Multipliers

**Date:** 2026-11-13  
**Status:** Approved for execution  
**Decision on Task 3:** Option 1 — Accept `compression` package. It is standard, battle-tested, and reliably handles `Content-Length`, `Vary: Accept-Encoding`, ETag/Helmet interactions, and streaming flushes.

---

## 1. Problem Statement & Scope

A single feed request currently incurs compounding latency multipliers:
1. **Sequential Supabase Signed-URL Round-Trips:** `withStorageUrls` signs each image individually per post and per array entry without batching, caching, or timeout. A 100-post feed with multiple attachments can trigger hundreds of round-trips before serializing JSON.
2. **Uncompressed HTTP Payloads:** `backend/app.js` lacks gzip/brotli compression middleware, sending multi-megabyte JSON payloads over mobile data.
3. **Over-sized Default Limit:** `DEFAULT_LIMIT = 100` in `backend/models/pagination.js` forces requests without `?limit=` to pull and process 100 items by default across all list endpoints (feed, messages, conversations, admin tables, theses, notifications).
4. **Duplicate SQL Columns:** `p.image_urls` is selected twice in two places in `backend/models/postModel.js` (`getAllPosts` and `buildPostSelect`), doubling array processing and URL signing.
5. **Missing Client-Side Timeout:** Axios client in `frontend/src/lib/api.ts` has no timeout, leaving spinners hanging indefinitely if the backend stalls.

---

## 2. Architecture & Design

```
Client (Axios timeout 15s; uploads exempt)
   │
   ▼
Express App (compression middleware)
   │
   ▼
Feed / Search / List Query (DEFAULT_LIMIT = 25 globally, deduplicated SQL columns)
   │
   ▼
Global Response Serializer (`attachStorageUrls` in app.js)
   │
   ▼
Two-Phase URL Resolver (`storageService.js`)
   ├── Invariant: NEVER throws. On any error or timeout, return raw keys.
   ├── Phase 1: Scan body & collect unique keys per bucket (Set<key>)
   ├── Phase 2: Check in-memory LRU cache (TTL = expiresIn - 60s)
   ├── Phase 3: Batch call `createSignedUrls(bucket, uncachedKeys)` in chunks ≤ 100
   │            wrapped with Promise.race([signCall, timeout(3000)])
   │            (Note: unblocks the response in 3s; does not abort in-flight socket)
   └── Phase 4: Replace keys with signed URLs & cache successful results
```

---

## 3. Dependency Graph & Parallelism

```
Task 1: Duplicate column removal (backend/models/postModel.js) [Independent]
Task 2: Global pagination limit adjustment (backend/models/pagination.js) [Independent]
Task 3: Add compression dependency & middleware (backend/app.js) [Independent]
Task 4: Bulk signed URLs with LRU cache & Promise.race timeout (backend/services/storageService.js) [Independent]
Task 5: Frontend HTTP timeout & upload exemption (frontend/src/lib/api.ts) [Independent]
Task 6: Full suite verification & regression test execution (all tasks complete)
```

---

## 4. Verification Plan

1. **Unit & Integration Tests:**
   - Task 1: `cd backend && node --require dotenv/config --test tests/postModel.test.js`
   - Task 2: `cd backend && node --require dotenv/config --test tests/postModel.test.js tests/admin.test.js tests/feed-filters.test.js`
   - Task 3: `cd backend && node --require dotenv/config --test tests/routes.test.js` + check `content-encoding: gzip`
   - Task 4: `cd backend && node --require dotenv/config --test tests/storageService.test.js` (stubs `createSignedUrls`, asserts 1 call per bucket, verify never throws)
   - Task 5: `cd frontend && npx tsc --noEmit`
   - Full Suite: `cd backend && node --require dotenv/config --test` (all 528+ tests passing)
