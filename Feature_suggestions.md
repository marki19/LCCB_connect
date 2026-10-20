# Feature & Tool Suggestions — LCCB Connect

**Status:** Proposed
**Related:** `Feature_plan.md`, `Security_plan.md`

Ideas are grouped and tagged. Each has a one-line rationale. Nothing here is committed work — pick items
and they can be turned into a `Feature_plan.md`-style breakdown.

Legend: 🟢 quick win (low effort, high value) · 🔵 high-value feature · 🧰 developer tooling.

---

## A. Product features

### A1. 🔵 Global search that actually searches the database
The `(tabs)/search` screen exists but there's no search endpoint. Add Postgres full-text search over posts
(`title`, `content`) and theses (`title`, `abstract`) with a `tsvector` column + GIN index, exposed as
`GET /api/posts?q=` and `GET /api/theses?q=`. Filters: type, technology tags, department, category, year.
*Rationale:* discovery is the core value of an academic portfolio network; tags and theses already exist.

### A2. 🟢 Pagination / infinite scroll
`getAllPosts`/`getAllTheses`/`getAllUsers` return whole tables. Keyset pagination (`?limit=&cursor=`) keeps
the feed fast as data grows. *Rationale:* performance and correctness; pairs with A1.

### A3. 🔵 Persistent notifications + realtime delivery
There's a `notifications` tab and mock `notifications.json`, but no backend. Add a `notifications` table
(recipient, actor, type, entity, read_at), create rows on like/comment/follow, and stream them with
**Supabase Realtime**. *Rationale:* engagement loop; the UI shell already exists.

### A4. 🔵 Comments: edit, delete, and replies
Comments currently support create + list only. Add ownership-checked `PUT`/`DELETE` and optional one-level
threaded replies. *Rationale:* completes the interaction model already shown in the UI.

### A5. 🟢 Bookmarks / saved items
Let students save posts and theses to a personal list (`bookmarks` table, like `likes`). *Rationale:* cheap,
high-retention, reuses the likes pattern.

### A6. 🔵 Follows / "Connect" graph
`follows(follower_id, followee_id)` enables a personalized feed ("Following" vs "For You") and follower
counts on `(tabs)/profile`. *Rationale:* a "Connect" app needs a social graph; seed data already reads like one.

### A7. 🔵 Messaging (real DMs)
`messages.tsx` and mock `conversations.json` exist with no backend. Add `conversations` + `messages` tables,
ownership checks, and Realtime so the screen works with real users. *Rationale:* closes a visible gap.

### A8. 🔵 Verified LCCB student onboarding (security + product)
Restrict signups to the LCCB email domain, require email confirmation, and mark profiles
`verified`. Gate thesis upload and posting behind verification. *Rationale:* trust, spam control, and it
satisfies part of `Security_plan.md` Phase 10.

### A9. 🔵 Admin & moderation toolkit
The `role` column (`student`/`admin`/`superadmin`) and `app/(admin)/*` screens exist client-side. Add
server-enforced admin actions: user role management, content takedown, a **report/flag** flow, and a
moderation queue. *Rationale:* needed for any real deployment; the schema already anticipated roles.

### A10. 🔵 Thesis repository upgrades
- In-app **PDF viewer** and download counter.
- **Citation export** (BibTeX/RIS) and "copy link".
- Advanced filters: department, category, year, keyword (pairs with A1).
- "Related theses" by tag/keyword similarity.
*Rationale:* theses are a first-class entity with dedicated screens; this is the academic differentiator.

### A11. 🟢 Profile: skill endorsements + shareable portfolio
`skills text[]` already exists. Add endorsements (peers vouch for a skill) and a public shareable portfolio
page (the `(portfolio)/webview` route suggests this direction). *Rationale:* showcases student growth.

### A12. 🔵 Realtime feed updates
Use Supabase Realtime to live-prepend new posts/likes/comments without pull-to-refresh. *Rationale:* modern
feel, low incremental cost since you already use Supabase.

### A13. 🟢 Admin analytics dashboard
Basic charts: signups over time, posts/comments/likes per week, most-viewed theses, active users.
*Rationale:* gives admins insight from data you already store.

### A14. 🔵 Trust & safety extras
Block/mute users, a profanity/abuse filter on post/comment content, and link-safety warnings on external
URLs (also reduces `link-preview` abuse). *Rationale:* safe campus community.

### A15. 🟢 Polish: dark mode, accessibility, empty states
Dark mode (NativeWind is already in use), screen-reader labels, and consistent empty/loading states.
*Rationale:* low effort, broad usability win.

---

## B. Developer tooling

### B1. 🧰 Supabase CLI + generated DB types
Add `supabase` as a dev dependency and use `supabase gen types typescript` to generate a `Database` type.
Wire it into the frontend and (via `pg-to-ts`/manual) the backend. *Rationale:* end-to-end type safety over
the schema you already wrote; catches column/type drift instantly.

### B2. 🧰 Real migrations with `node-pg-migrate`
Replace the ad-hoc `scripts/migrate-*.js` with versioned migrations run against `DIRECT_URL`.
*Rationale:* reproducible schema; supports `Security_plan.md` Phase 3/8.

### B3. 🧰 Backend tests: Vitest/Jest + Supertest
Cover auth (401/403), ownership, validation, and the like/comment flows. *Rationale:* makes the security
changes in `Security_plan.md` safe to refactor.

### B4. 🧰 Frontend tests: React Native Testing Library
Auth flows, guest-session removal, and critical screens. *Rationale:* mobile regressions are easy to ship
accidentally.

### B5. 🧰 CI pipeline (GitHub Actions)
On PR: `npm ci`, `npx expo lint`, `npx tsc --noEmit`, tests, `npm audit`, and **gitleaks** secret scan.
*Rationale:* the repo already leaked secrets; automated scanning prevents a repeat.

### B6. 🧰 Pre-commit hooks (husky + lint-staged + gitleaks)
Format/lint staged files and block secret commits locally. *Rationale:* catch problems before CI.

### B7. 🧰 Lint/format consistency
`frontend` has `eslint.config.js`; add Prettier and an ESLint config for `backend`. *Rationale:* consistent
style across the monorepo.

### B8. 🧰 API docs + typed client
Generate OpenAPI/Swagger (or adopt `tRPC`/typed fetch wrappers) and serve docs (Scalar/Redoc).
*Rationale:* the scattered `fetch()` calls in the frontend would become one typed client
(also required by `Security_plan.md` Phase 9).

### B9. 🧰 Structured logging + error tracking
`pino`/`pino-http` on the backend (no tokens/PII) and Sentry on both tiers. *Rationale:* you currently
`console.log`/`console.error` only.

### B10. 🧰 Environment validation & examples
Add `.env.example` files and validate required env at boot with zod. *Rationale:* fail fast; supports
`Security_plan.md` Phase 0/5.

### B11. 🧰 Dependabot + dependency hygiene
Enable Dependabot for npm in both packages. *Rationale:* keeps `express`/`pg`/`@supabase/supabase-js` patched.

### B12. 🧰 Local dev database (Docker Compose or Supabase local)
Optional local Postgres via Compose or `supabase start`. *Rationale:* test migrations without touching prod.

### B13. 🧰 Seed/factory tooling
Use `@faker-js/faker` and idempotent seeds for realistic dev data. *Rationale:* fixes the duplicate-seed
issue and speeds local work.

### B14. 🧰 Request collections
A committed Bruno/Thunder/Postman collection for the API. *Rationale:* quick manual verification of
endpoints, including 401/403 cases.

---

## C. Suggested prioritization

| Priority | Items | Why now |
|----------|-------|---------|
| **P0 (with security work)** | B1, B2, B3, B5, B6, B10 | Enable safe delivery of `Security_plan.md`; stop secret leaks |
| **P1 (core UX)** | A1, A2, A4, A8, A9 | Search, scale, complete interactions, trust & moderation |
| **P2 (engagement)** | A3, A5, A6, A7, A12 | Notifications, saves, social graph, realtime |
| **P3 (differentiators)** | A10, A11, A13, A14 | Thesis tooling, portfolio, analytics, trust & safety |
| **P4 (polish/tooling)** | A15, B4, B7, B8, B9, B11–B14 | Quality-of-life, DX |

**Suggested first three to build:** A1 (search, pairs with A2 pagination), A3 (notifications + realtime),
A8 (verified onboarding, doubles as a security control).
