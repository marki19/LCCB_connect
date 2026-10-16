# Security Enhancement Plan — LCCB Connect

**Status:** Phases 0–5 and 7–11 implemented (6 and 9 partial)
**Scope:** `backend/` (Express API + Postgres/Supabase), `frontend/` (Expo/React Native), Supabase project config
**Related:** `Feature_plan.md`

> **Implementation status (backend auth + authorization pass)**
>
> | Phase | What landed | Key files |
> |-------|-------------|-----------|
> | 0 | `.env` files untracked (`git rm --cached`, contents kept on disk); `.env.example` added for both packages | `backend/.env.example`, `frontend/.env.example` |
> | 1 | `requireAuth` verifies the Supabase access token (`auth.getUser`) and attaches `req.user`; applied to **every** `/api` route; centralized error handler (no stack/DB leakage); JSON body-size limit | `backend/middleware/auth.js`, `backend/index.js` |
> | 2 | Identity comes from the verified token only; ownership enforced in SQL (`author_id` / `uploader_id`); role escalation blocked on profile writes; atomic like toggle | `backend/controllers/*.js`, `backend/models/*.js`, `backend/routes/userRouter.js` |
> | 3 | RLS hardened: blanket `USING (true)` policies dropped, `anon`/`authenticated` privileges revoked, default privileges revoked, RLS left enforced. **Applied to the live database** via `scripts/run-sql.js` | `backend/migrations/001_rls_hardening.sql`, `backend/schema.sql`, `backend/scripts/run-sql.js` |
> | 4 | `zod` validation middleware on every write route (strict objects — rejects unknown keys; allow-listed `type`/`role`; http(s)-only URLs; length caps). Controllers forward errors to the central handler, so raw DB errors are never returned | `backend/validation/index.js`, `backend/routes/*.js`, `backend/controllers/*.js` |
> | 5 | `helmet` headers; CORS restricted to an allow-list (`CORS_ORIGINS`); rate limiting (120/min API, 30/min writes); request logging (no headers/bodies); 404 fallback; boot-time env validation (exits if a required var is missing) | `backend/index.js`, `backend/.env.example` |
> | 6 (partial) | Uploads validated by bucket policy (images-only for `assets`, PDF-only for `theses`), 10 MB cap, `upsert: false`; file columns (`image_url`/`avatar_url`/`pdf_url`) must point **inside this project's Storage**, so a caller cannot park an arbitrary external URL there | `frontend/src/lib/upload.ts`, `backend/validation/index.js` |
> | 7 | `link-preview` edge function: requires a verified Supabase token; http(s)-only; blocks loopback/private/link-local/multicast/metadata (IP literals **and** resolved DNS, re-checked on every redirect hop); timeout + 512 KB cap; origin-restricted CORS; returns extracted metadata only | `frontend/supabase/functions/link-preview/index.ts` |
> | 8 | Partial updates touch only the fields supplied (a fixed column whitelist, so editing a post no longer nulls `image_url`) while ownership is still enforced in SQL; `updated_at` is set by DB triggers (forgery-proof) — **applied to the live database**; keyset pagination (`?limit=`/`?cursor=`) capped at 100 on every list endpoint; seed script is idempotent | `backend/models/*.js`, `backend/controllers/*.js`, `backend/migrations/002_updated_at_triggers.sql`, `backend/scripts/seed-data.js` |
> | 9 (partial) | Central `apiFetch` client attaches `Bearer <token>`; all frontend call sites go through it; fabricated guest session replaced with real anonymous sign-in | `frontend/src/lib/api.ts`, `frontend/app/**`, `frontend/src/contexts/AuthContext.tsx` |
> | 10 | `node:test` + `supertest` suite (**42 tests**: 401 on every `/api` mount, token-derived identity, SQL ownership → 404, role-escalation blocked, storage-URL rules, no DB-error leakage, pagination caps). Backend split into a testable `app.js` + boot-only `index.js`. Unused `expo` backend dependency removed → **`npm audit` 22 → 0 vulnerabilities**. GitHub Actions CI (backend tests + blocking audit; frontend typecheck/lint/audit; gitleaks), Dependabot, `.gitleaks.toml`, and a `.githooks/pre-commit` gitleaks guard | `backend/tests/*`, `backend/app.js`, `backend/package.json`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.githooks/pre-commit`, `.gitleaks.toml` |
> | 11 | **RBAC audit fixes.** A privilege ranking (`ROLE_RANK`, `rankOf`, `getRank`, `canManage`) now backs account management: the caller must *outrank* the target, so an `admin` can no longer edit/delete a peer `admin` or a `superadmin`, and only a `superadmin` can grant `superadmin` (closing an `admin → superadmin` self-promotion). Non-admins are refused before any target lookup, so the endpoint can't be used to probe which account ids exist. Moderation is department-scoped **fail-closed** — new `getCommentById` gives comments the same scope check posts had, and a missing department on either side is a refusal, not a pass | `backend/middleware/auth.js`, `backend/controllers/userController.js`, `backend/controllers/moderationController.js`, `backend/models/postModel.js` |
>
> **Verified:** `/api/*` returns `401` with no/invalid token; `/` stays public; the owner role still reads every
> table after RLS hardening; helmet headers present; unknown web origins get no CORS headers while the
> configured origin does; writes hit `429` after 30/min; the server refuses to boot without required env vars;
> 26/26 Phase-8 checks pass (limit clamping, keyset paging, partial-update + ownership, storage-URL validation);
> the `updated_at` triggers overwrite a forged value; re-running the seed adds no duplicates; **backend
> `npm test` 42/42 pass** (including 14 RBAC regression tests that reproduce the escalation and
> department-scope gaps) **and `npm audit` reports 0 vulnerabilities**; the CI/Dependabot YAML parse; the
> pre-commit hook exits 0 when gitleaks is absent; `tsc --noEmit` and the edge-function syntax check are clean.
>
> **Still manual (Phase 0, steps 1–4):** rotate the leaked DB password + service-role key and purge `.env`
> from git history — needs the Supabase dashboard and a coordinated `git filter-repo` + force-push.
> **Also manual for Phase 7:** (re)deploy the function (`supabase functions deploy link-preview`) and set the
> `ALLOWED_ORIGINS` secret for production web origins.
> **Also manual for Phase 6:** make the `theses` bucket private and add Storage RLS policies (dashboard), then
> switch reads to signed URLs, and add infinite-scroll to the feed to consume `?cursor=`.
> **Also manual for Phase 10:** install `gitleaks` locally to activate the pre-commit scan (the hook is
> already wired via `git config core.hooksPath .githooks`); clear the ~27 pre-existing lint errors so the lint
> step can block; after the Phase 0 history purge, drop `continue-on-error` from the gitleaks CI job.
> **Known-open RBAC items (Phase 11 review, not yet fixed):** the role vocabulary is inconsistent — the API
> accepts seven spellings (`superadmin`/`superAdmin`, `departmentAdmin`/`department_admin`) and stores them
> verbatim with no DB `CHECK` on `profiles.role`, while the client routes on exact equality
> (`frontend/app/_layout.tsx`), so a row written as `superAdmin` is a server-side admin but a client-side
> non-admin (and a `departmentAdmin` is never routed to the moderation UI it is authorised for); the
> declarative gates (`requireAdmin`, `requireSuperAdmin`, `requireFaculty`, …) are still unused, so user
> management and moderation remain enforced by controller-level checks; `GET /api/users` has no role gate
> for any authenticated caller; and there is no department-scope check on notifications.
> Phase 6 (Storage side) and the monitoring half of Phase 10 (Sentry, an `audit_log` table, Supabase auth
> policy) remain open.

---

## 0. Why this plan exists (current posture)

The app is structurally clean (routes → controllers → models, parameterized SQL, no ORM), but it has
**no security layer at all**. Concretely:

| # | Issue | Where | Severity |
|---|-------|-------|----------|
| 1 | Live secrets committed to git & pushed to GitHub | `backend/.env` (tracked), `frontend/.env` (tracked) | **Critical** |
| 2 | `SUPABASE_SERVICE_ROLE_KEY` exposed (bypasses RLS) | `backend/.env:11` | **Critical** |
| 3 | No authentication on any endpoint | `backend/**` (no auth middleware) | **Critical** |
| 4 | No authorization / ownership checks; client-supplied `author_id`/`user_id` trusted | controllers, models | **Critical** |
| 5 | RLS enabled but every policy is `USING (true) WITH CHECK (true)` | `schema.sql:79–83` | **Critical** |
| 6 | `link-preview` edge function fetches arbitrary URLs (SSRF), no auth, `CORS: *` | `frontend/supabase/functions/link-preview/index.ts` | **High** |
| 7 | Raw `error.message` returned to clients | all controllers | **High** |
| 8 | No input validation (only two presence checks) | controllers | **High** |
| 9 | `cors()` wide open, no helmet, no rate limiting, no body-size limit | `backend/index.js` | **Medium** |
| 10 | Fabricated "guest" session (`access_token:"guest"`, hardcoded `u1`) | `frontend/src/contexts/AuthContext.tsx:41` | **Medium** |
| 11 | Uploads: any MIME/size accepted, `upsert:true`, public URLs | `frontend/src/lib/upload.ts` | **Medium** |
| 12 | Partial updates null out columns; `updated_at` never updates; non-atomic like; no pagination | models | **Medium** |

**Design principle for the whole plan:** *the server must derive identity and authority from a verified
token — never from the request body — and the database must be unreachable except through that gate.*

---

## Phase 0 — Incident response: rotate & purge secrets  *(do first, today)*

> The DB password and the service-role key are already public (pushed to GitHub). Assume compromise.

1. **Rotate the database password** in Supabase → Project Settings → Database → Reset password.
2. **Rotate the Supabase API keys** (Project Settings → API): roll the `service_role` key (and `anon` key
   if you want to invalidate every issued client token).
3. **Move service-role usage off the client plane.** Confirm the service-role key is used *only* in trusted
   server/edge contexts — never in `EXPO_PUBLIC_*` (those are embedded in the app bundle and are public).
4. **Purge the files from git history** (removing the file now is not enough; history rewrite is required):
   ```bash
   # From a clean clone, after rotation:
   git filter-repo --path backend/.env --path frontend/.env --invert-paths
   git push --force-with-lease
   ```
   (or BFG Repo-Cleaner). Coordinate with collaborators — everyone must re-clone.
5. **Add a `.env.example`** (committed) documenting required keys with placeholder values, so nobody
   re-commits the real file:
   ```dotenv
   # backend/.env.example
   PORT=3000
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true
   DIRECT_URL=postgresql://USER:PASSWORD@HOST:5432/postgres
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   # SUPABASE_SERVICE_ROLE_KEY=...  # server-only, never shipped to the app
   CORS_ORIGINS=http://localhost:8081,http://localhost:19006
   ```
6. **Enable secret scanning in CI** (Phase 9) so a committed `.env` fails the build.

**Acceptance:** old credentials no longer authenticate; `.env` files are untracked; `.env.example` exists.

---

## Phase 1 — Backend authentication (verify Supabase JWTs)

The frontend already authenticates with Supabase Auth (`signInWithPassword` / `signUp`). The backend just
never checks the resulting token. Add a middleware that verifies the `Authorization: Bearer <access_token>`
header and attaches `req.user`.

**New file `backend/middleware/auth.js`:**
```js
const { createClient } = require("@supabase/supabase-js");

// Anon client used ONLY to verify tokens presented by callers.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } } // server-side, no session storage
);

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return res.status(401).json({ error: "Authentication required" });

  // Verifies signature + expiry and returns the user for that token.
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  req.user = data.user;      // { id, email, ... } — authoritative identity
  req.accessToken = token;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.profile?.role; // populated by loadProfile (below) or from token claims
    if (!roles.includes(role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

module.exports = { requireAuth, requireRole };
```

Optional optimization: verify locally with JWKS using `jose` (avoids a network round-trip per request) once
Supabase asymmetric JWT signing keys are enabled. Start with `getUser()` for correctness.

**Optional `loadProfile` middleware** — fetch the caller's `profiles` row once and attach `req.profile`
(used by `requireRole` and ownership checks):
```js
async function loadProfile(req, res, next) {
  const userModel = require("../models/userModel");
  req.profile = await userModel.getUserById(req.user.id);
  next();
}
```

**Apply in `backend/index.js`:** protect everything under the API by default, then whitelist public reads:
```js
app.use("/api/users",  userRouter);
app.use("/api/posts",  requireAuth, postRouter);
app.use("/api/theses", requireAuth, thesisRouter);
```
(Read-only public feeds can opt out per-route with a `requireAuthOptional` variant if you want an
unauthenticated browse experience — decide explicitly.)

**Acceptance:** unauthenticated `POST /api/posts` returns 401; a request with a valid token succeeds.

---

## Phase 2 — Authorization (identity & ownership)

**Never trust identity fields from the body.** Derive them from `req.user.id`.

**2.1 Posts — enforce ownership in SQL (atomic, race-free):**
```js
// postModel.js
const updatePost = async (id, authorId, postData) => {
  const sql = `
    UPDATE posts SET content=$1, type=$2, title=$3, technologies=$4, github_url=$5, image_url=$6
    WHERE id = $7 AND author_id = $8          -- ownership predicate
    RETURNING *;`;
  const { rows } = await db.query(sql, [/* ... */ id, authorId]);
  return rows[0];                            // undefined => not found OR not owner
};
const deletePost = async (id, authorId) => {
  const { rows } = await db.query(
    `DELETE FROM posts WHERE id=$1 AND author_id=$2 RETURNING *;`, [id, authorId]);
  return rows[0];
};
```
Controller passes `req.user.id` as `authorId`; ignore any `author_id` in the body.

**2.2 Create — force author from token:**
```js
const createPost = async (req, res) => {
  const newPost = await postModel.createPost({ ...req.body, author_id: req.user.id });
  res.status(201).json(newPost);
};
```

**2.3 Likes & comments — use `req.user.id`, not body `user_id`; require auth.**

**2.4 Theses:** same ownership pattern for `updateThesis`/`deleteThesis` (`uploader_id = req.user.id`).
Decide who may create theses (any authenticated student vs. verified uploader).

**2.5 Users / admin endpoints:** `PUT`/`DELETE /api/users/:id` must be **self-only** (or admin). Add
`requireRole('admin','superadmin')` for the admin surface the frontend already guards in
`frontend/app/(admin)/*`.

**Acceptance:** User A cannot update/delete User B's post or profile; a forged `author_id` in the body is ignored.

---

## Phase 3 — Database & RLS hardening

RLS is currently decorative: the policies are `USING (true)` **and** the backend connects as `postgres`
(owner → RLS bypassed). Fix both axes.

**3.1 Least-privilege application role** — the API should not run as the project owner:
```sql
CREATE ROLE lccb_api LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA public TO lccb_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lccb_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lccb_api;
```
Point `DATABASE_URL` at `lccb_api`. Keep `postgres` for migrations only (via `DIRECT_URL`).

**3.2 Replace blanket policies** with least-privilege ones — only needed if clients touch Postgres
directly (Supabase REST/Realtime) with the anon key. Example:
```sql
DROP POLICY "Allow public read-write for posts" ON public.posts;
CREATE POLICY posts_public_read ON public.posts
  FOR SELECT USING (true);                        -- feed is public
CREATE POLICY posts_owner_write ON public.posts
  FOR ALL USING (auth.uid() = author_id)          -- writes only by owner
  WITH CHECK (auth.uid() = author_id);
```
Do the same for `profiles` (self-write), `likes`/`comments` (self by `user_id`), `theses` (owner).
If the API is the *only* path to the data, you can instead keep RLS strict and grant the `lccb_api` role
the needed access — but never leave `USING (true)`.

**3.3 Confirm the table owner cannot silently bypass** intended rules: if you rely on RLS, `ALTER TABLE
public.posts FORCE ROW LEVEL SECURITY;`.

**Acceptance:** connecting with the anon key and no user JWT cannot write; direct Postgres access with the
API role cannot perform admin-only operations.

---

## Phase 4 — Input validation & data integrity

Add schema validation at the edge of every write endpoint.

**Option A (recommended): `zod`** — one module per resource.
```bash
npm --prefix backend install zod
```
```js
// backend/validation/postSchemas.js
const { z } = require("zod");
const HttpUrl = z.string().url().max(2048);

const createPostSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  type: z.enum(["text", "image", "project", "capstone"]).default("text"),
  title: z.string().trim().max(200).optional(),
  technologies: z.array(z.string().trim().max(40)).max(30).optional(),
  github_url: HttpUrl.optional(),
  image_url: HttpUrl.optional(),
}).strict(); // reject unknown keys (blocks author_id injection)

module.exports = { createPostSchema /*, updatePostSchema, commentSchema, thesisSchema, profileSchema */ };
```
Validate in a small `validate(schema)` middleware; return 400 with field errors (never the raw DB error).

**Rules of thumb:** allow-list `type`/`category`, cap lengths, validate URLs, reject unexpected keys,
never accept `author_id`/`user_id`/`role`/`id` from the client on writes.

**Acceptance:** malformed/oversized/unknown-field payloads return 400; `type` outside the enum is rejected
before hitting the DB.

---

## Phase 5 — API hardening (`backend/index.js`)

```bash
npm --prefix backend install helmet express-rate-limit
```
```js
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGINS.split(","), credentials: true }));
app.use(express.json({ limit: "1mb" }));           // bound body size

app.use("/api", rateLimit({ windowMs: 60_000, max: 120 }));        // baseline
const writeLimiter = rateLimit({ windowMs: 60_000, max: 20 });
// app.use("/api/posts", writeLimiter) for POST/PUT/DELETE as needed

// centralized error handler — LAST middleware
app.use((err, req, res, _next) => {
  console.error(err);                               // log server-side
  res.status(err.status || 500).json({ error: "Internal server error" }); // never leak
});
```
- Replace every `catch { res.status(500).json({ error: error.message }) }` with `next(error)`.
- Add a 404 fallback. Add request logging (e.g. `pino-http`) without logging tokens/bodies.
- Add **environment validation at boot** (fail fast if `DATABASE_URL`/`SUPABASE_URL`/keys are missing).

**Acceptance:** CORS only allows configured origins; responses carry helmet headers; error responses carry
no internal details; rapid requests get 429.

---

## Phase 6 — Storage & uploads

`frontend/src/lib/upload.ts` uploads any picked file with `upsert:true` and returns a public URL.

1. **Buckets:** keep `avatars` public; make `theses` **private** and serve via **signed URLs**
   (`createSignedUrl`) so manuscripts aren't world-readable by URL guessing.
2. **Restrict by owner path:** store under `theses/{userId}/...` and add Storage RLS policies so a user can
   write only their own folder.
3. **Validate on the client *and* server side:** enforce MIME allow-list
   (`application/pdf`, `image/png|jpeg|webp`) and a max size (e.g. 10 MB) before upload; the server should
   re-check when it records `pdf_url`/`image_url`.
4. **Store object paths, not arbitrary URLs.** Today `pdf_url`/`image_url` are free-form strings. Accept
   only paths/URLs inside your own bucket, which also closes an SSRF/`javascript:` vector.
5. Consider image processing/EXIF stripping for avatars.

**Acceptance:** a non-PDF upload to `theses` is rejected; thesis files require a signed URL to read.

---

## Phase 7 — Fix the `link-preview` edge function (SSRF)

`frontend/supabase/functions/link-preview/index.ts` fetches a caller-supplied URL with no auth and
`Access-Control-Allow-Origin: *`. That is a classic SSRF: it can hit `localhost`, RFC-1918, and cloud
metadata endpoints (`169.254.169.254`).

Mitigations:
1. **Require auth** (verify the caller's Supabase JWT in the function) and rate-limit per user.
2. **Validate the URL:** allow only `http(s)`, resolve DNS and reject private/loopback/link-local ranges,
   re-check on redirects, set a short timeout, cap response bytes.
3. **Tighten CORS** to your app origins.
4. Prefer `og:image`/`og:title` returned as data; do not echo arbitrary HTML.
5. Consider caching results by URL.

**Acceptance:** requests to `http://169.254.169.254/` / `http://localhost` are rejected; unauthenticated
calls are rejected.

---

## Phase 8 — Correctness fixes (security-adjacent)

- **`updatePost`/`updateThesis` null-out bug:** apply the `COALESCE` pattern used by `updateUser`, or send
  the full validated object from a strict schema (Phase 4 makes the latter safe).
- **`updated_at` never changes:** add a trigger:
  ```sql
  CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
  BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
  CREATE TRIGGER trg_posts_updated  BEFORE UPDATE ON public.posts  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  CREATE TRIGGER trg_theses_updated BEFORE UPDATE ON public.theses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  ```
- **Non-atomic like:** replace check-then-write with
  `INSERT ... ON CONFLICT (post_id,user_id) DO NOTHING` and infer state, or delete-if-exists returning rows,
  so a double-tap can't 500.
- **Pagination:** add `?limit=&cursor=` to `getAllPosts`/`getAllTheses`/`getAllUsers` (keyset on
  `created_at`/`id`); cap `limit` server-side.
- **Idempotent seeding:** add `ON CONFLICT`/dedupe to `scripts/seed-data.js` so re-runs don't duplicate.
- **Migrations:** adopt a real migration tool (e.g. `node-pg-migrate`) using `DIRECT_URL` instead of ad-hoc
  scripts hitting the transaction pooler.

---

## Phase 9 — Frontend changes required by the above

The frontend must send the token once the backend requires it.

1. **Central API client** (`frontend/src/lib/api.ts`) that attaches `Authorization: Bearer
   <session.access_token>` on every call and refreshes on 401. Today calls are scattered `fetch(...)` with
   no auth header (`AuthContext.tsx:57`, `edit-profile.tsx:49`, etc.).
2. **Remove the fabricated guest session** (`AuthContext.tsx:41–44`). If guest browsing is wanted, use
   Supabase **anonymous sign-in** (`supabase.auth.signInAnonymously()`) so the token is real and the backend
   can authorize it. The current fake `access_token:"guest"`/hardcoded `u1` will be rejected (and is a
   security smell regardless).
3. **Pass identity from the session, never as body fields** (e.g. `POST /users` self-provisioning in
   `AuthContext.fetchProfile` must send the token and let the server set `id`).
4. **Storage:** apply Phase 6 rules in `src/lib/upload.ts`.
5. **Admin screens** (`app/(admin)/*`) are currently gated by `profile.role` on the client only — the server
   must also enforce `requireRole('admin','superadmin')`.
6. **`.env`:** `EXPO_PUBLIC_*` values are public by design; keep only non-secret values there and never the
   service-role key.

---

## Phase 10 — Testing, CI, and ongoing hygiene

- **Tests:** backend `vitest`/`jest` + `supertest` covering 401/403/ownership/validation; frontend
  `@testing-library/react-native` for auth/guest removal. Add to CI.
- **CI (GitHub Actions):** lint, typecheck (`npx tsc --noEmit`), tests, `npm audit`, and **secret scanning**
  (`gitleaks`). Fail the build on any hit.
- **Pre-commit hooks** (`husky` + `lint-staged` + `gitleaks protect`) to stop new secret commits.
- **Dependency hygiene:** enable Dependabot; pin/upgrade `pg`, `express`, `@supabase/supabase-js`.
- **Logging/monitoring:** structured logs (no secrets/PII), basic error tracking (Sentry), and Supabase
  audit logs. Add an `audit_log` table for sensitive actions (delete, role change) if desired.
- **Auth policy:** enable email confirmation, strong password policy, and (recommended) restrict signups to
  the LCCB email domain (also a product feature — see `Feature_suggestions.md`).

---

## Suggested sequencing

| Order | Phase | Effort | Blocks |
|-------|-------|--------|--------|
| 1 | **Phase 0** — rotate + purge secrets | S (hours) | everything |
| 2 | **Phase 1** — backend auth | M | Phases 2, 9 |
| 3 | **Phase 2** — authorization/ownership | M | — |
| 4 | **Phase 6/7** — storage + SSRF (highest data-exfil risk) | M | — |
| 5 | **Phase 4/5** — validation + API hardening | M | — |
| 6 | **Phase 3** — DB role + RLS | M–L | needs a maintenance window |
| 7 | **Phase 9** — frontend integration | M | Phase 1 |
| 8 | **Phase 8** — correctness fixes | M | — |
| 9 | **Phase 10** — tests/CI/hygiene | ongoing | — |

**Definition of done (program level):**
- No secrets in git; rotation verified.
- Every write endpoint requires a valid Supabase token and enforces ownership/role **server-side**.
- RLS is least-privilege and the API runs as a restricted DB role.
- Inputs validated; errors never leak internals; CORS/rate-limit/body-size bounded.
- Storage scoped and signed; `link-preview` SSRF closed.
- CI blocks secret commits and failing auth tests.
