# Feed, Sharing & Privacy Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repost, report, block and banner-dismiss features actually work end-to-end, and remove the dead code that hides their breakage.

**Architecture:** The features were built on both sides but never joined: controllers call `visiblePostsFor` with the wrong argument shape, the client calls four URL paths the server does not serve, and two UI components are never mounted. Fix the joins, delete the dead paths, add one regression test per join.

**Tech Stack:** Express 5 + `pg` (backend), Expo SDK 58 / React Native + Expo Router (frontend), Jest/Supertest (`node:test`-style `npm test`), TypeScript.

**Spec:** `implementation_plans/feed-post-actions-sharing-privacy-navigation-overhaul.md` (claimed scope) plus the verified defect list in this document's task descriptions. Where the spec and this plan disagree, this plan wins — the spec's claims were checked against the code and several are false.

## Global Constraints

- Backend suite must end at **356 or more tests passing, 0 failing**. Any route move must update its tests in the same task.
- `cd frontend; npx tsc --noEmit` must exit 0. `npm run lint` must stay at **0 errors** (14 warnings is the current baseline; do not add warnings).
- Do **not** edit `backend/migrations/*.sql` — migrations `024`–`030` are already applied to the live database. Every schema change needed here already exists.
- Do not add dependencies.
- All new backend handlers stay inside existing controllers; new files are routers only.
- The working tree is dirty (`M`/`MM`/`A` files plus untracked `DesktopLayout.tsx`). Commit the baseline before Task 1 so every later test result is comparable.

## Review Focus

1. **A guest (no session) opening the feed** — must see public posts only. `visiblePostsFor` currently receives `viewerId = null` by accident; after the fix it must still be `null` for guests and the *caller's id* for signed-in users. Wrong direction here leaks private posts.
2. **A signed-in user searching `?q=`, filtering `?author_id=`, or paginating `?cursor=`** — filters are silently dropped today. After the fix, a filter that matches nothing must return an empty list, not the whole feed.
3. **Reposting the same post twice** — must return `409` with a readable message, never `500`, and must create exactly one notification row.
4. **Reporting or blocking from the post menu as a non-owner** — must reach a real endpoint. A `404 Not Found` rendered as "Failed to submit report" is the current behavior and is the failure this plan exists to remove.
5. **Dismissing the identity banner** — the banner must disappear immediately and stay gone after an app reload; a silent 404 that leaves the banner up is the current behavior.

---

## File Structure

**Backend**
- `controllers/postController.js` — fix call sites, remove duplicate notification, align error codes, delete report/block handlers after they move.
- `controllers/socialController.js` — add `dismissBanner`; delegate block handlers to `blockModel`.
- `models/notificationModel.js` — write `repost_id`.
- `models/postModel.js` — no functional change; leave `getAllPosts`/`getPostById` (still used by public + moderation paths).
- `routes/reportRouter.js` *(new)* — `POST /`, `GET /`, `PUT /:id`.
- `routes/blockRouter.js` *(new)* — `POST /`, `GET /`, `DELETE /:blockedId`.
- `routes/postRouter.js` — drop report/block routes.
- `routes/socialRouter.js` — add `PATCH /me/banner-dismissed`.
- `app.js` — mount the two new routers at `/api/reports` and `/api/blocks`.
- `validation/index.js` — add `allow_reposts` to `postFields`.

**Frontend**
- `src/lib/api.ts` — correct 4 paths, delete 2 dead functions.
- `src/components/PostCard.tsx` — mount `PostMenu` for all viewers, wire report/block dialogs, real `onClose`.
- `src/components/PostMenu.tsx` — drop inline Alert report/block; take `onReport`/`onBlock` props.
- `src/components/IdentityBanner.tsx` — optimistic hide + profile refresh.
- `app/create.tsx` — `allow_reposts` toggle.
- `app/post-settings.tsx` *(new)* — edit-screen target that `PostMenu` already navigates to.
- `implementation_plans/feed-post-actions-sharing-privacy-navigation-overhaul.md` — correct status counts.

---

### Task 0: Baseline commit

**Files:** none modified.

- [ ] **Step 1: Confirm the tree state**

Run: `git status --short`
Expected: the dirty list already known (backend + frontend feature work, untracked `frontend/src/components/DesktopLayout.tsx`).

- [ ] **Step 2: Record the baseline**

Run: `cd backend; npm test 2>&1 | Select-Object -Last 6`
Expected: `tests 356`, `pass 356`, `fail 0`. Note the number; later tasks compare against it.

- [ ] **Step 3: Commit the in-progress feature work as one baseline commit**

```bash
git add -A
git commit -m "wip: feed/repost/report/block feature work baseline"
```

---

### Task 1: Fix `visiblePostsFor` call sites

**Files:**
- Modify: `backend/controllers/postController.js:35`, `:51`, `:310`
- Test: `backend/tests/routes.test.js`

**Interfaces:**
- Consumes: `postModel.visiblePostsFor({ viewerId, limit, cursor, q, authorId, type, visibility, postId, includeReposts, includeHidden })` — a **single object** argument, defined at `backend/models/postModel.js:278`.
- Produces: nothing new. `getPosts` must forward `req.user?.id` as `viewerId` and all query filters.

- [ ] **Step 1: Write the failing test**

In `backend/tests/routes.test.js`, next to the existing `visiblePostsFor` assertions:

```js
test("GET /posts passes a single options object with viewerId and filters", async () => {
  m.visiblePostsFor.setImpl(async () => ({ posts: [] }));
  await request(app)
    .get("/api/posts?q=react&visibility=public&limit=5")
    .set("Authorization", `Bearer ${token}`);

  const args = m.visiblePostsFor.calls.at(-1);
  assert.equal(args.length, 1, "visiblePostsFor must receive exactly one argument");
  assert.equal(typeof args[0], "object");
  assert.ok(args[0].viewerId, "viewerId must be the caller id");
  assert.equal(args[0].q, "react");
  assert.equal(args[0].visibility, "public");
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend; npm test -- --test-name-pattern="single options object"`
Expected: FAIL — `args.length` is `2`.

- [ ] **Step 3: Fix the three call sites**

`postController.js:35`, `:51`, `:310` — wrap the existing object and move the viewer in:

```js
const posts = await postModel.visiblePostsFor({
  viewerId: req.user?.id || null,
  limit: clampLimit(req.query.limit),
  cursor: req.query.cursor || null,
  q: parseSearch(req.query.q),
  authorId: author.value,
  visibility: req.query.visibility || null,
});
```

Apply the same shape at `getPost` (`postId`, `includeHidden: false`) and `getPostFile` (`viewerId`, `postId`, `includeHidden: false`).

- [ ] **Step 4: Run the whole backend suite**

Run: `cd backend; npm test 2>&1 | Select-Object -Last 6`
Expected: all pass, count >= 356 + 1.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/postController.js backend/tests/routes.test.js
git commit -m "fix(posts): pass visiblePostsFor a single options object with viewerId"
```

---

### Task 2: One repost notification, written to `repost_id`

**Files:**
- Modify: `backend/controllers/postController.js:354-365` (delete block), `backend/models/notificationModel.js:76-95`
- Test: `backend/tests/routes.test.js`

**Interfaces:**
- Consumes: `repostModel.createRepost(originalPostId, reposterId, caption)` — already inserts the notification inside its transaction (`backend/models/repostModel.js:98-116`).
- Produces: `createRepostNotification(originalAuthorId, reposterId, repostId)` writes `notifications.repost_id = repostId` and `target_id = repostId` for backward compatibility.

- [ ] **Step 1: Write the failing test**

```js
test("POST /posts/:id/repost creates exactly one repost notification", async () => {
  m.createRepost.setImpl(async () => ({ id: "repost-1" }));
  m.visiblePostsFor.setImpl(async () => ({ posts: [{ author_id: "author-1" }] }));

  await request(app).post("/api/posts/post-1/repost").set("Authorization", `Bearer ${token}`);

  assert.equal(m.createRepostNotification.calls.length, 1);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend; npm test -- --test-name-pattern="exactly one repost notification"`
Expected: FAIL — call count is `2` (model + controller).

- [ ] **Step 3: Delete the controller's notification block**

Remove `postController.js:354-365` (the `visiblePostsFor(...)` lookup plus `createRepostNotification` call). `createRepost` then ends at `res.status(201).json(repost);`.

- [ ] **Step 4: Write `repost_id` in the model**

In `notificationModel.js`, change the insert to:

```js
`INSERT INTO notifications (user_id, actor_id, type, target_id, repost_id, message)
 VALUES ($1, $2, 'repost', $3, $3, $4)
 RETURNING *`,
[originalAuthorId, reposterId, repostId, `${reposterId} reposted your post`]
```

- [ ] **Step 5: Run the suite**

Run: `cd backend; npm test 2>&1 | Select-Object -Last 6`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/postController.js backend/models/notificationModel.js backend/tests/routes.test.js
git commit -m "fix(reposts): emit one notification, recorded in notifications.repost_id"
```

---

### Task 3: Map repost errors to HTTP codes

**Files:**
- Modify: `backend/controllers/postController.js:368-383`
- Test: `backend/tests/routes.test.js`

**Interfaces:**
- Consumes: codes thrown by `repostModel.createRepost` — `POST_NOT_FOUND`, `REPOSTS_NOT_ALLOWED`, `BLOCKED`, `ALREADY_REPOSTED`.
- Produces: `409` for `ALREADY_REPOSTED`, `403` for `REPOSTS_NOT_ALLOWED` and `BLOCKED`, `404` for `POST_NOT_FOUND`, `next(error)` otherwise.

- [ ] **Step 1: Write the failing test**

```js
test("POST /posts/:id/repost returns 409 for a duplicate repost", async () => {
  const err = new Error("already");
  err.code = "ALREADY_REPOSTED";
  m.createRepost.setImpl(async () => { throw err; });

  const res = await request(app)
    .post("/api/posts/post-1/repost")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 409);
  assert.equal(res.body.error, "Already reposted this post");
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend; npm test -- --test-name-pattern="409 for a duplicate repost"`
Expected: FAIL — status `500`.

- [ ] **Step 3: Rewrite the catch block**

Replace the three `if (error.code === ...)` branches with a lookup:

```js
const REPOST_ERRORS = {
  ALREADY_REPOSTED: [409, "Already reposted this post"],
  REPOSTS_NOT_ALLOWED: [403, "Reposting is disabled for this post"],
  BLOCKED: [403, "Cannot repost: blocked relationship"],
  POST_NOT_FOUND: [404, "Original post not found or not visible"],
};
```

In `catch`, resolve `REPOST_ERRORS[error.code]` and `return res.status(code).json({ error: message })` when present, else `next(error)`.

- [ ] **Step 4: Run the suite**

Run: `cd backend; npm test 2>&1 | Select-Object -Last 6`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/postController.js backend/tests/routes.test.js
git commit -m "fix(reposts): return 409/403/404 instead of 500 for repost errors"
```

---

### Task 4: Serve reports and blocks at the URLs the client calls

**Files:**
- Create: `backend/routes/reportRouter.js`, `backend/routes/blockRouter.js`
- Modify: `backend/routes/postRouter.js:25-33`, `backend/app.js` (after the `/api/posts` mount)
- Test: `backend/tests/routes.test.js`

**Interfaces:**
- Consumes: `postController.createReport`, `listReports`, `updateReportStatus`, `blockUser`, `unblockUser`, `listBlocked` — signatures unchanged.
- Produces: `POST /api/reports`, `GET /api/reports`, `PUT /api/reports/:id`, `POST /api/blocks`, `GET /api/blocks`, `DELETE /api/blocks/:blockedId`. Client calls `apiJson("/reports")` and `apiJson("/blocks")` against baseURL `.../api`, so these exact paths are required.

- [ ] **Step 1: Write the failing tests**

```js
test("POST /api/reports reaches createReport", async () => {
  m.createReport.setImpl(async () => ({ id: "r1" }));
  const res = await request(app)
    .post("/api/reports")
    .set("Authorization", `Bearer ${token}`)
    .send({ targetType: "post", targetId: "p1", reason: "spam" });
  assert.equal(res.status, 201);
});

test("POST /api/blocks reaches blockUser", async () => {
  m.blockUser.setImpl(async () => ({ id: "b1" }));
  const res = await request(app)
    .post("/api/blocks")
    .set("Authorization", `Bearer ${token}`)
    .send({ blockedId: "u2" });
  assert.equal(res.status, 201);
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd backend; npm test -- --test-name-pattern="reaches createReport|reaches blockUser"`
Expected: FAIL — status `404`.

- [ ] **Step 3: Create the two routers**

```js
// backend/routes/reportRouter.js
const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const { requireVerified } = require("../middleware/auth");

router.post("/", requireVerified, postController.createReport);
router.get("/", requireVerified, postController.listReports);
router.put("/:id", requireVerified, postController.updateReportStatus);

module.exports = router;
```

```js
// backend/routes/blockRouter.js
const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const { requireVerified } = require("../middleware/auth");

router.post("/", requireVerified, postController.blockUser);
router.get("/", requireVerified, postController.listBlocked);
router.delete("/:blockedId", requireVerified, postController.unblockUser);

module.exports = router;
```

- [ ] **Step 4: Remove the old routes and mount the new ones**

Delete the `// Reports` and `// Blocks` blocks from `postRouter.js` (lines 25–33). In `app.js`, after the `/api/posts` mount, add the same middleware chain used there:

```js
app.use("/api/reports", auth.requireAuth, auth.loadProfile, auth.requireActiveAccount, reportRouter);
app.use("/api/blocks", auth.requireAuth, auth.loadProfile, auth.requireActiveAccount, blockRouter);
```

- [ ] **Step 5: Update existing tests that used the old paths**

Run: `cd backend; npm test 2>&1 | Select-String -Pattern "fail|✖" | Select-Object -First 20`
Replace every `/api/posts/reports` with `/api/reports` and `/api/posts/blocks` with `/api/blocks` in `backend/tests/*.js`.

- [ ] **Step 6: Run the suite**

Run: `cd backend; npm test 2>&1 | Select-Object -Last 6`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add backend/routes/reportRouter.js backend/routes/blockRouter.js backend/routes/postRouter.js backend/app.js backend/tests
git commit -m "fix(routes): serve reports and blocks at /api/reports and /api/blocks"
```

---

### Task 5: `PATCH /me/banner-dismissed`

**Files:**
- Modify: `backend/controllers/socialController.js` (add handler + export), `backend/routes/socialRouter.js`, `frontend/src/lib/api.ts:306`, `frontend/src/components/IdentityBanner.tsx:43-50`
- Test: `backend/tests/routes.test.js`

**Interfaces:**
- Consumes: `profiles.profile_banner_dismissed` (exists in the live DB, migration `028`).
- Produces: `PATCH /api/users/me/banner-dismissed` → `200 { profile_banner_dismissed: true }`.

- [ ] **Step 1: Write the failing test**

```js
test("PATCH /api/users/me/banner-dismissed sets the flag", async () => {
  const res = await request(app)
    .patch("/api/users/me/banner-dismissed")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.profile_banner_dismissed, true);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend; npm test -- --test-name-pattern="banner-dismissed sets the flag"`
Expected: FAIL — status `404`.

- [ ] **Step 3: Add the handler**

In `socialController.js`, following the existing handler style:

```js
const dismissBanner = async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE profiles SET profile_banner_dismissed = TRUE WHERE id = $1
       RETURNING profile_banner_dismissed`,
      [req.user.id]
    );
    res.json({ profile_banner_dismissed: result.rows[0]?.profile_banner_dismissed ?? true });
  } catch (error) {
    next(error);
  }
};
```

Export it, and register in `socialRouter.js`:

```js
router.patch("/me/banner-dismissed", socialController.dismissBanner);
```

- [ ] **Step 4: Point the client at the real path**

`api.ts:306`: `apiJson("/users/me/banner-dismissed", { method: "PATCH" })` (body no longer needed; the flag is implied).

- [ ] **Step 5: Hide the banner immediately**

In `IdentityBanner.tsx`, set a local `dismissed` state to `true` before awaiting, and on failure set it back to `false` and log. Render `null` when `dismissed || profile?.profile_banner_dismissed`.

- [ ] **Step 6: Verify**

Run: `cd backend; npm test 2>&1 | Select-Object -Last 6`
Run: `cd frontend; npx tsc --noEmit; npm run lint 2>&1 | Select-Object -Last 3`
Expected: tests pass; `TSC` exit 0; `0 errors`.

- [ ] **Step 7: Commit**

```bash
git add backend/controllers/socialController.js backend/routes/socialRouter.js backend/tests/routes.test.js frontend/src/lib/api.ts frontend/src/components/IdentityBanner.tsx
git commit -m "feat(profile): dismiss identity banner via PATCH /me/banner-dismissed"
```

---

### Task 6: Delete the dead client endpoints

**Files:**
- Modify: `frontend/src/lib/api.ts` (remove `updateRepostCaption` at ~256 and `getFeed` at ~316)
- Modify: `implementation_plans/feed-post-actions-sharing-privacy-navigation-overhaul.md:195`, `:224`

**Interfaces:**
- Consumes: nothing.
- Produces: `api.ts` exports no function whose path has no server route. Verified unused: `grep -r "updateRepostCaption\|getFeed" frontend/` returns only the definitions.

- [ ] **Step 1: Confirm both are unused**

Run: `Select-String -Path frontend\src\**\*.tsx,frontend\app\**\*.tsx -Pattern 'updateRepostCaption|getFeed'`
Expected: no matches outside `api.ts`.

- [ ] **Step 2: Delete both functions**

Remove `updateRepostCaption` and `getFeed` with their section comments.

- [ ] **Step 3: Verify**

Run: `cd frontend; npx tsc --noEmit; npm run lint 2>&1 | Select-Object -Last 3`
Expected: exit 0, `0 errors`.

- [ ] **Step 4: Mark the plan tasks as dropped**

Change plan lines 195 (`3.3`) and 224 (`3.9`) to: `- [x] **3.3** Dropped — repost captions are immutable; no route, no client function.`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts implementation_plans/feed-post-actions-sharing-privacy-navigation-overhaul.md
git commit -m "chore(api): delete client functions for routes that never existed"
```

---

### Task 7: Give every viewer a working post menu

**Files:**
- Modify: `frontend/src/components/PostCard.tsx:247-258`, `:83-85`, `:153-170`
- Modify: `frontend/src/components/PostMenu.tsx:1-16`, `:74-150`, `:186-209`

**Interfaces:**
- Consumes: `ReportDialog({ targetType, targetId, isOpen, onClose, onSuccess })` and `BlockConfirmDialog({ targetUserId, targetUserName, isOpen, onClose, onBlocked })` — both already rendered by `PostCard` but never opened.
- Produces: `PostMenu({ post, onClose, onEdit?, onDelete?, onRepost?, onReport, onBlock })`.

- [ ] **Step 1: Confirm the dead states**

Run: `Select-String -Path frontend\src\components\PostCard.tsx -Pattern 'setReportDialogOpen|setBlockDialogOpen'`
Expected: only the `useState` declarations — never called with `true`. This is the bug.

- [ ] **Step 2: Render the menu for everyone**

In `PostCard.tsx`, replace `{isOwner && (<PostMenu ... />)}` with an always-rendered menu guarded only by its own open state. Add an `open` prop (`{menuOpen ? <PostMenu ... /> : null}`) and a three-dot trigger for all viewers.

- [ ] **Step 3: Replace the menu's inline Alerts with callbacks**

In `PostMenu.tsx`, delete `handleReport` and `handleBlock` (lines 89–132), the `createReport`/`blockUser` imports, and call the new props instead:

```tsx
<TouchableOpacity style={styles.item} onPress={() => { onClose(); onReport(); }}>
```

- [ ] **Step 4: Wire the callbacks in PostCard**

```tsx
onReport={() => setReportDialogOpen(true)}
onBlock={() => setBlockDialogOpen(true)}
onClose={() => setMenuOpen(false)}
```

- [ ] **Step 5: Verify**

Run: `cd frontend; npx tsc --noEmit; npm run lint 2>&1 | Select-Object -Last 3`
Expected: exit 0, `0 errors`.

- [ ] **Step 6: Manual check**

Open the feed as a non-owner, tap the three-dot menu, choose Report → `ReportDialog` opens; choose Block → `BlockConfirmDialog` opens. Tapping the backdrop closes the menu.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/PostCard.tsx frontend/src/components/PostMenu.tsx
git commit -m "fix(feed): show post menu to all viewers and open the real report/block dialogs"
```

---

### Task 8: `allow_reposts` end-to-end, plus the missing settings screen

**Files:**
- Modify: `backend/validation/index.js:96-106`
- Create: `frontend/app/post-settings.tsx`
- Modify: `frontend/app/create.tsx` (step 3), `frontend/src/lib/api.ts` (`updatePost` already accepts a body)

**Interfaces:**
- Consumes: `postModel.updatePost` already whitelists `allow_reposts` (`postModel.js:527`); only validation blocks it.
- Produces: `allow_reposts?: boolean` accepted by `POST /api/posts` and `PUT /api/posts/:id`; screen at route `/post-settings?postId=<id>`.

- [ ] **Step 1: Write the failing backend test**

```js
test("POST /api/posts accepts allow_reposts and still rejects unknown fields", async () => {
  m.createPost.setImpl(async () => ({ id: "p1" }));
  const ok = await request(app).post("/api/posts")
    .set("Authorization", `Bearer ${token}`)
    .send({ content: "hi", type: "text", allow_reposts: false });
  assert.equal(ok.status, 201);

  const bad = await request(app).post("/api/posts")
    .set("Authorization", `Bearer ${token}`)
    .send({ content: "hi", type: "text", nonsense: true });
  assert.equal(bad.status, 400);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend; npm test -- --test-name-pattern="accepts allow_reposts"`
Expected: FAIL — status `400` for the first request (`.strict()` rejects the field).

- [ ] **Step 3: Add the field to the schema**

In `validation/index.js` `postFields`, add `allow_reposts: z.boolean().optional(),`.

- [ ] **Step 4: Build the settings screen**

`frontend/app/post-settings.tsx` — load the post, render the visibility selector (reuse the options used in `create.tsx`) and an `allow_reposts` switch, and submit with `updatePost(postId, { visibility, audience, allow_reposts })`. `PostMenu` already pushes this route; no navigation change needed.

- [ ] **Step 5: Add the toggle to `create.tsx`**

In step 3, an `allow_reposts` switch defaulting to `true`, sent in the create payload.

- [ ] **Step 6: Verify**

Run: `cd backend; npm test 2>&1 | Select-Object -Last 6`
Run: `cd frontend; npx tsc --noEmit; npm run lint 2>&1 | Select-Object -Last 3`
Expected: tests pass; exit 0; `0 errors`.

- [ ] **Step 7: Commit**

```bash
git add backend/validation/index.js backend/tests/routes.test.js frontend/app/post-settings.tsx frontend/app/create.tsx
git commit -m "feat(posts): allow_reposts is settable on create, edit and settings screen"
```

---

### Task 9: Correct the plan document's status

**Files:**
- Modify: `implementation_plans/feed-post-actions-sharing-privacy-navigation-overhaul.md` (header + checkboxes)

- [ ] **Step 1: Recount**

Run: `Select-String -Path implementation_plans\feed-post-actions-sharing-privacy-navigation-overhaul.md -Pattern '^\s*-\s*\[x\]' | Measure-Object | Select-Object -ExpandProperty Count`
Expected: a number you can defend. Use it in the header.

- [ ] **Step 2: Replace the false header claims**

Set `**Status:**` to the real count, replace `**Branch:** mark1e3 (ahead 3, behind 0)` with `**Branch:** mark1e3` (there is no upstream divergence), and add one line: `**Verified:** 2026-11-10 against code, tests and live DB — see cleanup plan.`

- [ ] **Step 3: Tick only what the code does**

`3.3`/`3.9` are dropped (Task 6). `3.8` is done (Task 5). `4.3` is done. `4.4` is done (Task 8). Leave anything unbuilt unticked.

- [ ] **Step 4: Commit**

```bash
git add implementation_plans/feed-post-actions-sharing-privacy-navigation-overhaul.md
git commit -m "docs(plan): correct status counts to match verified state"
```

---

### Task 10 (optional, higher risk): One block implementation

**Files:**
- Modify: `backend/controllers/socialController.js:82-110`, `backend/routes/socialRouter.js:31-33`, `backend/models/socialModel.js:31-45`

**Interfaces:**
- Consumes: `blockModel.blockUser(blockerId, blockedId)`, `unblockUser`, `listBlocked` — bidirectional, the newer implementation.
- Produces: a single block write path. `socialModel.isBlocked` stays (messaging and friend requests depend on it).

- [ ] **Step 1: Write a failing test**

```js
test("blocking is bidirectional after POST /api/blocks", async () => {
  await request(app).post("/api/blocks").set("Authorization", `Bearer ${token}`).send({ blockedId: "u2" });
  const back = await request(app).get("/api/blocks").set("Authorization", `Bearer ${tokenB}`);
  assert.equal(back.body.some((b) => b.id === "u1"), true);
});
```

- [ ] **Step 2: Confirm the duplicate paths**

Run: `Select-String -Path backend\controllers\socialController.js,backend\controllers\postController.js -Pattern 'const (blockUser|unblockUser|listBlocked)'`
Expected: two of each.

- [ ] **Step 3: Point `socialController` at `blockModel`**

Replace the bodies of `socialController.blockUser`/`unblockUser`/`listBlocked` with calls to `blockModel`, keeping the existing `/me/blocks` and `/:id/block` routes working. Delete `socialModel.listBlocked` once unused.

- [ ] **Step 4: Verify**

Run: `cd backend; npm test 2>&1 | Select-Object -Last 6`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/socialController.js backend/models/socialModel.js backend/tests
git commit -m "refactor(blocks): route all block writes through blockModel"
```

---

## Out of Scope

- The 22 orphan `admin_<suffix>@lccbonline.edu.ph` profiles and the reverse-signup flow — tracked in `implementation_plans/2026-11-06-reverse-signup-ghost-cleanup.md`.
- `seed-test-users.js` not setting `verification_status` — separate seed fix.
- Adding `GRANT SELECT ON mfa_factors` to migration `019` — the grant exists in the live DB; editing an applied migration is not safe.
- Extracting `VisibilityBadge` into its own file — the inline function in `PostCard.tsx:55` works; extraction is churn.
- Frontend test infrastructure — this plan verifies frontend work with `tsc`, lint and a manual checklist.

## Self-Review

- **Spec coverage:** every defect from the verification pass maps to a task — wrong `visiblePostsFor` shape (1), duplicate notification (2), wrong error codes (3), missing report/block URLs (4), missing banner route (5), dead client functions (6), owner-only menu + never-opened dialogs (7), rejected `allow_reposts` + missing `/post-settings` (8), false plan status (9), duplicate block logic (10).
- **Step scan:** each step names one file, one command, or one code shape. No "handle edge cases" lines.
- **Type consistency:** `viewerId` is the only renamed key; `createRepostNotification` keeps its three-argument signature; `PostMenu` gains exactly two props, both required.
- **Review Focus:** all five lines have a task that exercises them — guest/filter behavior (Task 1 test), duplicate repost (Task 3 test), non-owner report/block (Tasks 4 + 7), banner dismissal (Task 5 test).
- **Proportion:** ten tasks, most under 30 lines of change. The largest is Task 8's new screen, which is a UI surface the code already links to.
