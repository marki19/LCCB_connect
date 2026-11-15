# Implementation Plan: Group 2 — Correctness Bugs

**Date:** 2026-11-13  
**Status:** Ready to execute  
**Goal:** Fix correctness bugs identified in the audit: keyset cursor pagination with pinned posts, N+1 notification inserts, and unindexable queries in `getTargetAdmins`.

---

## 1. Problem Statement & Scope

1. **Keyset Cursor Ignores `pinned` (`backend/models/postModel.js`):**
   Queries are ordered by `p.pinned DESC, p.created_at DESC, p.id DESC`, but cursor conditions only evaluate `(created_at, id)`. Pinned posts sort first; when page 1 ends on or after a pinned post, page 2 skips all unpinned posts created after that pinned post, causing feed gaps or duplicate items.
2. **N+1 Notification Inserts (`backend/services/notificationService.js:35-49`):**
   `createNotifications` runs a sequential `for...of` loop issuing an individual `INSERT` per admin, holding pool connections sequentially under concurrent posting.
3. **Non-sargable `getTargetAdmins` Predicate (`backend/services/notificationService.js:16-18`):**
   `LOWER(REPLACE(REPLACE(role, ...)))` prevents PostgreSQL from using existing indexes on `department_id` or `role`, forcing full table scans on `public.profiles`.
*(Note: Dead branches `PUBLIC_BUCKETS.has("assets")` were already purged in Group 1).*

---

## 2. Architecture & Design

### Keyset Cursor Tuple `(pinned, created_at, id)`
- Parse cursor: support `pinned|createdAt|id` (3-part) with fallback to `createdAt|id` (2-part, default `pinned=false`).
- Keyset predicate:
  ```sql
  (
    (p.pinned = false AND $pinned::boolean = true)
    OR (
      p.pinned = $pinned::boolean
      AND (
        p.created_at < $createdAt::timestamptz
        OR (p.created_at = $createdAt::timestamptz AND p.id < $id::uuid)
      )
    )
  )
  ```
- Generates cursor from last row: `${Boolean(lastRow.pinned)}|${lastRow.created_at.toISOString()}|${lastRow.id}`.

### Single-Statement Bulk Notification Insert
- Replace sequential loop with:
  ```sql
  INSERT INTO public.notifications (user_id, actor_id, type, target_id, department_id, department, message)
  SELECT unnest($1::uuid[]), $2, $3, $4, $5, $6, $7;
  ```

### Sargable Admin Lookup
- Target query uses exact canonical role values and index on `department_id`:
  ```sql
  SELECT id, role, department_id FROM public.profiles
  WHERE
    role IN ('admin', 'superadmin')
    OR (
      $1::uuid IS NOT NULL
      AND department_id = $1::uuid
      AND role IN ('departmentAdmin', 'departmentadmin', 'department_admin')
    );
  ```

---

## 3. Verification Plan

1. **Unit Tests:**
   - Test cursor pagination in `tests/postModel.test.js`: verify transition from pinned to unpinned posts.
   - Test `createNotifications` and `getTargetAdmins` in `tests/notificationService.test.js`.
2. **Regression Check:**
   - Run full backend suite: `cd backend && node --require dotenv/config --test`
   - Run frontend type check: `cd frontend && npx tsc --noEmit`
