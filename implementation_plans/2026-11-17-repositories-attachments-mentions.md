# Repositories, Attachments, and Mentions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `posts` into one structured model with two doors — Discussion and Repository — where repository items carry a caption, typed metadata, and PDF/DOCX/PPTX attachments; merge the separate `theses` table into it; and add `@mentions` restricted to friends and same-department users.

**Architecture:** Three independent, sequentially shippable parts. Part 1 adds `kind` / `repository_type` / `post_attachments` and the new composer. Part 2 migrates the `theses` table into `posts` and deletes the parallel path. Part 3 adds mention persistence and the authorization rule. Each part leaves the app working and all gates green.

**Tech Stack:** Node 20 + Express + raw `pg` (backend), Expo Router + React Native Web (frontend), PostgreSQL (Supabase), Cloudflare R2 via hand-rolled SigV4.

**Spec:** this document. The design was agreed in conversation on 2026-11-17.

## Global Constraints

- **No new dependencies.** `expo-video` remains the only approved addition, and it is not used here.
- **English only** in code, copy, and comments.
- **Migration numbers:** `054_repository_posts.sql`, `055_theses_into_posts.sql`, `056_post_mentions.sql`, `057_drop_legacy_post_columns.sql`. `053_guest_role.sql` is taken.
- **Mention rule:** allowed set = **friends ∪ same department**. Being friends bypasses the department restriction. Enforced server-side; the client is never trusted.
- **Repository naming:** the tab is **Repositories**, one item is a **repository item**. Never "story".
- **Guests are read-only.** Every new write route sits behind the existing `requireVerified` / guest guard.
- **Caption, not "What's on your mind".** The discussion placeholder is `What's on your mind, {firstName}?`; the repository caption placeholder is `Write a caption…`.
- **Verification gates** (run before claiming any task done):
  - `cd backend && node --require dotenv/config --test` → 0 failing
  - `cd frontend && npx tsc -p tsconfig.json --noEmit` → 0 errors
  - `cd frontend && npx vitest run` → 41+ passing
  - `cd frontend && npx expo lint` → no new errors above the 65 baseline
  - `cd frontend && npx expo export --platform web` → exit 0
- **No dual writes.** Once Task 6 lands, `post_attachments` is the only source for images. `image_url` / `image_urls` are derived in the API projection until Task 23 drops the columns.

## Review Focus

1. **Attachment key spoofing** — a client could send `storage_key: "avatars/<someone-else>.png"`. The API must accept only `posts/…` for images and `documents/…` for documents, and must reject keys that are not owned by the request's category rules.
2. **Mention of a non-allowed user** — a crafted `mention_ids` array must return `400 mention_not_allowed`, not be silently dropped. A silently dropped mention looks like it worked.
3. **Public post + same-department mention** — naming a classmate who is not your friend on a public post exposes them campus-wide. Public repository/discussion posts allow **friends only**; department and custom audiences allow friends ∪ department.
4. **A repository item with no attachment** — a project may be a GitHub link only. Creation must not require an attachment; a thesis must require at least one document.
5. **A `.doc`/`.ppt` upload** — legacy OLE files are allowlisted today but always rejected. After Task 2 they must upload, and a renamed executable must still be rejected.

---

# Part 1 — Repositories core

Ships on its own. Theses still work through the old path until Part 2.

### Task 1: Schema — kind, repository_type, attachments

**Files:**
- Create: `backend/migrations/054_repository_posts.sql`
- Test: `backend/tests/repositorySchema.test.js`

**Interfaces:**
- Produces: `posts.kind`, `posts.repository_type`, `posts.repository_category`, `posts.live_url`, table `post_attachments`, function `visible_post_attachments(viewer text)`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/repositorySchema.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");

test("posts.kind defaults to discussion and rejects unknown values", async () => {
  const cols = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'posts' AND column_name IN ('kind','repository_type','live_url','repository_category')`
  );
  assert.equal(cols.rows.length, 4);
  await assert.rejects(
    db.query(`INSERT INTO posts (author_id, kind) VALUES ('__nobody__','nope')`),
    /posts_kind_check/
  );
});

test("post_attachments cascades on post delete", async () => {
  const def = await db.query(
    `SELECT pg_get_constraintdef(oid) d FROM pg_constraint
     WHERE conname = 'post_attachments_post_id_fkey'`
  );
  assert.match(def.rows[0].d, /ON DELETE CASCADE/);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd backend && node --require dotenv/config --test tests/repositorySchema.test.js`
Expected: FAIL — column `kind` does not exist.

- [ ] **Step 3: Write the migration**

`backend/migrations/054_repository_posts.sql` must, inside `BEGIN; … COMMIT;`:

```sql
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'discussion',
  ADD COLUMN IF NOT EXISTS repository_type TEXT,
  ADD COLUMN IF NOT EXISTS repository_category TEXT,
  ADD COLUMN IF NOT EXISTS live_url TEXT;

UPDATE public.posts SET kind='repository', repository_type='project'
  WHERE type IN ('project','website');
UPDATE public.posts SET kind='repository', repository_type='capstone'
  WHERE type='capstone';
UPDATE public.posts SET kind='announcement' WHERE type='announcement';

ALTER TABLE public.posts
  ADD CONSTRAINT posts_kind_check CHECK (kind IN ('discussion','repository','announcement')),
  ADD CONSTRAINT posts_repository_type_check CHECK (
    (kind='repository' AND repository_type IN ('project','capstone','thesis'))
    OR (kind<>'repository' AND repository_type IS NULL)
  );

CREATE INDEX posts_kind_type_created_idx
  ON public.posts (kind, repository_type, created_at DESC);

CREATE TABLE public.post_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, storage_key)
);
CREATE INDEX post_attachments_post_idx ON public.post_attachments (post_id, sort_order);

CREATE OR REPLACE FUNCTION public.visible_post_attachments(viewer text)
RETURNS SETOF public.post_attachments
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT a.* FROM public.post_attachments a
  WHERE EXISTS (SELECT 1 FROM public.visible_posts(viewer) p WHERE p.id = a.post_id);
$$;
```

Backfill images before any code change: insert one row per element of `image_urls` (or `[image_url]` when only that is set), with `mime_type` derived from the extension and `sort_order` from the array index.

- [ ] **Step 4: Apply and re-run**

Run: `cd backend && node scripts/run-sql.js migrations/054_repository_posts.sql`
(`scripts/migrate.js` applies every pending migration in order; `run-sql.js` applies one file.)
Then: `node --require dotenv/config --test tests/repositorySchema.test.js`
Expected: PASS. Verify `SELECT count(*) FROM post_attachments` equals the number of image URLs across posts.

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/054_repository_posts.sql backend/tests/repositorySchema.test.js
git commit -m "feat(posts): add kind, repository type, and post_attachments"
```

---

### Task 2: File policy — PPTX, PPT, and legacy OLE

**Files:**
- Modify: `backend/services/filePolicy.js:34-43` (`EXTENSION_MIME`), `:56-66` (`documents` rules), `:133-140` (`verifyMagicBytes`)
- Test: `backend/tests/filePolicy.test.js`

**Interfaces:**
- Produces: `documents` accepts `.pdf`, `.docx`, `.doc`, `.pptx`, `.ppt`; `verifyMagicBytes` recognises OLE (`D0 CF 11 E0 A1 B1 1A E1`) and ZIP (`PK\x03\x04`).

- [ ] **Step 1: Write the failing tests**

```js
test("accepts pptx and ppt in documents", () => {
  const pptx = Buffer.concat([Buffer.from([0x50,0x4b,0x03,0x04]), Buffer.alloc(64)]);
  const ppt  = Buffer.concat([Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]), Buffer.alloc(64)]);
  assert.match(resolveUpload({ category:"documents", originalName:"deck.pptx", buffer:pptx }).key, /\.pptx$/);
  assert.match(resolveUpload({ category:"documents", originalName:"deck.ppt",  buffer:ppt  }).key, /\.ppt$/);
});

test("still rejects an executable renamed to .doc", () => {
  assert.throws(
    () => resolveUpload({ category:"documents", originalName:"x.doc", buffer: Buffer.from("MZ\x90\x00") }),
    /do not match the expected format/
  );
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd backend && node --require dotenv/config --test tests/filePolicy.test.js`
Expected: FAIL — extension `.pptx` is not allowed.

- [ ] **Step 3: Implement**

Add to `EXTENSION_MIME`:
```js
".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
".ppt":  "application/vnd.ms-powerpoint",
```
Add both MIME types and extensions to `CATEGORY_RULES.documents`. In `verifyMagicBytes`, add:
```js
case ".doc":
case ".ppt":
  return buffer.length >= 8 &&
    buffer[0]===0xd0 && buffer[1]===0xcf && buffer[2]===0x11 && buffer[3]===0xe0 &&
    buffer[4]===0xa1 && buffer[5]===0xb1 && buffer[6]===0x1a && buffer[7]===0xe1;
case ".pptx":
  return buffer[0]===0x50 && buffer[1]===0x4b && buffer[2]===0x03 && buffer[3]===0x04;
```

- [ ] **Step 4: Run the suite**

Run: `cd backend && node --require dotenv/config --test tests/filePolicy.test.js`
Expected: PASS, 27+ tests.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(upload): accept pptx, ppt, and legacy doc/ppt in documents"
```

---

### Task 3: Frontend upload — document picker and formats

**Files:**
- Modify: `frontend/src/lib/upload.ts:16-24` (`documents` MIME list), `:203-217` (`pickDocument`), `:302-321` (mobile extension detection), `:290-295` (web extension detection)
- Create: `frontend/src/lib/upload.test.ts` (extend the existing test file if one exists)

**Interfaces:**
- Produces: `pickDocuments(): Promise<PickedDocument[]>`; `PickedDocument = { uri, type, name, size? }`; `MAX_UPLOAD_BYTES.document = 25 * 1024 * 1024`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { extensionForMime } from "./upload";

describe("extensionForMime", () => {
  it("maps every allowed document mime to its extension", () => {
    expect(extensionForMime("application/pdf")).toBe(".pdf");
    expect(extensionForMime("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(".docx");
    expect(extensionForMime("application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe(".pptx");
    expect(extensionForMime("application/msword")).toBe(".doc");
    expect(extensionForMime("application/vnd.ms-powerpoint")).toBe(".ppt");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd frontend && npx vitest run src/lib/upload.test.ts`
Expected: FAIL — `extensionForMime` is not exported.

- [ ] **Step 3: Implement**

Export `extensionForMime(mime: string): string` and use it in both branches of `uploadToStorage` instead of the hand-written `if/else` chain. Add the four Office MIME types to `BUCKET_MIME_TYPES.documents`. Add `pickDocuments` using `DocumentPicker.getDocumentAsync({ type: [<the four mimes>], multiple: true })`.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd frontend && npx vitest run && npx tsc -p tsconfig.json --noEmit`
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/upload.ts frontend/src/lib/upload.test.ts
git commit -m "feat(upload): add document picker and office formats"
```

---

### Task 4: Validation — repository payload

**Files:**
- Modify: `backend/validation/index.js:94-108` (`postFields`), `:110-125` (`withPostContentRule`)
- Test: `backend/tests/validation.test.js`

**Interfaces:**
- Produces: `createPostSchema` / `updatePostSchema` accept `kind`, `repository_type`, `repository_category`, `live_url`, `attachments[]`.
- `attachmentSchema = { storage_key: StorageKey, file_name: string(1..255), mime_type: AttachmentMime, size_bytes: int >= 0 | null }`. `size_bytes` is nullable because the thesis migration (Task 13) cannot recover historical sizes.

- [ ] **Step 1: Write the failing tests**

```js
test("repository_type is required exactly when kind is repository", () => {
  assert.equal(createPostSchema.safeParse({ kind:"repository", content:"x" }).success, false);
  assert.equal(createPostSchema.safeParse({ kind:"repository", repository_type:"project", content:"x" }).success, true);
  assert.equal(createPostSchema.safeParse({ kind:"discussion", repository_type:"project", content:"x" }).success, false);
});

test("a thesis needs at least one document attachment", () => {
  assert.equal(createPostSchema.safeParse({
    kind:"repository", repository_type:"thesis", title:"T", content:"c", attachments: []
  }).success, false);
});

test("an attachment key must match its mime family", () => {
  assert.equal(createPostSchema.safeParse({
    kind:"repository", repository_type:"project", content:"c",
    attachments: [{ storage_key:"avatars/abc.png", file_name:"a.png", mime_type:"image/png", size_bytes:1 }]
  }).success, false);
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd backend && node --require dotenv/config --test tests/validation.test.js`
Expected: FAIL — unknown key `kind`.

- [ ] **Step 3: Implement**

Add to `postFields`; extend `withPostContentRule` with the two cross-field rules (repository requires `repository_type`; thesis requires a document attachment); add a `superRefine` that rejects `storage_key` prefixes that do not match `mime_type` (`image/*` → `posts/`, documents → `documents/`). Cap `attachments` at 10 and images at 4.

- [ ] **Step 4: Run the suite**

Run: `cd backend && node --require dotenv/config --test tests/validation.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(validation): repository post and attachment schemas"
```

---

### Task 5: Model — read projections

**Files:**
- Modify: `backend/models/postModel.js:100-140`, `:160-200`, `:220-300`, `:810-830`
- Test: `backend/tests/postModel.attachments.test.js`

**Interfaces:**
- Produces: every post projection returns `kind`, `repository_type`, `repository_category`, `live_url`, `attachments[]`, and **derived** `image_url` / `image_urls`.
- `attachments` is `json_agg` ordered by `sort_order`, `[]` when empty.

- [ ] **Step 1: Write the failing test**

```js
test("a post returns its attachments and derived image fields", async () => {
  const post = await postModel.getPostById(postId, viewerId);
  assert.equal(post.kind, "repository");
  assert.equal(post.repository_type, "project");
  assert.deepEqual(post.attachments.map(a => a.storage_key), ["posts/a.png", "documents/b.pdf"]);
  assert.deepEqual(post.image_urls, ["posts/a.png"]);
  assert.equal(post.image_url, "posts/a.png");
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd backend && node --require dotenv/config --test tests/postModel.attachments.test.js`
Expected: FAIL — `attachments` undefined.

- [ ] **Step 3: Implement**

Add a shared SQL fragment (one constant, reused by all projections):

```sql
COALESCE((
  SELECT json_agg(json_build_object(
    'id', a.id, 'storage_key', a.storage_key, 'file_name', a.file_name,
    'mime_type', a.mime_type, 'size_bytes', a.size_bytes, 'sort_order', a.sort_order
  ) ORDER BY a.sort_order)
  FROM public.post_attachments a WHERE a.post_id = p.id
), '[]'::json) AS attachments
```

Derive `image_url` / `image_urls` from `attachments` in a single JS helper `withDerivedImages(row)` applied at the model boundary.

- [ ] **Step 4: Run the model tests**

Run: `cd backend && node --require dotenv/config --test tests/postModel.attachments.test.js tests/feed-filters.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(posts): project attachments and derive image fields"
```

---

### Task 6: Model — write attachments transactionally

**Files:**
- Modify: `backend/models/postModel.js` (`createPost` ~`:560-620`, `updatePost` ~`:630-700`, `POST_UPDATABLE_COLUMNS`)
- Test: `backend/tests/postModel.attachments.test.js`

**Interfaces:**
- Consumes: `attachmentSchema` (Task 4), `post_attachments` (Task 1).
- Produces: `createPost({ …, attachments })`, `updatePost(id, authorId, { …, attachments })`. `attachments: undefined` leaves rows untouched; `attachments: []` deletes all rows.

- [ ] **Step 1: Write the failing tests**

```js
test("createPost inserts attachments in sort order", async () => {
  const post = await postModel.createPost({
    author_id: userId, content: "c", kind: "repository", repository_type: "project",
    attachments: [
      { storage_key: "posts/a.png", file_name: "a.png", mime_type: "image/png", size_bytes: 10 },
      { storage_key: "documents/b.pdf", file_name: "b.pdf", mime_type: "application/pdf", size_bytes: 20 },
    ],
  });
  const rows = await db.query(
    `SELECT storage_key, sort_order FROM post_attachments WHERE post_id=$1 ORDER BY sort_order`,
    [post.id]
  );
  assert.deepEqual(rows.rows.map(r => r.storage_key), ["posts/a.png", "documents/b.pdf"]);
  assert.deepEqual(rows.rows.map(r => r.sort_order), [0, 1]);
});

test("updatePost replaces the attachment set", async () => {
  await postModel.updatePost(postId, userId, { attachments: [
    { storage_key: "documents/c.docx", file_name: "c.docx", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size_bytes: 5 },
  ]});
  const rows = await db.query(`SELECT storage_key FROM post_attachments WHERE post_id=$1`, [postId]);
  assert.deepEqual(rows.rows.map(r => r.storage_key), ["documents/c.docx"]);
});

test("updatePost with attachments:[] clears them", async () => {
  await postModel.updatePost(postId, userId, { attachments: [] });
  const rows = await db.query(`SELECT 1 FROM post_attachments WHERE post_id=$1`, [postId]);
  assert.equal(rows.rowCount, 0);
});

test("a failed post insert leaves no attachments", async () => {
  await assert.rejects(postModel.createPost({
    author_id: userId, content: "c", kind: "repository", repository_type: "thesis",
    attachments: [{ storage_key: "documents/x.pdf", file_name: "x.pdf", mime_type: "application/pdf", size_bytes: 1 }],
    visibility: "not_a_visibility",
  }));
  const rows = await db.query(`SELECT 1 FROM post_attachments WHERE storage_key='documents/x.pdf'`);
  assert.equal(rows.rowCount, 0);
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd backend && node --require dotenv/config --test tests/postModel.attachments.test.js`
Expected: FAIL — attachments are not persisted.

- [ ] **Step 3: Implement**

Inside the existing `db.withTransaction`, insert attachments after the post insert with a multi-row `INSERT … VALUES`; on update, `DELETE FROM post_attachments WHERE post_id = $1` then re-insert when `attachments !== undefined`. Remove `image_url` and `image_urls` from `POST_UPDATABLE_COLUMNS`.

- [ ] **Step 4: Run**

Run: `cd backend && node --require dotenv/config --test tests/postModel.attachments.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(posts): persist attachments transactionally"
```

---

### Task 7: Storage URLs for attachments

**Files:**
- Modify: `backend/services/storageService.js:20-40` (field→bucket map), `:160-200` (`withStorageUrls` recursion)
- Test: `backend/tests/storageService.test.js`

**Interfaces:**
- Produces: `withStorageUrls` resolves `attachments[].storage_key` using the key's own category prefix: `posts/*` → `/api/files/…`, `documents/*` → signed URL.

- [ ] **Step 1: Write the failing test**

```js
test("resolves attachment storage keys by their category prefix", async () => {
  const out = await withStorageUrls({ attachments: [
    { storage_key: "posts/a.png", mime_type: "image/png" },
    { storage_key: "documents/b.pdf", mime_type: "application/pdf" },
  ]});
  assert.match(out.attachments[0].url, /^\/api\/files\/posts\//);
  assert.match(out.attachments[1].url, /^https?:/);
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd backend && node --require dotenv/config --test tests/storageService.test.js`
Expected: FAIL — `url` undefined.

- [ ] **Step 3: Implement**

Recurse into `attachments` arrays; add `url` next to `storage_key` without mutating the key. Use `parseKey(storage_key).category` from `filePolicy` to choose public vs signed.

- [ ] **Step 4: Run**

Run: `cd backend && node --require dotenv/config --test tests/storageService.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(storage): resolve attachment URLs at the response boundary"
```

---

### Task 8: Controller and routes

**Files:**
- Modify: `backend/controllers/postController.js:95-140` (`createPost`), `:40-60` (filters)
- Modify: `backend/routes/postRouter.js` (no new route; confirm `requireVerified` on writes)
- Test: `backend/tests/routes.test.js`

**Interfaces:**
- Produces: `GET /api/posts?kind=repository&repository_type=thesis`; `POST /api/posts` and `PUT /api/posts/:id` accept the Task 4 payload.

- [ ] **Step 1: Write the failing tests**

```js
test("POST /api/posts creates a repository item with attachments", async () => { /* 201, attachments length 1 */ });
test("GET /api/posts?kind=repository&repository_type=project returns only project items", async () => { /* every row matches */ });
test("a guest cannot POST a repository item", async () => { /* 403 */ });
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd backend && node --require dotenv/config --test tests/routes.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

Pass `kind`, `repository_type`, `repository_category`, `live_url`, `attachments` from `req.body` into the model. Add `kind` and `repository_type` to the filter builder (`POST_TYPE_FILTERS` replaced by an explicit allowlist). Remove the `postPayload.type === "text" → "website"` coercion at `:108`.

- [ ] **Step 4: Run**

Run: `cd backend && node --require dotenv/config --test`
Expected: 0 failing.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(posts): repository create, update, and filters"
```

---

### Task 9: Frontend types and API client

**Files:**
- Modify: `frontend/src/types.ts` (post shape), `frontend/src/lib/api.ts` (`updatePost` payload)
- Test: `frontend/src/lib/api.test.ts`

**Interfaces:**
- Produces: `PostKind`, `RepositoryType`, `PostAttachment` types; `updatePost` accepts the new payload.

- [ ] **Step 1: Write the failing test** — a type-level test is not worth a runtime test; instead assert the request body shape:

```ts
it("sends kind and attachments", async () => {
  await updatePost("1", { kind: "repository", repository_type: "project", attachments: [] });
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/posts/1"), expect.objectContaining({
    body: expect.stringContaining('"repository_type":"project"'),
  }));
});
```

- [ ] **Step 2: Run to confirm failure** — `cd frontend && npx vitest run src/lib/api.test.ts` → FAIL.

- [ ] **Step 3: Implement** — extend the `updatePost` parameter type and the `Post` type. Keep `image_url` / `image_urls` optional while the backend still derives them.

- [ ] **Step 4: Run** — `npx vitest run && npx tsc -p tsconfig.json --noEmit` → PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(frontend): post kind, repository type, and attachment types"
```

---

### Task 10: Composer — two doors, caption, attachments

**Files:**
- Modify: `frontend/app/create.tsx:62` (PostType), `:99-125` (state), `:220-300` (submit), `:490-700` (type panels), `:1020-1050` (type toggles), `:780` (placeholder), `:820-830` (image previews)
- Create: `frontend/src/components/composer/RepositoryFields.tsx`, `frontend/src/components/composer/AttachmentList.tsx`
- Test: `frontend/src/components/composer/RepositoryFields.test.tsx`

**Interfaces:**
- Consumes: `pickDocuments` (Task 3), `uploadToStorage`, `PostKind`, `RepositoryType`.
- Produces: `<RepositoryFields kind repositoryType onChange />`, `<AttachmentList items onRemove />`.

- [ ] **Step 1: Write the failing test**

```tsx
it("shows the caption placeholder for repositories and the discussion placeholder otherwise", () => {
  render(<Composer kind="repository" firstName="Mark" />);
  expect(screen.getByPlaceholderText("Write a caption…")).toBeTruthy();
  render(<Composer kind="discussion" firstName="Mark" />);
  expect(screen.getByPlaceholderText("What's on your mind, Mark?")).toBeTruthy();
});
```

- [ ] **Step 2: Run to confirm failure** — `npx vitest run src/components/composer` → FAIL.

- [ ] **Step 3: Implement**

- Top-level switch: **Discussion | Repository**. Remove the five `setPostType` toggles at `:1020-1050`.
- Repository subtype chips: **Project | Capstone | Thesis**.
- Fields: Project → title, tech stack, repo URL, live URL. Capstone → title, tech stack, category. Thesis → title, category (Capstone / Dissertation), abstract-as-caption.
- Attachment row: image picker (max 4) and document picker (max 10 total). Upload images to `posts`, documents to `documents`.
- Placeholder is `kind === "discussion" ? \`What's on your mind, ${firstName}?\` : "Write a caption…"`.

- [ ] **Step 4: Run** — `npx vitest run && npx tsc -p tsconfig.json --noEmit` → PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(composer): discussion and repository doors with attachments"
```

---

### Task 11: Card and detail rendering

**Files:**
- Modify: `frontend/src/components/PostCard.tsx:90-110`, `:130-150`
- Modify: `frontend/app/post/[id].tsx:55-65` (badge map), `:310-335` (edit params)
- Create: `frontend/src/components/AttachmentStrip.tsx`
- Test: `frontend/src/components/AttachmentStrip.test.tsx`

**Interfaces:**
- Produces: `<AttachmentStrip attachments />` renders image thumbnails and document chips (`file_name`, size, download).

- [ ] **Step 1: Write the failing test**

```tsx
it("renders a chip per document attachment", () => {
  render(<AttachmentStrip attachments={[
    { storage_key: "documents/a.pdf", file_name: "thesis.pdf", mime_type: "application/pdf", size_bytes: 1024 },
  ]} />);
  expect(screen.getByText("thesis.pdf")).toBeTruthy();
});
```

- [ ] **Step 2: Run to confirm failure** — `npx vitest run src/components/AttachmentStrip.test.tsx` → FAIL.

- [ ] **Step 3: Implement** — badge from `kind` / `repository_type`; attachments rendered below the caption; edit route params carry `kind`, `repository_type`, and the attachment list as JSON.

- [ ] **Step 4: Run** — `npx vitest run && npx tsc -p tsconfig.json --noEmit` → PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(posts): render repository badges and attachments"
```

---

### Task 12: Feeds read the new taxonomy

**Files:**
- Modify: `frontend/app/(tabs)/index.tsx:286-296` (unified filters)
- Modify: `frontend/app/(tabs)/search.tsx:116-165` (Repository tab still queries `/theses` until Part 2)
- Test: `frontend/src/lib/feedFilters.test.ts`

**Interfaces:**
- Produces: `matchesFeedFilter(item, filter)` in `frontend/src/lib/feedFilters.ts` — the single place feed filters live.

- [ ] **Step 1: Write the failing test**

```ts
it("maps feed filters to kind and repository_type", () => {
  expect(matchesFeedFilter({ kind:"repository", repository_type:"project" }, "projects")).toBe(true);
  expect(matchesFeedFilter({ kind:"repository", repository_type:"thesis" }, "projects")).toBe(false);
  expect(matchesFeedFilter({ kind:"discussion" }, "discussions")).toBe(true);
});
```

- [ ] **Step 2: Run to confirm failure** — `npx vitest run src/lib/feedFilters.test.ts` → FAIL.

- [ ] **Step 3: Implement** — extract the inline filters at `index.tsx:286-296` into the helper and use it. Leave `search.tsx` on `/theses` for now.

- [ ] **Step 4: Run all gates** — backend tests, tsc, vitest, lint, web export. All green.

- [ ] **Step 5: Commit**

```bash
git commit -am "refactor(feeds): centralize post kind filters"
```

**Part 1 gate:** create a project with a PDF and a PNG, a capstone with a PPTX, and a discussion. All render correctly; attachments download; the feed filters work.

---

# Part 2 — Thesis merge

Depends on Part 1. Live database has **0 theses rows**, so this is a code refactor, not a data migration.

### Task 13: Migration — theses into posts

**Files:**
- Create: `backend/migrations/055_theses_into_posts.sql`
- Test: `backend/tests/thesisMigration.test.js`

**Interfaces:**
- Consumes: `posts.kind`, `post_attachments` (Task 1).
- Produces: no `theses` table; no `thesis_audience`; no `visible_theses()`.

- [ ] **Step 1: Write the failing test**

```js
test("theses and thesis_audience no longer exist", async () => {
  const t = await db.query(`SELECT to_regclass('public.theses') AS r`);
  assert.equal(t.rows[0].r, null);
  const a = await db.query(`SELECT to_regclass('public.thesis_audience') AS r`);
  assert.equal(a.rows[0].r, null);
});
```

- [ ] **Step 2: Run to confirm failure** — table still exists.

- [ ] **Step 3: Implement the migration** (inside one transaction, in this order):

```sql
INSERT INTO public.posts (id, author_id, content, kind, repository_type,
  repository_category, title, visibility, moderation_status, moderation_reason,
  author_department_id, created_at, updated_at)
SELECT t.id, t.uploader_id, t.abstract, 'repository', 'thesis',
  t.category, t.title, t.visibility, t.moderation_status, t.moderation_reason,
  t.department_id, t.created_at, t.updated_at
FROM public.theses t
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.post_attachments (post_id, storage_key, file_name, mime_type, size_bytes, sort_order)
SELECT t.id, t.pdf_url, split_part(t.pdf_url,'/',2), 'application/pdf', NULL, 0
FROM public.theses t
ON CONFLICT (post_id, storage_key) DO NOTHING;

INSERT INTO public.post_audience (post_id, user_id)
SELECT thesis_id, user_id FROM public.thesis_audience
ON CONFLICT DO NOTHING;

UPDATE public.reports SET target_type='post' WHERE target_type='thesis';

DROP FUNCTION IF EXISTS public.visible_theses(text);
DROP TABLE public.thesis_audience;
DROP TABLE public.theses;
```

- [ ] **Step 4: Apply and verify** — run the migration, then the test. Expected PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/055_theses_into_posts.sql backend/tests/thesisMigration.test.js
git commit -m "refactor(db): merge theses into posts as repository items"
```

---

### Task 14: Backend — delete the parallel thesis path

**Files:**
- Delete: `backend/models/thesisModel.js`, `backend/controllers/thesisController.js`, `backend/routes/thesisRouter.js`, `backend/tests/thesisModel.test.js`
- Modify: `backend/app.js` (remove the `/api/theses` mount), `backend/routes/publicRouter.js:9-10`, `backend/controllers/publicController.js`, `backend/models/searchModel.js:90-110`, `backend/models/userModel.js:258` (`theses_count`), `backend/validation/index.js:140-160`
- Test: `backend/tests/routes.test.js`

**Interfaces:**
- Produces: `GET /api/public/theses` and `GET /api/public/theses/:id` served from `posts` where `kind='repository' AND repository_type='thesis'`; `/api/theses` removed; `theses_count` = count of those posts.

> There is no `userModel.getUserTheses`. The profile list is fetched from the API in `useProfileData.ts`; only the count at `userModel.js:258` touches SQL.

- [ ] **Step 1: Write the failing tests**

```js
test("GET /api/public/theses returns repository items of type thesis", async () => { /* 200, each item.repository_type === 'thesis' */ });
test("/api/theses is gone", async () => { /* 404 */ });
test("profile stats count thesis repository items", async () => { /* theses_count matches */ });
```

- [ ] **Step 2: Run to confirm failure.**

- [ ] **Step 3: Implement** — rewrite the three public/model functions on `posts`; delete the four files; remove the mount; delete `createThesisSchema` / `updateThesisSchema` and their exports.

- [ ] **Step 4: Run** — `cd backend && node --require dotenv/config --test` → 0 failing.

- [ ] **Step 5: Commit**

```bash
git commit -am "refactor(backend): serve theses from posts"
```

---

### Task 15: Backend — moderation, reports, admin

**Files:**
- Modify: `backend/services/moderationService.js`, `backend/models/reportModel.js`, `backend/models/adminModel.js`, `backend/controllers/moderationController.js`, `backend/controllers/adminController.js`, `backend/services/storageCleanup.js`
- Test: `backend/tests/admin.test.js`, `backend/tests/messageReports.test.js`

**Interfaces:**
- Produces: `reports.target_type` no longer accepts `'thesis'`; moderation and admin counters read `posts` only.

- [ ] **Step 1: Write the failing tests** — reporting a thesis by id now creates a `post` report; admin thesis counters equal post counts.

- [ ] **Step 2: Run to confirm failure.**

- [ ] **Step 3: Implement** — replace every thesis query with the posts filter; update the `reports.target_type` CHECK to `('post','repost','comment','message','profile')`.

- [ ] **Step 4: Run** — full backend suite, 0 failing.

- [ ] **Step 5: Commit**

```bash
git commit -am "refactor(moderation): thesis targets are posts"
```

---

### Task 16: Frontend — thesis surfaces read posts

**Files:**
- Modify: `frontend/app/upload-thesis.tsx` → replace with a redirect to `/create?kind=repository&repository_type=thesis`
- Modify: `frontend/app/(tabs)/capstones.tsx`, `frontend/app/(tabs)/search.tsx:116-165`, `frontend/app/(tabs)/index.tsx:240-300`, `frontend/app/profile/[id].tsx:90-95`, `frontend/src/components/profile/ProfileThesesList.tsx`, `frontend/src/components/profile/useProfileData.ts`, `frontend/src/lib/api.ts:254-290`, `frontend/app/saved.tsx`
- Test: `frontend/src/lib/feedFilters.test.ts`

**Interfaces:**
- Produces: all thesis lists call `GET /api/posts?kind=repository&repository_type=thesis`; the PDF is `attachments[0].url`.

- [ ] **Step 1: Write the failing test** — `matchesFeedFilter` handles `thesis` and the profile list maps `attachments` to a download URL.

- [ ] **Step 2: Run to confirm failure.**

- [ ] **Step 3: Implement** — replace `apiFetch("/theses")` call sites with the posts query; replace `pdf_url` reads with the first `application/pdf` attachment; keep `upload-thesis.tsx` as a `Redirect` so old links and notifications do not 404.

- [ ] **Step 4: Run all gates.**

- [ ] **Step 5: Commit**

```bash
git commit -am "refactor(frontend): thesis surfaces read repository posts"
```

**Part 2 gate:** deposit a thesis through the composer, see it in Repositories, Capstones, the profile tab, and search; download the PDF; a guest sees metadata but no PDF.

---

# Part 3 — Mentions

Depends on the identity work (`c0231b5`) and `services/identity.js`.

> This part supersedes phases 2–7 of `C:\Users\mark\.opencode\plan\2026-11-17-mentions.md`. That file remains useful for the UX rationale and the `MentionInput` behaviour notes, but its data model and phase list are replaced by Tasks 17–22.

### Task 17: Migration — mentions and the authorization function

**Files:**
- Create: `backend/migrations/056_post_mentions.sql`
- Test: `backend/tests/mentionAuth.test.js`

**Interfaces:**
- Produces: table `post_mentions(post_id, comment_id, mentioned_user_id, created_at)`; function `can_mention(author text, target text) → boolean`.

- [ ] **Step 1: Write the failing test**

```js
test("friends can mention across departments", async () => {
  assert.equal((await db.query(`SELECT can_mention($1,$2) c`, [friendA, friendB])).rows[0].c, true);
});
test("same-department non-friends can mention each other", async () => { /* true */ });
test("strangers in different departments cannot", async () => { /* false */ });
test("a guest is never mentionable", async () => { /* false */ });
```

- [ ] **Step 2: Run to confirm failure.**

- [ ] **Step 3: Implement**

```sql
CREATE TABLE public.post_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  mentioned_user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX post_mentions_unique_idx
  ON public.post_mentions (post_id, COALESCE(comment_id, '00000000-0000-0000-0000-000000000000'::uuid), mentioned_user_id);

CREATE OR REPLACE FUNCTION public.can_mention(author text, target text)
RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles a JOIN public.profiles t ON t.id = target
    WHERE a.id = author AND a.id <> target
      AND COALESCE(t.role,'student') <> 'guest'
      AND (
        public.is_friend(author, target)
        OR (a.department_id IS NOT NULL AND a.department_id = t.department_id)
      )
  );
$$;
```

- [ ] **Step 4: Apply and run** — PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/056_post_mentions.sql backend/tests/mentionAuth.test.js
git commit -m "feat(mentions): persistence and friend-or-department rule"
```

---

### Task 18: Mention service and autocomplete

**Files:**
- Create: `backend/services/mentions.js`
- Modify: `backend/routes/userRouter.js` (add `GET /mentionable` **before** `/:id`), `backend/controllers/userController.js`
- Test: `backend/tests/mentions.test.js`

**Interfaces:**
- Produces:
  - `getMentionableUsers(authorId, q, limit=8) → [{ id, username, full_name, avatar_url }]`
  - `resolveMentionIds(authorId, text, explicitIds, { visibility }) → { allowed: string[], rejected: string[] }`
  - `replacePostMentions(postId, commentId|null, ids)` 
  - `GET /api/users/mentionable?q=` → `{ users: [...] }`

- [ ] **Step 1: Write the failing tests** — autocomplete excludes non-friends in other departments, guests, and self; `resolveMentionIds` returns rejected ids instead of dropping them.

- [ ] **Step 2: Run to confirm failure.**

- [ ] **Step 3: Implement** — one SQL query for autocomplete:

```sql
SELECT p.id, p.username, p.full_name, p.avatar_url
FROM public.profiles p
WHERE p.id <> $1
  AND COALESCE(p.role,'student') <> 'guest'
  AND p.username IS NOT NULL
  AND p.username ILIKE $2
  AND (public.is_friend($1, p.id)
       OR (a.department_id IS NOT NULL AND a.department_id = p.department_id))
ORDER BY p.full_name
LIMIT $3
```

`extractTokens(text)` matches `@([a-z0-9._]{3,30})`; tokens are resolved to ids and unioned with `explicitIds`, then filtered through `can_mention`.

- [ ] **Step 4: Run** — `node --require dotenv/config --test tests/mentions.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(mentions): autocomplete and server-side resolution"
```

---

### Task 19: Wire mentions into create, update, and comments

**Files:**
- Modify: `backend/validation/index.js` (`mention_ids` on post and comment schemas), `backend/controllers/postController.js` (`createPost`, `updatePost`, `addComment`), `backend/models/postModel.js` (return `mentions` in projections)
- Test: `backend/tests/mentions.test.js`

**Interfaces:**
- Consumes: `resolveMentionIds`, `replacePostMentions` (Task 18).
- Produces: `400 { code: "mention_not_allowed", rejected: [...] }`; posts return `mentions: [{ user_id, username, full_name }]`.

- [ ] **Step 1: Write the failing tests**

```js
test("a post mentioning a stranger returns 400 mention_not_allowed", async () => { /* exact code + rejected ids */ });
test("a post mentioning a friend in another department succeeds", async () => { /* 201 */ });
test("a public post cannot mention a same-department non-friend", async () => { /* 400, rejected contains the id */ });
test("a department post can mention a same-department non-friend", async () => { /* 201 */ });
test("a comment mention is stored with comment_id", async () => { /* row has comment_id */ });
test("deleting a post removes its mentions", async () => { /* zero rows */ });
```

- [ ] **Step 2: Run to confirm failure.**

- [ ] **Step 3: Implement** — validate, resolve, reject on any `rejected.length > 0`, then write mentions inside the post/comment transaction. The visibility refinement lives in `resolveMentionIds`: when `visibility === "public"`, a target is allowed only if `is_friend`; when `visibility` is `department`, `custom`, or `friends`, the base rule (friends ∪ department) applies. Add `mentions` to the projection via `json_agg` joined to `profiles` for the **current** username.

- [ ] **Step 4: Run** — full backend suite, 0 failing.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(mentions): enforce mention rule on posts and comments"
```

---

### Task 20: Notifications

**Files:**
- Modify: `backend/services/notificationService.js`, `backend/controllers/notificationController.js`
- Test: `backend/tests/notifications.test.js`

**Interfaces:**
- Produces: `type = 'mention'` notification per mentioned user, never for the author.

- [ ] **Step 1: Write the failing tests** — one row per mention, no self-notification, message reads `@<username> mentioned you`.

- [ ] **Step 2: Run to confirm failure.**

- [ ] **Step 3: Implement** — insert inside the same transaction as the mention rows.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(mentions): notify mentioned users"
```

---

### Task 21: MentionInput and RichText

**Files:**
- Create: `frontend/src/components/mentions/MentionInput.tsx`, `frontend/src/components/mentions/RichText.tsx`, `frontend/src/lib/mentions.ts`
- Test: `frontend/src/lib/mentions.test.ts`

**Interfaces:**
- Produces: `useMentionQuery(text, caret) → { query, replaceRange }`; `renderMentions(text, mentions) → segments`.

- [ ] **Step 1: Write the failing test**

```ts
it("finds the token under the caret", () => {
  expect(mentionQueryAt("hello @mar", 10)).toEqual({ query: "mar", start: 6 });
  expect(mentionQueryAt("hello @mar ", 11)).toBeNull();
});
it("renders only known mentions as links", () => {
  expect(renderMentions("hi @mark @ghost", [{ username:"mark" }]))
    .toEqual([{ text:"hi " }, { text:"@mark", username:"mark" }, { text:" @ghost" }]);
});
```

- [ ] **Step 2: Run to confirm failure.**

- [ ] **Step 3: Implement** — debounce autocomplete 150 ms; keyboard navigation with arrow keys and Enter; Escape closes. `RichText` renders a `<Link>` for known mentions and plain text otherwise.

- [ ] **Step 4: Run** — `npx vitest run && npx tsc -p tsconfig.json --noEmit` → PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(mentions): input and renderer"
```

---

### Task 22: Wire mention UI

**Files:**
- Modify: `frontend/app/create.tsx` (caption field), `frontend/app/post/[id].tsx` (comment composer + body render), `frontend/src/components/PostCard.tsx` (body render), `frontend/src/components/PostComposer.tsx` (quick composer), `frontend/app/(tabs)/notifications.tsx` (mention row)
- Test: `frontend/src/components/PostCard.test.tsx`

- [ ] **Step 1: Write the failing test** — a post body with a mention renders a link to `/profile/<id>`.

- [ ] **Step 2: Run to confirm failure.**

- [ ] **Step 3: Implement** — replace the plain `TextInput` with `MentionInput` in the three composers; replace plain body text with `RichText`; send `mention_ids` from the resolved token list.

- [ ] **Step 4: Run all gates.**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(mentions): wire composer, cards, and comments"
```

---

### Task 23: Contract migration

**Files:**
- Create: `backend/migrations/057_drop_legacy_post_columns.sql`
- Modify: `backend/models/postModel.js` (remove `withDerivedImages`)
- Test: `backend/tests/repositorySchema.test.js`

- [ ] **Step 1: Write the failing test** — `posts.type`, `posts.image_url`, `posts.image_urls` no longer exist.
- [ ] **Step 2: Run to confirm failure.**
- [ ] **Step 3: Implement** — `ALTER TABLE posts DROP COLUMN type, DROP COLUMN image_url, DROP COLUMN image_urls;` and delete the derived-image helper.
- [ ] **Step 4: Run all gates.**
- [ ] **Step 5: Commit**

```bash
git commit -am "chore(db): drop legacy post columns"
```

---

## Execution order

| Step | Part | Tasks | Why |
|---|---|---|---|
| 1 | Baseline | — | Measure the five gates before touching anything |
| 2 | Part 1 | 1–12 | Ships Repositories + attachments on its own |
| 3 | Part 2 | 13–16 | Deletes the parallel thesis path |
| 4 | Part 3 | 17–22 | Mentions, independent of Parts 1–2 except the composer |
| 5 | Contract | 23 | Only after Parts 1–2 are deployed |

## Out of scope

- Hashtags / topic taxonomy (`#`) — a separate feature; mentions are not replaced by it.
- Chat mentions.
- `@everyone` / `@here`.
- Guests writing anything.
- Renaming students — permanently excluded.
- Converting existing `website` posts into a distinct type; they become `repository/project` with `live_url`.
