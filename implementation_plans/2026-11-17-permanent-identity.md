# Implementation Plan: Permanent Identity & Username Integrity (Workstream B)

Implements Workstream B from `C:\Users\mark\.opencode\plan\2026-11-17-master-plan.md`.
Locks profile identity so that names supplied at signup/Google provisioning are immutable, and guarantees every profile has a unique, mentionable handle formatted according to `^[a-z0-9._]{3,30}$`.

## Proposed Changes

### 1. `backend/services/identity.js`
- Export `deriveBaseUsername(fullName, id)`:
  - Lowercase, strip to `[a-z0-9.]`, collapse dots, trim leading/trailing dots, truncate to 30.
  - Fall back to `student` + last 6 alphanumeric characters of id when missing or < 3 chars.
- Export `deriveUsername(fullName, id, dbClient = db)`:
  - Generate base handle.
  - Check collision in `profiles` (case-insensitive `lower(username)`).
  - Append `_2`, `_3`, etc., keeping total length <= 30.

### 2. Lock Identity in Schema & Model
- `backend/validation/index.js`:
  - `updateProfileSchema`: accepts `full_name` and `username` as optional and ignores them (or strips them) so legacy clients do not receive 400.
- `backend/models/userModel.js`:
  - `updateUser`: remove `full_name` and `username` from SQL `UPDATE profiles SET ...`.
  - `createUser`: default `username` via `deriveUsername` if missing; prevent overwriting existing non-null `full_name`/`username` on conflict.
- `backend/controllers/userController.js`:
  - Remove `full_name` from 403 `identity_locked` error block and silently ignore it (returns 200 without changing the row).
- `backend/controllers/authController.js`:
  - `googleAuth`: fall back to email local-part if Google sends no name; derive username on profile creation.
  - `verifySignup`: derive username on profile creation.

### 3. Database Migration `052_identity_backfill.sql`
- Backfill `full_name` where null using email local-part or default.
- Backfill `username` for all profiles where null using PL/pgSQL function with collision handling (`_2`, `_3`).
- Add unique index: `CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_username_lower ON profiles (lower(username)) WHERE username IS NOT NULL;`
- Add format check constraint: `CHECK (username IS NULL OR username ~ '^[a-z0-9._]{3,30}$')`.

### 4. Tests
- Unit tests for `backend/services/identity.js` (`backend/tests/identity.test.js`).
- Integration tests verifying:
  - `PUT /api/users/:id` with `{ full_name: "Someone Else" }` returns 200 and leaves name unchanged.
  - `PUT /api/users/:id` with `{ username: "new_handle" }` returns 200 and leaves username unchanged.
  - Google auth and signup populate unique usernames.

## Verification Gates
- `npm --prefix backend test` -> all tests pass.
- `SELECT count(*) FROM profiles WHERE username IS NULL;` -> 0.
