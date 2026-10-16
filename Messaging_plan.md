# Messaging, Presence & Social Graph — Implementation Plan

**Status:** Design locked (v3.1) — **Phases 0–4 implemented.** Phase 0: admin-managed catalog (API + admin screen), registration pickers, existing-user completion gate, and the `course`→`department_id` refactor (migrations 004/005 applied live). Phase 1: messaging/friends/requests schema, read-only realtime posture + `supabase_realtime` publication, `realtime.messages` private-channel policies (migrations 006/007 applied live), and the permission engine `canMessage`. Phase 2: the full messaging/social API (conversations, requests, receipts, policy, friends, block, report, device-tokens, presence; migration 008 adds the presence columns) — 116/116 backend tests. Phase 3: realtime plumbing — Postgres Changes on `messages`/`conversations`/`notifications`, the private `presence:campus` channel, per-thread typing Broadcast, and reconnect + `seq` catch-up (`src/lib/realtime.ts`, `src/lib/messages.ts`, `src/contexts/PresenceContext.tsx`, `src/hooks/useConversationRealtime.ts`) — frontend `tsc` + lint clean. Phase 4: the messaging/friends UI — inbox + Requests tab (`app/messages/index.tsx`), thread with sent/delivered/seen ticks + typing + request banner (`app/messages/[id].tsx`), friends & requests (`app/friends.tsx`), peer directory (`src/components/PeerPicker.tsx`), messaging/presence/policy/blocked settings (`app/settings.tsx`), shared `Avatar`, and the offline outbox (`src/lib/outbox.ts`); new files `tsc` + lint clean.
**Scope:** `backend/` (Express API + Postgres), `frontend/` (Expo/React Native), Supabase (Realtime + Push)
**Related:** `Feature_suggestions.md` (A6 connections, A7 messaging, A14 trust & safety), `Security_plan.md` (Phase 3 RLS, Phase 4 validation, Phase 9 API client)

This plan spans three coupled systems: a **social identity layer** (department/course, admin-managed), a **relationship-based authorization engine** (who may message whom), and the **messaging stack** (realtime, receipts, presence, push).

---

## 0. Locked decisions

| # | Area | Decision |
|---|------|----------|
| 1 | Realtime transport | **Supabase Realtime (hybrid)** — realtime reads + presence; Express is the write path |
| 2 | Write path | **Express API** (Zod + participant authz + rate limits); Realtime observes committed rows |
| 3 | Scope | **1:1 only** for v1 |
| 4 | Push | **Yes** — in-app realtime **and** OS push (Expo Push Service, EAS dev build) |
| 5 | Receipts | **Sent = stored, Delivered = device ack, Seen = thread opened** (persisted) |
| 6 | Status modes | **online / away / busy / dnd / invisible** |
| 7 | Presence visibility | **Everyone signed-in**; `last_seen` **hidden by default** |
| 8 | E2EE | **No** — server-readable plaintext |
| 9 | Trust & safety | **Block + report** in v1 |
| 10 | Multi-device | **Yes** — receipts/read/presence sync across devices |
| 11 | Department | **Separate Department + Course**, both **required at registration**; catalog is **admin-managed** |
| 12 | Department change | **Admin-only** after registration |
| 13 | Policy direction | **Recipient's policy gates starting** a thread; existing threads persist |
| 14 | Friends | **Accepted friends bypass the policy**; friends **replace** A6 follows |
| 15 | Non-permitted send | **Routes to a message request**; **block is the only hard stop** |
| 16 | Messages pre-accept | **Unlimited** until accepted/ignored *(see spam note, §6)* |
| 17 | Request notifications | **Badge + quiet push** |
| 18 | Request expiry | **None** — stays in the Requests inbox until the recipient accepts |
| 19 | Course | **Picklist per department** (canonical, live from the catalog) |
| 20 | Catalog management | **superadmin/admin** create/edit departments & courses via API + admin UI; **deactivate, never hard-delete**; **nothing hardcoded in the app** |
| 21 | Existing users | **Forced one-time "complete profile"** (department + course) before messaging/posting |
| 22 | Department/course codes | **Optional** short code; the **name** is the required label |

**Prerequisite:** none hardcoded — an admin builds the catalog in-app. (You may hand me a starter list to bulk-load **once**, but the shipped app contains zero department/course names.)

**Defaults (override any):** JWT lifetime **1 h**; notification batching **per 5-min window**; **no** AI scanning of DMs (only reported messages); no message delete in v1; heartbeat 60 s / away at 5 min; opening a thread clears its bell rows; mute hides push only.

---

## 1. Domain model overview

```
departments ──< courses                 (admin-managed catalog; soft-delete via is_active)
     │              │
     │         profiles (department_id, course_id, message_policy, presence_mode, last_seen_*)
     │              │
     ├──< message_policy_departments (allow-list)
     │
     ├──< friendships (requester → addressee, status)
     ├──< blocks (blocker → blocked)
     └──< conversations (user_a<user_b, status requested|active, requester_id)
                │
                └──< messages (seq, client_msg_id, delivered_at, read_at)
                        └──< message_reports
conversation_state (read marker / mute / archive)
device_tokens (push)
```

---

## 2. Architecture (hybrid realtime)

```
Client (Expo)                 Express API                       Supabase
─────────────                 ───────────                       ────────
send / request  ───────────▶  Zod + permission engine  ───────▶ Postgres (INSERT…)
                                                            │
◀══ postgres_changes (RLS) ══════════════════════════════ (WAL)
◀══ presence (online/mode) ═══════════════════════════════ Realtime
⇄  broadcast (typing)      ═══════════════════════════════
delivered/seen ───────────▶  ack endpoints
push ◀──────────────────────  Expo Push API
```

Writes stay centralized (validation + authorization). Realtime only *observes* committed rows.

**Posture delta (read-only widening):** `GRANT SELECT` → `authenticated` on `messages`, `conversations`, `notifications`; participant-scoped RLS; tables in the `supabase_realtime` publication; `realtime.messages` RLS for private presence/typing channels. **No** write grants. Strictly less exposure than before Phase-3 hardening.

---

## 3. Departments & Courses  *(Phase 0 — foundation)*

### Why first
The permission engine compares **departments**. Today there is no department dimension — `profiles.course` (free text, often hardcoded `"BSIT"`) is reused as department in moderation scope, the queue filter, and post notifications. Comparing free text is unreliable *and* a security hole, so this must be a real dimension before any policy ships.

### Admin-managed, never hardcoded
Departments and courses are **runtime data**, created and edited by **superadmin/admin** through the API and an admin UI. Nothing is baked into the app or the source tree — the app ships **zero** department/course names. Registration, profile, settings, and policy pickers all read the live catalog. Because every reference is a `department_id`/`course_id` UUID, **admin edits (including renames) can never corrupt a policy, a conversation, or a moderation scope.**

### Schema
```sql
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE,                   -- optional short code, e.g. 'CCS'
  name TEXT NOT NULL,                 -- 'College of Computer Studies'
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  code TEXT,                          -- optional short code, e.g. 'BSIT'
  name TEXT NOT NULL,                 -- 'BS Information Technology'
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (department_id, name)
);
CREATE INDEX IF NOT EXISTS idx_courses_department ON public.courses(department_id) WHERE is_active;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id),
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id),
  ADD COLUMN IF NOT EXISTS message_policy TEXT NOT NULL DEFAULT 'department'
    CHECK (message_policy IN ('everyone','department','selected','nobody'));
```

### Management rules
- **Who:** `superadmin`/`admin` only (reuse the `requireRole` gate used by moderation). `department_admin` does **not** manage the catalog.
- **Create / rename / reorder / set code:** allowed anytime — safe precisely because references are UUIDs.
- **Deactivate, never hard-delete:** `is_active=false`. A department referenced by profiles/courses cannot be dropped (`RESTRICT`); deactivating hides it from pickers and the policy allow-list while existing references stay valid. Reactivate anytime.
- **Courses belong to exactly one department.** A course with enrolled users can be deactivated but not deleted.
- **Audit:** `created_by`/`updated_by` record the acting admin; `updated_at` supports cache-busting on the client.

### Registration & change rules
- **Both required at registration**: the register form shows a *Department* picker → *Course* picker (scoped to the chosen department). `createProfileSchema` gains required `department_id` + `course_id`.
- **Pre-auth read path:** registration happens **before login**, so the picker endpoints must be guest-reachable — expose `GET /api/public/departments` + `GET /api/public/departments/:id/courses` (active only), matching the existing guest GET → `/api/public/*` rewrite in `api.ts`.
- **Admin-only change**: `PUT /api/users/:id` must **strip** `department_id`/`course_id` from non-admin callers (same pattern as `role` in `userController`). Otherwise a user joins a target's department to defeat a `department`/`selected` policy.
- **Existing users** have no department: a one-time **"complete your profile"** gate forces them to pick department + course on the next authenticated load, before they can message or post (no nulls linger).
- **Refactor: DONE.** `moderationController.withinDepartmentScope`, the queue filter (`?department_id=`), `postController`/`thesisController` notifications, and `theses.department_id` now key off `department_id`. Scope is an exact UUID compare and fails closed; a renamed department can no longer change who moderates or who is notified. The legacy `course`/`department` TEXT columns remain as denormalized display values only (safe to drop later). See `Refactor_plan.md`.

### Endpoints
| Method | Path | Authz | Purpose |
|--------|------|-------|---------|
| GET | `/api/public/departments` | guest | registration picker (active only) |
| GET | `/api/public/departments/:id/courses` | guest | registration picker (active only) |
| GET | `/api/departments` | authed | settings/policy pickers (active only) |
| GET | `/api/admin/departments` | admin/superadmin | full list incl. inactive |
| POST/PUT | `/api/admin/departments` · `/:id` | admin/superadmin | create / rename / reorder / code |
| POST | `/api/admin/departments/:id/deactivate` \| `/activate` | admin/superadmin | soft-delete / restore |
| GET/POST/PUT | `/api/admin/courses` · `/:id` | admin/superadmin | manage courses (scoped by `department_id`) |
| POST | `/api/admin/courses/:id/deactivate` \| `/activate` | admin/superadmin | soft-delete / restore |

---

## 4. The permission engine  *(the heart of the system)*

**Evaluated server-side on conversation-create and on every send.** Never from the body.

Input: `sender`, `recipient`. Output: **`direct` | `request` | `blocked`**.

```
1. blocked(sender,recipient) or blocked(recipient,sender)  → 'blocked'   (hard stop)
2. sender == recipient                                     → reject
3. accepted friend                                         → 'direct'    (bypass)
4. else recipient.message_policy:
     everyone   → 'direct'
     department → same department_id ? 'direct' : 'request'      (default)
     selected   → sender.department_id ∈ recipient's allow-list ? 'direct' : 'request'
     nobody     → 'request'
```

- **`request`** ⇒ conversation created with `status='requested'` (see §6).
- `blocked` ⇒ refuse; return a **generic** "This user isn't accepting messages" (never reveal block vs policy).
- **Existing threads persist**: policy gates *starting*; replies in an `active` conversation are not re-gated by policy (a block still stops everything).
- The people list stays **visible**; the button reads **"Message"** or **"Request"** accordingly.

Suggested helper (raw SQL, one round-trip via CTE) exposed as `messageModel.canMessage(senderId, recipientId)`.

---

## 5. Friendships

```sql
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT chk_friends_distinct CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_friends_pair
  ON public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
```

- **Anyone may request**, rate-limited; **blocked pairs cannot request** (checked first).
- Mutual: request → accept (→ accepted) / decline (→ declined; a later request resets to pending) / cancel / unfriend.
- **Replaces A6 "follows"** — do not build both.
- Notifications: `friend_request`, `friend_accepted` (reuse `notificationService`, new `type`s).
- `GET /api/friends` · `GET /api/friends/requests` · `POST /api/friends/requests` · `POST .../:id/accept|decline` · `DELETE /api/friends/:userId`.

---

## 6. Message requests

```sql
-- conversations gains: requester_id TEXT, status TEXT CHECK (status IN ('requested','active'))
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status, last_message_at DESC);
```

- Non-direct send → conversation `status='requested'`, `requester_id = sender`.
- **Recipient's Requests inbox** = conversations where I'm a participant, `status='requested'`, `requester_id <> me`.
- **Sender's view** = same conversation shown as "requested/pending".
- **Accept** ⇒ `status='active'` (moves to the main inbox; notifies the requester). **Ignore** ⇒ no-op; **no expiry** (stays until accepted).
- **Request notifications**: badge + **quiet** push (low priority), distinct from real messages.
- **⚠ Spam risk (your choice = unlimited pre-accept):** the only brakes are the messaging rate limit, block, and (future) report. Mitigation baked in: a dedicated send limiter (e.g. 20/min, 200/day per sender), and a **one-line switch** to cap pre-accept messages to 1 or 3 if abuse appears. Flagging so "unlimited" is a conscious, reversible decision.

---

## 7. Messaging data model

```sql
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('requested','active')),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_conversations_pair CHECK (user_a < user_b),
  CONSTRAINT uq_conversations_pair UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_msg_id UUID NOT NULL,
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  body TEXT NOT NULL,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_messages_body CHECK (char_length(body) BETWEEN 1 AND 4000),
  CONSTRAINT chk_messages_distinct CHECK (sender_id <> recipient_id),
  CONSTRAINT uq_messages_client UNIQUE (sender_id, client_msg_id)
);

CREATE TABLE IF NOT EXISTS public.conversation_state (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_seq BIGINT DEFAULT 0,
  muted_until TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios','android','web')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT chk_blocks_distinct CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS public.message_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, reporter_id)
);
```

Indexes: `idx_messages_conversation_seq`, `idx_messages_unread (recipient_id, conversation_id) WHERE read_at IS NULL`, `idx_messages_undelivered (recipient_id) WHERE delivered_at IS NULL`, `idx_conversations_status`, `idx_device_tokens_user`, `idx_message_reports_open`.

**Analysis:** `client_msg_id` + unique ⇒ idempotent retries. `seq` ⇒ ordering + `?since_seq=` catch-up (never sort by `created_at`). `requester_id` + `status` ⇒ requests without a second table. `conversation_state` ⇒ read marker/mute/archive.

---

## 8. Realtime, presence & typing

**Streamed tables** (`supabase_realtime` publication): `messages`, `conversations`, `notifications`. Set `REPLICA IDENTITY FULL` on `messages` for filtered UPDATE delivery (delivered/seen).

**RLS — read-only, participant-scoped:**
```sql
GRANT SELECT ON public.messages, public.conversations, public.notifications TO authenticated;

CREATE POLICY "participants read conversations" ON public.conversations FOR SELECT TO authenticated
  USING (user_a = (SELECT auth.uid())::text OR user_b = (SELECT auth.uid())::text);

CREATE POLICY "participants read messages" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c
                 WHERE c.id = messages.conversation_id
                   AND (c.user_a = (SELECT auth.uid())::text OR c.user_b = (SELECT auth.uid())::text)));
```

**Presence** — global channel `presence:campus`, tracked with presence key = `user_id` (multi-device merges to an array → online if any device present). Modes: `online/away/busy/dnd/invisible` (invisible reports offline). `last_seen_at` via throttled heartbeat (60 s) + on background; exposed only if `last_seen_visible`.

**Typing** — **Broadcast** on `conv:<id>`, not Presence (Supabase warns Presence floods on high-frequency updates).

**`realtime.messages` policies** (private channels; **never** `ALTER TABLE realtime.messages`; disable "Allow public access" in settings): INSERT+SELECT for `extension='presence'` on topic `presence:campus` (any `authenticated`); INSERT+SELECT for `extension='broadcast'` on `conv:<id>` where the caller is a participant of that conversation.

> ⚠ `auth.uid()` is `uuid`; `profiles.id` is `TEXT` ⇒ always `(SELECT auth.uid())::text`. Lean policies — RLS complexity raises realtime join latency.

---

## 9. Receipts & presence analysis

| State | Trigger | Storage | Sender learns via |
|-------|---------|---------|-------------------|
| sent | API INSERT commits | row exists | POST response reconciles optimistic bubble |
| delivered | recipient client receives row (Realtime) or foreground catch-up | `delivered_at` | Postgres Changes UPDATE |
| seen | recipient opens thread | `read_at` + `last_read_seq` | Postgres Changes UPDATE |

- **Delivered is an explicit ack** — persisted, not derived from presence; if the recipient never connects it stays "sent" (correct).
- **Multi-device** converges because state lives on the row; batched `read { upto_seq }` avoids per-message calls.
- **Revocation caveat:** Realtime caches a client's policy until JWT refresh, so a mid-session block isn't instant on the feed — the server send-path block check is authoritative. Keep JWT at 1 h.

---

## 10. Notifications (three enforced layers)

1. **DB row** created in the **same transaction** as the message (guaranteed; respects mute/DND/requests).
2. **Realtime** bell/badge (publication includes `notifications`).
3. **OS push** via Expo Push Service when the recipient isn't in the thread — `device_tokens`, EAS dev build, FCM/APNs.
   - Message request ⇒ **quiet push**. DND ⇒ push **suppressed**. Mute ⇒ push hidden, row kept.
   - Prune tokens on Expo `DeviceNotRegistered`. Short preview only (no full body in push).

Types added: `new_message`, `message_request`, `friend_request`, `friend_accepted`.

---

## 11. API surface

| Method | Path | Authz | Purpose |
|--------|------|-------|---------|
| GET | `/api/public/departments`, `/api/public/departments/:id/courses` | guest | registration pickers (active only) |
| GET/POST/PUT | `/api/admin/departments`, `/api/admin/courses` (+ `/:id/(de)activate`) | admin/superadmin | **manage the catalog** |
| GET | `/api/conversations` | authed | main inbox (active) |
| GET | `/api/conversations/requests` | authed | Requests inbox (received) + sent requests |
| POST | `/api/conversations` | authed | open/direct-or-request thread (`peer_id`) |
| POST | `/api/conversations/:id/accept` | recipient | accept a request |
| GET | `/api/conversations/:id/messages` | participant | `?limit&cursor&since_seq` |
| POST | `/api/conversations/:id/messages` | participant | send (`body, client_msg_id`) |
| POST | `/api/conversations/:id/read` | participant | `upto_seq` |
| POST | `/api/messages/:id/delivered` | recipient | delivery ack |
| POST | `/api/conversations/:id/mute` | participant | mute |
| GET/PUT | `/api/users/me/message-policy` | authed | policy + department allow-list |
| POST | `/api/users/me/presence` · `/heartbeat` | authed | mode · last-seen |
| POST/DELETE | `/api/users/me/device-tokens` | authed | push registration |
| GET/POST | `/api/friends`, `/api/friends/requests` | authed | friends |
| POST | `/api/friends/requests/:id/accept\|decline` | addressee | respond |
| POST/DELETE | `/api/users/:id/block` | authed | block/unblock |
| POST | `/api/messages/:id/report` | participant | report → moderation queue |

**Send transaction (atomic ⇒ "enforced"):**
```
BEGIN
  decision = canMessage(sender, recipient)          -- §4
  if blocked → 403 (generic)
  upsert conversation (status = direct ? active : requested, requester_id)
  assert requester allowed to send (pre-accept rules, §6)
  INSERT messages ON CONFLICT (sender_id, client_msg_id) DO NOTHING
  UPDATE conversations.last_message_at
  INSERT notifications (type, respect mute/DND/request)
  ensure conversation_state rows
COMMIT
→ async: Expo push
```

**Rules:** identity from token only; `sender_id`/`recipient_id`/`department_id`/`course_id` never from the body on writes; non-participant → **404**; `clampLimit`; `.strict()` Zod.

**Implemented in Phase 2:** all rows above, plus `GET /api/users/me/blocks` (list your own blocks, for the settings/unblock UI). Per-sender rate limits: sends **20/min** + **200/day**, friend requests **20/min**, reports **10/min** (env-tunable: `RATE_LIMIT_SEND_MAX`, `RATE_LIMIT_SEND_DAILY_MAX`, `RATE_LIMIT_FRIEND_MAX`, `RATE_LIMIT_REPORT_MAX`).

---

## 12. Frontend

| File | Change |
|------|--------|
| `app/(auth)/register.tsx` | add **Department → Course** pickers (required, loaded from the live catalog) |
| `app/complete-profile.tsx` (new) | one-time gate: existing accounts must set department + course before messaging/posting |
| `app/(admin)/departments.tsx` (new) | **admin catalog management**: add/rename/reorder/deactivate departments & their courses |
| `app/(tabs)/profile.tsx`, `edit-profile.tsx` | show dept/course; department locked (admin-only) |
| Settings **(DONE — Phase 4: `app/settings.tsx`)** | "Who can message you": radio + department multi-select (when `selected`); presence mode; blocked users |
| `app/messages/index.tsx` **(DONE — Phase 4)** | main inbox **+ Requests tab** (accept/ignore) |
| `app/messages/[id].tsx` **(DONE — Phase 4)** | thread: bubbles, sent/delivered/seen ticks, typing, "requested" banner + Accept |
| `app/friends.tsx` **(DONE — Phase 4)** (new) | friends list, requests, add button |
| `src/components/PeerPicker.tsx` **(DONE — Phase 4)** | peer list with Message / **Request** button + dept |
| `src/lib/catalog.ts` (new) | fetch + cache departments/courses; invalidate on admin edit |
| `src/lib/realtime.ts` **(DONE — Phase 3)** | channels: `presence:campus`, messages, notifications; reconnect + catch-up |
| `src/lib/messages.ts` **(DONE — Phase 3: API client + friends)**, `outbox.ts` **(DONE — Phase 4)**, `push.ts` | API + offline queue + push |
| `src/contexts/PresenceContext.tsx` **(DONE — Phase 3)**, `hooks/useConversationRealtime.ts` **(DONE — Phase 3)** | presence + data wiring |
| `src/types.ts` | `Department`, `Course`, `Conversation`, `Message`, `MessageStatus`, `PresenceMode`, `MessagePolicy`, `Friend` |

Verify Realtime JS + `expo-notifications` against the installed Expo SDK's versioned docs (AGENTS.md). Guest/anonymous accounts cannot DM.

---

## 13. Security & privacy analysis

- **Department is the access key and must be admin-only** — self-edit defeats the policy. Enforced by stripping `department_id`/`course_id` in `PUT /users/:id` for non-admins.
- **Catalog writes are admin-only** — the same `requireRole` gate as moderation; a student/`department_admin` cannot create a department to widen their own messaging reach.
- **UUID references make admin edits safe** — renaming/reordering can't silently change who may message whom (a real hazard if the toggles compared free-text names).
- **Two enforcement layers:** Express (authoritative, SQL predicates) + Realtime RLS (participant-scoped, read-only). Tests must prove a non-participant cannot subscribe to a foreign conversation, and a non-permitted sender can only create a *request*, never an `active` thread.
- **Block is checked first, everywhere**, wins over friendship and policy; responses are generic (no block/policy disclosure ⇒ no probing).
- **Enumeration:** peer list exposes department/course (already campus-public); **policy and block state never leak**.
- **Spam:** rate-limit sends (esp. pre-accept), friend requests, and reports. Unlimited pre-accept is the weakest link (§6).
- **Notifications** carry a short preview only; DND suppressed; mutes honored.
- **No E2EE ⇒ reported messages are reviewable;** default is no proactive scanning.

---

## 14. Reliability, scale, cost

- Idempotent sends (`client_msg_id`), monotonic `seq`, outbox for offline, catch-up on reconnect.
- Presence payloads tiny; typing via Broadcast (not Presence).
- Catalog reads are small and cacheable; no Realtime needed for departments/courses.
- Verify your Supabase plan's concurrent-connection + messages/month caps before Phase 3; high volume ⇒ consider "Broadcast from Database".
- Realtime policy caching ⇒ 1 h JWT bounds revocation lag.

---

## 15. Phased delivery

| Phase | Deliverable | Acceptance | Effort |
|-------|-------------|------------|--------|
| **0** | Departments + Courses: tables, **admin CRUD (API + admin UI)**, pre-auth picker endpoints, registration pickers, **existing-user completion gate**, admin-only change, **`course`→`department` refactor (DONE)** | admin can add/rename/deactivate dept & courses; both required at signup; existing users gated; non-admin can't change; moderation/notifications scoped by `department_id`, fail-closed | 3–4 d |
| **1** | Messaging + friends + requests schema, RLS, publication, `realtime.messages` policies, permission engine **(DONE — migrations 006/007 live; `canMessage` + truth-table tests)** | migration live; anon/authed can't write; a non-participant sees nothing; `canMessage` returns direct/request/blocked correctly | 2–3 d |
| **2** | API: conversations, requests, receipts, policy, friends, block, report, device-tokens, presence + tests **(DONE — migration 008 presence columns live; 39 new tests)** | 401 unauth; non-participant 404; request-vs-direct enforced; validation 400; idempotent send; suite green | 3–4 d |
| **3** | Realtime plumbing + presence + typing **(DONE — `src/lib/realtime.ts` (db/presence/typing channels), `src/lib/messages.ts` API client, `src/contexts/PresenceContext.tsx` + heartbeat, `src/hooks/useConversationRealtime.ts`; `PresenceProvider` wired in `app/_layout.tsx`; frontend `tsc` + lint clean)** | two devices see messages/typing/status live; reconnect recovers by `seq` | 2–3 d |
| **4** | Frontend: registration, admin catalog screen, settings policy, inbox+requests, threads, friends **(DONE — `app/messages/index.tsx`, `app/messages/[id].tsx`, `app/friends.tsx`, `app/settings.tsx`, `src/components/PeerPicker.tsx` + `Avatar.tsx`, `src/lib/outbox.ts`; SettingsSidebar + notification routing wired; new files `tsc` + lint clean)** | two users DM; request→accept→inbox works; ticks correct; offline queue flushes; typecheck+lint clean | 4–5 d |
| **5** | Push (EAS dev build + credentials) | background push arrives; request = quiet; DND suppresses | 1–2 d (+ your setup) |
| **6** | Trust & safety (block gate + report → moderation queue) | blocked send refused; report reaches queue | 1 d |
| **7** | Hardening (JWT, rate limits, pre-accept cap switch, retention, load sanity) | limits documented; no policy drift | 1 d |

**Total ≈ 3.5–5 weeks**, plus your dashboard/EAS setup. (No dependency on you supplying a static department list.)

---

## 16. Testing

- **Backend (`node:test` + supertest, stub models):** 401 on every route; participant-only (404 otherwise); permission engine truth table (block/friend/department/selected/nobody → direct/request/blocked); request→accept transition; send idempotency; validation 400; pagination clamp; no DB-error leakage.
- **Catalog:** only admin/superadmin can mutate; deactivating hides from pickers but preserves references; course creation is scoped to a real department; duplicate names rejected.
- **RLS/realtime:** non-participant cannot read a conversation via REST/Realtime; only `SELECT` granted.
- **Frontend:** `npx tsc --noEmit` + `npx expo lint`; manual QA script per phase.

---

## 17. Your setup (dashboard / EAS)
Add tables to the `supabase_realtime` publication (**done — migration 006**); apply `realtime.messages` policies (**done — migration 007**); in the dashboard enable Realtime and **disable "Allow public access"**; set JWT expiry 1 h; create the EAS dev build with FCM/APNs. **Departments/courses are entered in-app by an admin** — no static list to supply.

---

## 18. Risks

| Risk | Mitigation |
|------|------------|
| `course`/`department` drift (two notions) | Phase 0 refactor; single `department_id` source |
| Unlimited pre-accept spam | dedicated rate limiter + one-line cap switch (§6) |
| Catalog hard-deleted while referenced | `RESTRICT` FKs + deactivate-only policy; UI hides inactive |
| Non-admin widening own reach via catalog | admin-only `requireRole` gate on all catalog writes |
| Realtime RLS posture drift | read-only, participant-scoped, reviewed separately |
| RLS policy → join latency | lean policies; measure in Phase 3 |
| Policy-cache staleness on block | 1 h JWT + authoritative server-side block gate |
| Department self-edit bypass | admin-only enforcement in `PUT /users/:id` |
| Push setup complexity | isolated in Phase 5; seam built in Phase 2 |

---

## 19. Definition of done (v1)
- Departments & courses are **admin-managed in-app** (create/rename/deactivate), with **no hardcoded names** anywhere in the app.
- Users register with **department + course**; department is admin-only thereafter.
- "Who can message you" is enforced server-side; non-permitted sends become **requests**; **block** is absolute.
- Friends (mutual, rate-limited, replacing follows) bypass the policy.
- 1:1 DMs persist, stream live, survive reconnect; sent/delivered/seen accurate and multi-device.
- Presence shows live online/mode; DND suppresses push; `invisible` honored; `last_seen` opt-in.
- Notifications guaranteed (same-transaction row), live bell, and push when backgrounded (requests quiet).
- RLS deny-by-default with only read-only, participant-scoped additions; backend tests + `tsc`/lint green.

---

## 20. Still to confirm (defaults chosen)
1. JWT 1 h; notification batching per 5-min window; no DM AI scan by default; heartbeat 60 s / away 5 min.
2. Opening a thread clears its bell rows (recommended: yes).
3. Mute hides push but keeps the row (recommended).
4. Cannot DM as an anonymous/guest session (recommended).
5. Pre-accept message cap: currently **unlimited** per your choice — confirm you want the limiter set at ~20/min + 200/day.

**Resolved:** catalog access = **admin + superadmin**; existing users = **forced one-time "complete profile"**; codes = **optional** (name is the required label).
