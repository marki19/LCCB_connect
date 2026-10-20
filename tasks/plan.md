# Implementation Plan: Superadmin Console

## Overview

Implement `SPEC-superadmin-console.md` in vertical slices. The backend foundation lands first (migration, audit, suspension), followed by the admin API and then the panel. Each slice leaves the app runnable and testable.

## Architecture Decisions

- Reuse the existing Express/`pg` architecture. No new dependencies.
- `loadProfile` runs once per request and becomes idempotent. `requireActiveAccount` checks the loaded profile and adds no query of its own.
- All privileged writes call `auditService.record()` and use the stored target row for rank checks.
- Announcement history is derived from audit rows; notifications remain the delivery mechanism.
- The panel is desktop-only and uses the existing light admin shell. The student app is untouched outside the desktop return link.
- The legacy `/api/users` directory is closed; the app uses `/api/public/peers`.

## Task List

### Phase 1: Foundation

- [ ] Task 1: Add migration 010 and sync `schema.sql`
- [ ] Task 2: Add `supabaseAdmin`, `accountService`, and `auditService`
- [ ] Task 3: Add `requireActiveAccount`, idempotent `loadProfile`, and shared admin validation
- [ ] Checkpoint: migration applied, schema audit passes, backend tests still pass

### Phase 2: Admin API

- [ ] Task 4: Add `adminModel` read queries and `adminController`/`adminRouter`
- [ ] Task 5: Add user governance actions (role, suspend, unsuspend, force sign-out, delete)
- [ ] Task 6: Add content explorer, thesis moderation, reason enforcement, and audit hooks
- [ ] Task 7: Add announcements, audience count, history, and notification fan-out
- [ ] Checkpoint: `npm test` passes with new admin tests

### Phase 3: Panel

- [ ] Task 8: Rebuild the panel shell, role guard, Back to App, and app return link
- [ ] Task 9: Build the overview screen
- [ ] Task 10: Build the users table and dossier
- [ ] Task 11: Build Reports & Content
- [ ] Task 12: Build Announcements and Audit
- [ ] Task 13: Add the suspended-account screen and AuthContext handling
- [ ] Checkpoint: `tsc --noEmit` and `expo lint` show no new errors

### Phase 4: Release

- [ ] Task 14: Harden legacy user routes and migrate directory consumers
- [ ] Task 15: Add backend tests and run role-by-role QA
- [ ] Task 16: Update `DATABASE.md` and mark the spec implemented

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Direct `auth.sessions` writes are unsupported | Force sign-out may not revoke an access token immediately | Revoke refresh sessions, ban on suspension, document the access-token window, verify with a live token |
| Audit coverage gaps in legacy controllers | Governance history is incomplete | Audit at the controller boundary for every new admin path; add catalog and moderation hooks in the same slice |
| Role vocabulary variants | Rank checks disagree across layers | Use `normalizeRole`/`rankOf` server-side and a single frontend utility |
| Tests stub middleware | New middleware can break the existing suite | Keep `requireActiveAccount` profile-only and mount it after the stubbed `loadProfile` |
| Large frontend rebuild | Type/lint drift | Build shell + overview first, run `tsc` after each screen, then add the remaining screens |
| Existing uncommitted work | Accidental overwrite | Only touch files named in the spec; inspect before replacing |

## Open Questions

None blocking. The spec's defaults are accepted:

- Force sign-out uses session revocation; the access-token window is documented.
- Admin may suspend lower ranks, including `departmentAdmin`.
- Announcement history comes from audit rows.
- Dossier email is visible to both admin roles.
- Thesis "Open in app" goes to Repository.
