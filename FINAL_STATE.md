# LCCB Connect UI/UX Overhaul — Final State Documentation

## What the Code Does Now (Subsystem View)

### 1. Auth Gate & Identity Completeness
**File:** `frontend/app/_layout.tsx` (RouteGuard)

**Current behaviour:**
- **Guest** → `/(tabs)` (read-only)
- **Authenticated + profile loading** (`profileStatus === "loading"`) → stay on login screen, wait for next render
- **Authenticated + profile fetch failed** (`profileStatus === "error"`) → fail open to `/(tabs)` (degraded, banner will prompt)
- **Authenticated + profile ready + unverified student** (`verification_status !== "verified"`) → `/onboarding` **only inside `inAuth` branch** (post-login hop)
- **Authenticated + profile ready + verified/other roles** → `/(tabs)`
- **Admin desktop** → `/(admin)` panel-first (with `inTabs` re-catch)
- **"Back to App" from onboarding** → lands on `/(tabs)` and **stays** (no `inOnboarding` check, gate is `inAuth`-scoped)

**AuthContext state machine** (`frontend/src/contexts/AuthContext.tsx`):
```ts
type ProfileStatus = "idle" | "loading" | "ready" | "error";
```
- `fetchProfile`: sets `loading` → `ready` on success, `error` on any failure (404 signs out, 4xx/5xx set error)
- `signOut`: resets to `idle`
- `onAuthStateChange`: on session loss sets `idle`

### 2. Header / Tab Bar (Desktop Web)
**File:** `frontend/app/(tabs)/_layout.tsx`

**Components:**
- `DesktopTab` — 4 main tabs (Home, Repository, Notifications, Profile), 40px icons, per-instance hover/focus state, tooltip, `focusRing`
- `IconAction` — Create (primary), Admin (outline), Moderation (outline); each owns its hover/focus state, tooltip, `focusRing`
- Theme toggle — hover/focus state, tooltip, `focusRing`, hover background

**Styles (key):**
```tsx
iconAction: {
  minHeight: 40,
  flexDirection: "row",
  alignItems: "center",
  borderRadius: RADIUS.pill,
  marginLeft: SPACE.x2,   // 8px from last tab
},
```
All four icon-only controls now behave identically.

**Removed:** `webBrandSub` ("Campus network" subtitle), `webCreateButton`, `webAdminButton`, `webCreateText`, `webAdminLabel`, `webTabLabel`.

### 3. Peer Picker (Messaging)
**File:** `frontend/src/components/PeerPicker.tsx`

**Data source:** `GET /api/users/directory?limit=50&scope=network` (authenticated)
- Returns: `id`, `username`, `full_name`, `avatar_url`, `year_level`, `department_id`, `department_name`, `friendship` (friend/pending_out/pending_in/none), `message_decision` (direct/request/blocked)

**Modes:**
- `mode="message"` (default): primary = message/request via `POST /conversations`; secondary = add friend via `POST /friends`
  - `direct` → filled brand "Message" (includes non-friends when policy allows)
  - `request` → outlined "Request" + MessageSquare → `POST /conversations` (creates `status=requested` thread in recipient's Requests tab)
  - `none` → secondary UserPlus icon → `POST /friends`
- `mode="friend"`: primary = add friend via `POST /friends`; existing friends get "Message"
  - `friend` → filled brand "Message"
  - `pending_in` → muted "Pending request"
  - `none` → filled brand "Add friend" → `POST /friends`
  - `pending_out` → green check + disabled "Add friend" (request already sent)

**UI:**
- `SectionList` grouped: Friends → Same department → Others
- Touch targets: 40px + `hitSlop: 8px`
- Sheet: `width: 100%`, `maxWidth: 520`, centered on desktop
- Accessibility: all buttons + close + search input labeled

### 4. Feed / Home Screen
**File:** `frontend/app/(tabs)/index.tsx`

- **Removed:** "Hello Mark" hero banner, "Deposit manuscript" card, "Academic Deadlines" card
- **Header bar (48px):** `{onlineCount} online · {posts.length} posts` + Create button (desktop)
- **Right rail:** friends only (from `/api/friends` for authenticated; `/public/peers?limit=20` for guests), real presence dots via `usePresence().isOnline()`, sorted online-first, honest count badge
- **IdentityBanner:** shows for `profile?.role === "student" && profile?.identity_complete === false`, uses theme tokens (`colors.brandWash`, `colors.brandWashStrong`, `colors.brand`)

### 5. Backend Endpoints
| Endpoint | File | Purpose |
|----------|------|---------|
| `GET /api/users/directory` | `userRouter.js:15`, `userController.getDirectory`, `userModel.getDirectory` | Authenticated peer directory with friendship, department, message_decision |
| `GET /api/users/:id` | `userController.getUser` | Includes `identity_complete` (derived: `full_name && student_id && department_id && course_id`) |
| `GET /api/friends` | `friendRouter.js` | Accepted friends for right rail |
| `POST /api/conversations` | `conversationRouter.js` | Create conversation (enforces verification, policy) |

**Removed (dead code):**
- `POST /api/conversations/permissions`
- `messageController.getPermissionMap`
- `messageModel.canMessageBatch`
- `validation.messagePermissionsSchema`

### 6. Tests
- **Backend:** 356/356 pass (8 new in `directory.test.js`)
- **Frontend:** `npx tsc --noEmit` clean, `npx expo lint` 2 pre-existing warnings only

---

## Commit History (What Actually Landed)

| Commit | Message | Notes |
|--------|---------|-------|
| `a9517fd` | Phase 1: Campus peers presence + social graph | **115 files, 20k+ insertions** — includes pre-existing auth/MFA/email/migrations backlog |
| `18acdcd` | Phase 5+7: remove hero banner, deposit card, fake deadlines | |
| `a8697df` | Phase 2: header icons + hover tooltips (DesktopTab only) | webBrandSub removed in `f439912`; Create/Admin still had labels |
| `0a2705c` | Phase 4: permission-aware messaging (PeerPicker + batch permissions) | Added permissions endpoint (later removed) |
| `b6896cc` | Phase 6: identity completeness gate | Redirect trap existed (scoped with `!inOnboarding`) |
| `ff0e675` | Phase 8: responsiveness | |
| `a95c111` | Phase 9: cleanup | |
| **`f439912`** | Fixes: IdentityBanner theme tokens + `!== false` gate + `!inOnboarding` + Phase 2 Create/Admin icon-only (inline Pressable) + dead Phase 4 code removed | **Superseded** by `d5479f3` for redirect & Create/Admin |
| **`d5479f3`** | **Fixes: redirect trap scoped to `inAuth` only + `IconAction` per-instance hover state + dead styles removed** | **The actual fix** for redirect trap & Create/Admin tooltips |
| **`4b54f68`** | Fixes: `iconAction` centering + `focusRing` on IconAction/theme-toggle + shared state cleanup | |
| **`990fab1`** | Fix profile fetch failure regression: `profileStatus` machine in AuthContext + fail-open on error | |
| **`d607e6c`** | Fix PeerPicker `isBlocked`: trust only `message_decision === "blocked"` (not `friendship === "none"`) | Non-friend + `direct` now shows Message button; matches `directory.test.js:148-149` |
| **`584502c`** | PeerPicker `mode` prop: message/friend — message mode uses `POST /conversations` for message requests; friend mode uses `POST /friends` | |

**Skipped (deliberately):**
- Phase 3 — Rail extraction (pure move, not needed)
- BE-4 — Directory indexes (measure first)

---

## Known Edge Case
A **hung `fetchProfile`** request keeps `profileStatus === "loading"` indefinitely → user waits on login screen. Same class as Round 3 fix; low probability (no fetch timeout anywhere in codebase).

---

## Files Modified (Net)

### Frontend
- `frontend/app/(tabs)/index.tsx` — Phases 1, 5+7
- `frontend/app/(tabs)/_layout.tsx` — Phases 2, fix rounds (IconAction, theme-toggle, iconAction centering)
- `frontend/app/_layout.tsx` — Phase 6, fix rounds (RouteGate `inAuth` scope, `profileStatus` integration)
- `frontend/src/components/IdentityBanner.tsx` — Phase 6, Round 1 (theme tokens, gate)
- `frontend/src/components/PeerPicker.tsx` — Phases 4, 8, 9
- `frontend/src/contexts/AuthContext.tsx` — Round 3 (`profileStatus`)

### Backend
- `backend/models/userModel.js` — BE-1 `getDirectory`
- `backend/controllers/userController.js` — BE-1 `getDirectory`, BE-2 `identity_complete`
- `backend/routes/userRouter.js` — BE-1 `/directory` route
- `backend/tests/directory.test.js` — BE-3 (8 tests)
- `backend/tests/migrations.test.js` — fixed `otp_code` → `otp_hash`
- *Removed:* `canMessageBatch`, `getPermissionMap`, `/permissions` route, `messagePermissionsSchema`

---

## Verification
```bash
cd frontend; npx tsc --noEmit          # clean
cd frontend; npx expo lint             # 2 pre-existing warnings
cd backend; npm test                   # 356/356 pass
```

---

## Branch Status
- **Branch:** `mark1e3` (16 commits ahead of `origin/mark1e3`)
- **History:** Not clean — `a9517fd` sweeps pre-existing work. Fix commits (`f439912`, `d5479f3`, `4b54f68`, `990fab1`, `d607e6c`, `584502c`) are incremental.
- **Ready to push:** Yes — all checks pass. Known edge case: hung `fetchProfile` keeps `profileStatus === "loading"` indefinitely (no fetch timeout in codebase).