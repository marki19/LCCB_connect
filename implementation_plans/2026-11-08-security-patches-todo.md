# Security Patches — Task List

Plan: 2026-11-08 ten-patch security plan.
Rule: one commit per patch, tests written with the patch, `npm test` green before moving on.

## Phase 0 — Baseline
- [x] Map which patches already exist in the working tree
- [x] Restore green baseline (rewrite stale e2e-signup-flow tests for pending_signups flow)

## Phase 1 — Identity and abuse (backend)
- [x] P9: replace `listUsers()` with indexed `profiles` lookup; drop unused deps
- [x] P3: OTP hashing + attempt cap; enumeration-safe responses; google limiter; remove check-email
- [x] P7: uniform lockout response; progressive backoff; reset only after full login

## Phase 2 — Secrets and outbound (backend)
- [x] P6: bcrypt pending password, password re-submitted at verify; delete AES-GCM module
- [x] P8: HTML escaping; SMTP fail-closed; OTP never logged in production; bounce suppression
- [x] P2: timing-safe TOTP; replay guard (`last_used_step`); secrets encrypted at rest

## Phase 3 — MFA enforcement
- [x] P1: login gate, `/mfa/challenge`, AAL2 gate on admin/moderation
- [x] Frontend: login MFA step

## Phase 4 — Verification infrastructure
- [ ] P10: single Babel config, RN test harness, limiter test mode, CI workflow, cleanup

## Already applied by prior work (verify only)
- [x] P4 raw-body HMAC for Brevo webhook
- [x] P5 `{ userId }` in post file authorization
- [~] P3 partial: `crypto.randomInt`, `requestSignupLimiter`
