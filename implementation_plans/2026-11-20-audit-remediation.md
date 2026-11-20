# Audit remediation — 2026-11-20

Source: the security/connectivity audit delivered 2026-11-20. Security findings
(guest writes, public snap bytes, RLS, write visibility, `media_key`) shipped in
`f41f056`. This plan tracks everything else.

## Out of scope (cannot be done from this repo)

| Item | Why |
|---|---|
| Make `marki19/LCCB_connect` private | `gh` CLI is not installed; repo settings need GitHub access. |
| Rotate the Supabase anon key exposed in `a420ad8` | Needs the Supabase dashboard. |
| Move web session tokens out of `localStorage` | Architectural: needs an httpOnly refresh cookie, CSRF defence, and a CORS-credentials change. Not a bolt-on; needs its own plan and rollout. |

## Slices

### A. Snap viewer: video, progress, correctness
- [x] A1 Render video snaps with `AppVideo` (`autoPlay`, `paused`, `nativeControls={false}`)
- [x] A2 Drive the progress bar from video time, keep the 5 s timer for images
- [x] A3 Fix `handleNext` used before declaration; complete effect deps
- [x] A4 Rename "story" copy in the viewer

### B. Snap composer: audience
- [x] B1 Audience control (Public / Friends / Department) in the create sheet
- [x] B2 Pass the choice to `createSnap` instead of hardcoded `"public"`
- [x] B3 Rename the component and its copy to Quick Snap

### C. Snap comments and replies
- [ ] C1 Migration `061_snap_comments.sql` (table + RLS + index)
- [ ] C2 `snapCommentModel` with visibility-gated reads
- [ ] C3 Read/write routes under `/api/snaps/:id/comments`, `requireVerified` on writes
- [ ] C4 Validation schemas
- [ ] C5 Comment sheet in the viewer
- [ ] C6 Tests

### D. Snap expiry purge
- [ ] D1 `snapModel.listExpiredSnaps` / `deleteExpiredSnaps`
- [ ] D2 `scripts/cleanup-expired-snaps.js` — delete rows, then R2 objects
- [ ] D3 Cover the sequence with a test where the store is stubbed

### E. Naming sweep
- [ ] E1 Rail, feed screen, profile screen, inbox — "story" → "snap"

### F. Reports loop
- [ ] F1 Surface open `reports` in the moderation queue
- [ ] F2 Resolve action wired from the queue
- [ ] F3 Remove now-redundant `GET|PUT /api/reports` if the queue covers them

### G. Cleanup
- [ ] G1 Remove `ALTER TABLE public.theses` blocks from the two legacy scripts
- [ ] G2 Bring lint back under the 63-error baseline
- [ ] G3 Full gate run

## Gates per slice

`npm run test:remote` (backend), `npx tsc -p tsconfig.json --noEmit`,
`npx vitest run`, `npx expo lint` (must stay ≤ 63 errors), `npx expo export --platform web`.
