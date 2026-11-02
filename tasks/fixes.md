# Post-Audit Fixes

Started 2026-10-20 after the read-only security audit.

## Completed

- [x] SSRF: block private/reserved IPv4 and IPv6 ranges, IPv4-mapped IPv6, every DNS answer, and redirects; pin the validated address.
- [x] Hidden theses: filter `hidden` from list/detail by default; moderation can opt in with `includeHidden`.
- [x] Public comments: use the real `getComments` model method; return 404 for hidden/missing parent posts.
- [x] Authenticated comments: listing or adding a comment requires a visible parent post.
- [x] Public peers: expose only the fields the guest feed renders (no bio, role, course, or department ID).
- [x] Department admin with no department: fail closed with 403 instead of querying an unscoped queue.
- [x] Storage: create the `assets` and `theses` buckets plus public-read / authenticated-upload / owner-write policies (migration 011, applied).
- [x] Delete the unused deep-linkable WebView route.
- [x] Remove the legacy likes/comments migration that could recreate blanket RLS policies.
- [x] Remove the hard-coded test password from the tracked seed script; it now reads `TEST_USER_PASSWORD`.
- [x] Redact the test password from `SPEC-superadmin-console.md`.
- [x] Database TLS: bundle the Supabase Root 2021 CA and require certificate verification in `db.js` and `run-sql.js`.
- [x] Add a desktop `(moderation)` surface for `departmentAdmin` using only the queue/action routes (restore/hide content and resolve message reports).

## Verification

- Backend: `npm test` in `backend/` - 216 tests pass.
- Database: `db.query("select 1")` and `run-sql.js` both connect with `rejectUnauthorized: true`.
- Frontend: `npx tsc --noEmit` in `frontend/` - clean.
- Frontend lint: 0 errors, 28 pre-existing warnings; no new errors or warnings from these fixes.
- Live Storage: both buckets and all four policies verified in `storage.buckets` / `pg_policies`.
- Root CA SHA-256: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`; compare it with the Dashboard certificate before production.

## Remaining

- [ ] Rotate or delete the five Supabase test accounts. The old password exists in commit `c46cb26` history even though it is removed from the current tree.
- [ ] Upgrade frontend dependencies. `npm audit --omit=dev` reports 37 vulnerabilities (1 critical, 22 high), mostly Expo/Metro/build-time packages.
- [ ] Implement the admin Settings screen or remove its nav link; it is still a placeholder.
- [ ] Add Storage cleanup when a thesis is deleted; PDFs currently remain.
