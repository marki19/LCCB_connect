# LCCB Connect — Data Flow Architecture

Source of truth for generating the Context Diagram (CFD), Level 1 DFD, and Level 2 DFDs.
Compiled from the backend code (21 routers, 136 endpoints, 61 migrations) on 2026-11-21, not from
the older `docs/API.md` contract where the two disagree.

---

## 1. Scope

LCCB Connect is the campus social and academic platform of La Consolacion College Bacolod. One
deployable system: an Expo/React Native client, an Express API, a Supabase-hosted Postgres
database, Cloudflare R2 object storage, an SMTP relay, Expo Push, Google Identity, and an optional
Gemini screening endpoint.

Out of scope for the diagrams: build tooling, CI, developer machines, and the database engine once
it is inside the system boundary. Postgres is a data store, not an external entity.

---

## 2. How to use this document

| Diagram | Take from |
| --- | --- |
| CFD | §3 (external entities), §8 (single-process flow list) |
| Level 1 | §4 (stores), §5 (eight processes), §6 (per-entity flow inventory) |
| Level 2 | §7 (sub-process decomposition), §6 (which entity flow belongs to which sub-process) |
| Balance check | §9 |
| Traceability, defensible claims | §10 |

Naming rules used throughout: entities are singular noun phrases; processes are
`Number + Verb + Noun`; flows are noun phrases with no verbs; stores are `D# + noun`.

---

## 3. System boundary

### 3.1 The five actor entities

These are the only human roles that cross the boundary. Every one of them must have at least one
flow into and one flow out of the system at every level.

| ID | Entity | Definition | Boundary behaviour |
| --- | --- | --- | --- |
| E1 | Student | Any signed-up account (`role = student`, or `faculty` when the account is an adviser/reviewer) | Full read/write account: publishes, interacts, messages, reports, verifies identity |
| E2 | Guest | Visitor with no session (`AuthContext.signInAsGuest`, frontend-only, never stored) | Read-only public routes: posts, comments, theses, peers, catalog. Every write returns 401 |
| E3 | Department Administrator | `role = departmentadmin` | Sees and acts on only their own department: verification queue, moderation queue, reports, announcements |
| E4 | Administrator | `role = admin` | Campus-wide console: accounts, content inventory, catalog, announcements. Cannot manage peers or superadmins |
| E5 | Super Administrator | `role = superadmin` | Everything an administrator does, plus role changes to any rank, force sign-out, impersonation, unlock, audit log |

Faculty is a **rank inside the student account type** (rank 1, adviser/reviewer), not a sixth
entity. It publishes and interacts exactly like a student; it gains no moderation or console
access. Do not draw it as a separate entity.

### 3.2 External service entities

These are outside the boundary and are drawn as entities, not processes.

| ID | Entity | Data crossing the boundary | Direction |
| --- | --- | --- | --- |
| S1 | Google Identity Service | ID token in, verified identity claim out | both |
| S2 | Email Delivery Service | address + code/template out, delivery receipt and bounce webhook in | both |
| S3 | Object Storage (Cloudflare R2) | signed PUT/GET URL out, object bytes and object key in/out | both |
| S4 | Push Delivery Service (Expo) | push payload out, delivery ticket in | both |
| S5 | Content Screening Service (Gemini) | content sample out, screening verdict in | both |

S5 is optional at runtime (`GEMINI_API_KEY` unset falls back to the local dictionary scanner), but
it is part of the architecture and belongs on the diagram.

### 3.3 What is deliberately not an entity

`supabaseAdmin` (the database admin client), the JWT/bcrypt libraries, and the local screening
dictionary are all internal mechanisms. The Postgres instance is inside the boundary.

---

## 4. Data stores

Nine stores. Every L2 page may only use the stores its parent process already owns.

| ID | Name | Tables (verified in migrations) | Written by |
| --- | --- | --- | --- |
| D1 | User Records | `profiles`, `pending_signups`, `profile_verification_requests`, `verification_otp`, `password_resets`, `mfa_factors`, `session_events`, `refresh_tokens` | 1.0, 6.0, 8.0 |
| D2 | Content Records | `posts`, `post_attachments`, `post_audience`, `post_mentions`, announcements (`posts.type = 'announcement'`) | 2.0, 6.0 |
| D3 | Interaction Records | `comments`, `likes`, `reposts`, `saved_posts`, `saved_collections`, `saved_collection_items` | 3.0, 6.0 |
| D4 | Social Graph | `friendships`, `blocks`, `message_policy_departments` | 3.0, 5.0 |
| D5 | Snap Records | `snaps`, `snap_views`, `snap_reactions`, `snap_comments` | 4.0 |
| D6 | Message Records | `conversations`, `messages`, `conversation_state` | 5.0 |
| D7 | Moderation Records | `reports`, `message_reports`, `admin_audit_log`, `moderation_status` columns | 6.0, 8.0 |
| D8 | Notification Records | `notifications`, `device_tokens` | 1.0, 2.0, 3.0, 5.0, 6.0, 7.0 |
| D9 | Catalog Records | `departments`, `courses`, `academic_levels` | 1.0 (read), 8.0 (write) |

Two naming cautions for the diagram:

- `theses` still exists as a selectable content type but the dedicated table was merged into
  `posts` by migration 055. Keep it inside D2; never draw a thesis store.
- `refresh_tokens` and `session_events` live in D1 even though they describe sessions, because
  they are keyed by user id and are destroyed with the account.

---

## 5. Level 1 processes

Eight processes. Each row lists the entity flows and the stores touched; §6 gives the same data
entity-first.

### 5.1 `1.0 Manage Identity and Access`

Account lifecycle, sessions, multi-factor, and identity verification submission.

| Direction | Entity | Flows | Store access |
| --- | --- | --- | --- |
| in | Student | Sign-up Request, Sign-up Code, Sign-in Credential, Google ID Token, Password Reset Code, MFA Code, Profile Details, Identity Document, School Email Code | D1 write, D1 read, D9 read, D8 write |
| out | Student | Session Token, Verification Code Message, Registration Receipt, Verification Status, Profile Record, MFA Secret, Password Reset Receipt | |

Notable rules the diagram should not lose: sign-up is two-step (request → 6-digit code → session),
Google sign-in exchanges an ID token, MFA is TOTP, and a suspended account keeps only its own
profile read.

### 5.2 `2.0 Process Content Publishing`

Posts, attachments, link previews, mentions, and role-gated announcements.

| Direction | Entity | Flows | Store access |
| --- | --- | --- | --- |
| in | Student | Post Draft, Attachment File, Post Link, Comment-free post actions | D2 write, D3 write (mentions), D1 read, D9 read, D8 write, D7 write |
| out | Student | Publication Receipt, Post Record, Attachment URL, Link Preview Card, Draft Status | |
| in | Department Administrator | Announcement Draft | |
| out | Department Administrator | Announcement Receipt, Audience Count | |
| both | Object Storage | Media Object out, Object Key in | |

Three details that matter at L2: media is uploaded straight to R2 with a signed URL and only the key
is stored; every new post and comment is screened before it is visible; an announcement is a
`posts` row with `type = 'announcement'` plus an audience role, department, and course scope that the
controller enforces.

### 5.3 `3.0 Process Social Interaction`

Comments, likes, reposts, saves, friendships, and blocks.

| Direction | Entity | Flows | Store access |
| --- | --- | --- | --- |
| in | Student | Comment Text, Reaction Choice, Repost Command, Save Command, Collection Name, Friend Request Action, Block Action | D3 write, D4 write, D2 read, D1 read, D8 write |
| out | Student | Comment Thread, Interaction Receipt, Friend Suggestion, Friend List, Block List | |

### 5.4 `4.0 Process Quick Snap`

24-hour photo and video status with audience, views, reactions, and comments.

| Direction | Entity | Flows | Store access |
| --- | --- | --- | --- |
| in | Student | Snap Media, Snap Caption, Audience Choice, View Event, Snap Reaction, Snap Comment | D5 write, D1 read, D4 read, D2 read |
| out | Student | Capture Receipt, Snap Rail, Snap Playback, View Count, Reaction Receipt, Snap Comment Thread | |
| both | Object Storage | Snap Object out, Snap URL in | |

Expiry is a database default (`expires_at = now() + 24 hours`), not a scheduled process. Do not
invent a timer process; the rail query filters by `expires_at`.

### 5.5 `5.0 Process Messaging`

Conversations, message requests, delivery state, mutes, and the message policy gate.

| Direction | Entity | Flows | Store access |
| --- | --- | --- | --- |
| in | Student | Conversation Request, Message Text, Read Receipt, Mute Setting | D6 write, D4 read/write, D1 read, D8 write |
| out | Student | Conversation Thread, Delivered Message, Unread Count, Message Request, Policy Status | |
| out | Push Delivery Service | Push Message | |
| in | Push Delivery Service | Delivery Receipt | |

Every conversation route returns 404 to a non-participant, and a blocked pair gets one generic
refusal. Both are behaviour, not new flows.

### 5.6 `6.0 Process Moderation and Reporting`

Verification review, content screening, moderation queue, content actions, and user reports.

| Direction | Entity | Flows | Store access |
| --- | --- | --- | --- |
| in | Student | Report Details, Message Report | D7 write, D2 write, D3 write, D1 write, D8 write |
| out | Student | Report Acknowledgment, Moderation Notice | |
| in | Department Administrator | Queue Request, Verification Decision, Moderation Decision | |
| out | Department Administrator | Verification Queue, Moderation Queue, Flagged Item, Action Receipt | |
| in | Administrator | Content Action, Scan Directive | |
| out | Administrator | Action Receipt, Scan Report | |
| in | Super Administrator | Verification Decision, Content Action | |
| out | Super Administrator | Verification Result, Action Receipt | |
| both | Content Screening Service | Content Sample out, Screening Verdict in | |

Department scoping is the one rule that must survive into L2: a department administrator's queue,
actions, and receipts are all filtered to authors in their own department, and a moderator with no
department fails closed.

### 5.7 `7.0 Process Discovery and Notifications`

Search, feed assembly, public reads, notifications, presence, and device registration.

| Direction | Entity | Flows | Store access |
| --- | --- | --- | --- |
| in | Student | Search Query, Feed Request, Notification Read Action, Presence Signal, Device Token | D2 read, D3 read, D4 read, D1 read, D8 write, D9 read |
| out | Student | Search Results, Suggestion List, Feed Page, Notification List, In-App Notification | |
| in | Guest | Public Read Request | |
| out | Guest | Public Content Page | |
| out | Push Delivery Service | Notification Push | |
| in | Push Delivery Service | Delivery Ticket | |

Guests have no session and no push; the only guest flow is the public read pair.

### 5.8 `8.0 Administer Accounts and Catalog`

Console reads, suspensions, roles, force sign-out, impersonation, catalog, and the audit log.

| Direction | Entity | Flows | Store access |
| --- | --- | --- | --- |
| in | Administrator | Overview Request, Account Directive, Role Assignment, Catalog Change, Audit Query | D1 write, D7 write, D9 write, D2 read |
| out | Administrator | Platform Overview, Account Record, User Directory, Content Inventory, Catalog List, Action Receipt | |
| in | Super Administrator | Role Assignment, Suspension Order, Force Sign-Out Order, Impersonation Request, Account Unlock | |
| out | Super Administrator | Role Confirmation, Suspension Receipt, Sign-Out Receipt, Impersonation Grant, System Audit Report | |

---

## 6. Per-entity flow inventory

The reason for this section: the five actor entities must stay visually separable at every level.
Each flow below carries a stable ID so the L1 and L2 diagrams can be checked against the same list.

### 6.1 Student (E1)

| ID | Flow | Direction | L1 process | L2 sub-process |
| --- | --- | --- | --- | --- |
| F-S01 | Sign-up Request | in | 1.0 | 1.1 |
| F-S02 | Sign-up Code | in | 1.0 | 1.1 |
| F-S03 | Sign-in Credential | in | 1.0 | 1.2 |
| F-S04 | Google ID Token | in | 1.0 | 1.2 |
| F-S05 | Password Reset Code | in | 1.0 | 1.2 |
| F-S06 | MFA Code | in | 1.0 | 1.3 |
| F-S07 | Profile Details | in | 1.0 | 1.4 |
| F-S08 | Identity Document | in | 1.0 | 1.5 |
| F-S09 | School Email Code | in | 1.0 | 1.5 |
| F-S10 | Session Token | out | 1.0 | 1.2 |
| F-S11 | Verification Code Message | out | 1.0 | 1.1 |
| F-S12 | Registration Receipt | out | 1.0 | 1.1 |
| F-S13 | Verification Status | out | 1.0 | 1.5 |
| F-S14 | Profile Record | out | 1.0 | 1.4 |
| F-S15 | Password Reset Receipt | out | 1.0 | 1.2 |
| F-S16 | Post Draft | in | 2.0 | 2.1 |
| F-S17 | Attachment File | in | 2.0 | 2.2 |
| F-S18 | Post Link | in | 2.0 | 2.3 |
| F-S19 | Publication Receipt | out | 2.0 | 2.1 |
| F-S20 | Post Record | out | 2.0 | 2.1 |
| F-S21 | Link Preview Card | out | 2.0 | 2.3 |
| F-S22 | Comment Text | in | 3.0 | 3.1 |
| F-S23 | Reaction Choice | in | 3.0 | 3.2 |
| F-S24 | Repost Command | in | 3.0 | 3.3 |
| F-S25 | Save Command | in | 3.0 | 3.4 |
| F-S26 | Collection Name | in | 3.0 | 3.4 |
| F-S27 | Friend Request Action | in | 3.0 | 3.5 |
| F-S28 | Block Action | in | 3.0 | 3.6 |
| F-S29 | Comment Thread | out | 3.0 | 3.1 |
| F-S30 | Interaction Receipt | out | 3.0 | 3.2 |
| F-S31 | Friend Suggestion | out | 3.0 | 3.5 |
| F-S32 | Friend List | out | 3.0 | 3.5 |
| F-S33 | Block List | out | 3.0 | 3.6 |
| F-S34 | Snap Media | in | 4.0 | 4.1 |
| F-S35 | Snap Caption | in | 4.0 | 4.1 |
| F-S36 | Audience Choice | in | 4.0 | 4.2 |
| F-S37 | View Event | in | 4.0 | 4.3 |
| F-S38 | Snap Reaction | in | 4.0 | 4.4 |
| F-S39 | Snap Comment | in | 4.0 | 4.5 |
| F-S40 | Capture Receipt | out | 4.0 | 4.1 |
| F-S41 | Snap Rail | out | 4.0 | 4.3 |
| F-S42 | Snap Playback | out | 4.0 | 4.3 |
| F-S43 | View Count | out | 4.0 | 4.3 |
| F-S44 | Reaction Receipt | out | 4.0 | 4.4 |
| F-S45 | Snap Comment Thread | out | 4.0 | 4.5 |
| F-S46 | Conversation Request | in | 5.0 | 5.1 |
| F-S47 | Message Text | in | 5.0 | 5.2 |
| F-S48 | Read Receipt | in | 5.0 | 5.3 |
| F-S49 | Mute Setting | in | 5.0 | 5.3 |
| F-S50 | Conversation Thread | out | 5.0 | 5.1 |
| F-S51 | Delivered Message | out | 5.0 | 5.2 |
| F-S52 | Unread Count | out | 5.0 | 5.3 |
| F-S53 | Report Details | in | 6.0 | 6.4 |
| F-S54 | Message Report | in | 6.0 | 6.6 |
| F-S55 | Report Acknowledgment | out | 6.0 | 6.4 |
| F-S56 | Moderation Notice | out | 6.0 | 6.3 |
| F-S57 | Search Query | in | 7.0 | 7.2 |
| F-S58 | Feed Request | in | 7.0 | 7.3 |
| F-S59 | Notification Read Action | in | 7.0 | 7.4 |
| F-S60 | Presence Signal | in | 7.0 | 7.5 |
| F-S61 | Device Token | in | 7.0 | 7.5 |
| F-S62 | Search Results | out | 7.0 | 7.2 |
| F-S63 | Suggestion List | out | 7.0 | 7.2 |
| F-S64 | Feed Page | out | 7.0 | 7.3 |
| F-S65 | Notification List | out | 7.0 | 7.4 |
| F-S66 | In-App Notification | out | 7.0 | 7.4 |

### 6.2 Guest (E2)

| ID | Flow | Direction | L1 process | L2 sub-process |
| --- | --- | --- | --- | --- |
| F-G01 | Public Read Request | in | 7.0 | 7.3 |
| F-G02 | Public Content Page | out | 7.0 | 7.3 |

Guest has exactly one pair. Anything else a guest appears to do is a student flow with the session
switched off, and adding it would break the boundary.

### 6.3 Department Administrator (E3)

| ID | Flow | Direction | L1 process | L2 sub-process |
| --- | --- | --- | --- | --- |
| F-D01 | Announcement Draft | in | 2.0 | 2.4 |
| F-D02 | Announcement Receipt | out | 2.0 | 2.4 |
| F-D03 | Audience Count | out | 2.0 | 2.4 |
| F-D04 | Verification Decision | in | 6.0 | 6.1 |
| F-D05 | Verification Queue | out | 6.0 | 6.1 |
| F-D06 | Queue Request | in | 6.0 | 6.2 |
| F-D07 | Moderation Queue | out | 6.0 | 6.2 |
| F-D08 | Moderation Decision | in | 6.0 | 6.3 |
| F-D09 | Flagged Item | out | 6.0 | 6.2 |
| F-D10 | Action Receipt | out | 6.0 | 6.3 |

Department scope applies to F-D04 through F-D10 without exception.

### 6.4 Administrator (E4)

| ID | Flow | Direction | L1 process | L2 sub-process |
| --- | --- | --- | --- | --- |
| F-A01 | Content Action | in | 6.0 | 6.3 |
| F-A02 | Scan Directive | in | 6.0 | 6.5 |
| F-A03 | Action Receipt | out | 6.0 | 6.3 |
| F-A04 | Scan Report | out | 6.0 | 6.5 |
| F-A05 | Overview Request | in | 8.0 | 8.1 |
| F-A06 | Platform Overview | out | 8.0 | 8.1 |
| F-A07 | Account Directive | in | 8.0 | 8.2 |
| F-A08 | Account Record | out | 8.0 | 8.1 |
| F-A09 | User Directory | out | 8.0 | 8.1 |
| F-A10 | Content Inventory | out | 8.0 | 8.1 |
| F-A11 | Role Assignment | in | 8.0 | 8.3 |
| F-A12 | Role Confirmation | out | 8.0 | 8.3 |
| F-A13 | Catalog Change | in | 8.0 | 8.5 |
| F-A14 | Catalog List | out | 8.0 | 8.5 |

An administrator cannot assign a role at or above their own rank, cannot manage a peer or a
superadmin, and cannot read the audit log. The audit pair therefore exists only under the super
administrator (§6.5, F-U10/F-U11).

### 6.5 Super Administrator (E5)

| ID | Flow | Direction | L1 process | L2 sub-process |
| --- | --- | --- | --- | --- |
| F-U01 | Role Assignment | in | 8.0 | 8.3 |
| F-U02 | Role Confirmation | out | 8.0 | 8.3 |
| F-U03 | Suspension Order | in | 8.0 | 8.2 |
| F-U04 | Suspension Receipt | out | 8.0 | 8.2 |
| F-U05 | Force Sign-Out Order | in | 8.0 | 8.4 |
| F-U06 | Sign-Out Receipt | out | 8.0 | 8.4 |
| F-U07 | Impersonation Request | in | 8.0 | 8.7 |
| F-U08 | Impersonation Grant | out | 8.0 | 8.7 |
| F-U09 | Account Unlock | in | 8.0 | 8.2 |
| F-U10 | Audit Query | in | 8.0 | 8.6 |
| F-U11 | System Audit Report | out | 8.0 | 8.6 |
| F-U12 | Verification Decision | in | 6.0 | 6.1 |
| F-U13 | Verification Result | out | 6.0 | 6.1 |

Administrator and super administrator share `8.2` and `8.3` because the routes are the same with a
rank guard; the diagram should show both entities on those sub-processes rather than inventing a
duplicate process.

### 6.6 External services

| ID | Flow | Direction | L1 process |
| --- | --- | --- | --- |
| X-GI-1 | Identity Assertion | in | 1.0 |
| X-GI-2 | Authentication Request | out | 1.0 |
| X-EM-1 | Code Message | out | 1.0 |
| X-EM-2 | Bounce Notice | in | 1.0, 6.0 |
| X-R2-1 | Media Object | in | 2.0, 4.0 |
| X-R2-2 | Signed Object URL | out | 2.0, 4.0 |
| X-PS-1 | Push Message | out | 5.0, 7.0 |
| X-PS-2 | Delivery Ticket | in | 5.0, 7.0 |
| X-CS-1 | Content Sample | out | 6.0 |
| X-CS-2 | Screening Verdict | in | 6.0 |

---

## 7. Level 2 decomposition

Each sub-process belongs to exactly one parent. A Level 2 page may show only its parent's entity
flows and its parent's stores; flows between sub-processes of the same parent are internal and are
allowed (drawn as plain arrows between the children).

### 7.1 Parent `1.0 Manage Identity and Access`

| Sub-process | Entity flows in | Entity flows out | Stores |
| --- | --- | --- | --- |
| 1.1 Register Account | F-S01, F-S02 | F-S11, F-S12 | D1 write, D8 write |
| 1.2 Authenticate Session | F-S03, F-S04, F-S05 | F-S10, F-S15 | D1 read/write, X-GI, X-EM |
| 1.3 Challenge MFA | F-S06 | MFA Secret | D1 read/write |
| 1.4 Manage Profile | F-S07 | F-S14 | D1 write, D9 read |
| 1.5 Verify Identity | F-S08, F-S09 | F-S13 | D1 write, D8 write, X-EM |

`1.5` writes `profile_verification_requests` and `verification_otp` and notifies reviewers; the
review itself is `6.1`, deliberately on the moderation page.

### 7.2 Parent `2.0 Process Content Publishing`

| Sub-process | Entity flows in | Entity flows out | Stores |
| --- | --- | --- | --- |
| 2.1 Compose Post | F-S16 | F-S19, F-S20 | D2 write, D3 write, D7 write |
| 2.2 Upload Attachment | F-S17 | Attachment URL | D2 write, X-R2 |
| 2.3 Generate Link Preview | F-S18 | F-S21 | D2 read |
| 2.4 Publish Announcement | F-D01 | F-D02, F-D03 | D2 write, D9 read, D8 write |

`2.1` is the only writer that triggers screening, and screening lives on the moderation page. Model
the hand-off as an internal flow from `2.1`, not as a store edge.

### 7.3 Parent `3.0 Process Social Interaction`

| Sub-process | Entity flows in | Entity flows out | Stores |
| --- | --- | --- | --- |
| 3.1 Post Comment | F-S22 | F-S29 | D3 write, D2 read, D7 write |
| 3.2 Record Reaction | F-S23 | F-S30 | D3 write, D2 read, D8 write |
| 3.3 Record Repost | F-S24 | Interaction Receipt | D3 write, D2 read, D8 write |
| 3.4 Save Post | F-S25, F-S26 | Saved Item | D3 write, D2 read |
| 3.5 Manage Friendship | F-S27 | F-S31, F-S32 | D4 write, D1 read, D8 write |
| 3.6 Manage Block | F-S28 | F-S33 | D4 write |

### 7.4 Parent `4.0 Process Quick Snap`

| Sub-process | Entity flows in | Entity flows out | Stores |
| --- | --- | --- | --- |
| 4.1 Capture Snap | F-S34, F-S35 | F-S40 | D5 write, X-R2 |
| 4.2 Set Audience | F-S36 | Audience Confirmation | D5 write, D4 read |
| 4.3 Serve Snap View | F-S37 | F-S41, F-S42, F-S43 | D5 write, D1 read |
| 4.4 Record Snap Reaction | F-S38 | F-S44 | D5 write |
| 4.5 Record Snap Comment | F-S39 | F-S45 | D5 write, D7 write |

No expiry sub-process. `expires_at` is a column default and every read filters on it; a timer
process would have no entity flow and would break the balance rule.

### 7.5 Parent `5.0 Process Messaging`

| Sub-process | Entity flows in | Entity flows out | Stores |
| --- | --- | --- | --- |
| 5.1 Open Conversation | F-S46 | F-S50 | D6 write, D4 read |
| 5.2 Send Message | F-S47 | F-S51 | D6 write, D8 write, X-PS |
| 5.3 Enforce Message Policy | F-S48, F-S49 | F-S52 | D6 write, D4 read/write |

`5.3` owns the block check, the mute flag, delivered/read state, and the generic refusal. It is the
only sub-process that reads D4 inside messaging.

### 7.6 Parent `6.0 Process Moderation and Reporting`

| Sub-process | Entity flows in | Entity flows out | Stores |
| --- | --- | --- | --- |
| 6.1 Review Verification | F-D04, F-U12 | F-D05, F-U13 | D1 write, D8 write |
| 6.2 Review Moderation Queue | F-D06 | F-D07, F-D09 | D7 read, D8 read |
| 6.3 Apply Content Action | F-D08, F-A01 | F-D10, F-A03, F-S56 | D2 write, D3 write, D7 write, D8 write |
| 6.4 Resolve User Report | F-S53 | F-S55 | D7 write, D2 read |
| 6.5 Screen Content | F-A02, X-CS-2 | F-A04, X-CS-1 | D7 write |
| 6.6 Report Message | F-S54 | Moderation Receipt | D7 write |

`6.5` is the only sub-process whose external bound is a service rather than an actor. Without S5 it
would have no entity flow at all, which is the reason the screening service is modelled as an
entity instead of an internal routine.

### 7.7 Parent `7.0 Process Discovery and Notifications`

| Sub-process | Entity flows in | Entity flows out | Stores |
| --- | --- | --- | --- |
| 7.1 Index Content | — (internal) | — (internal) | D2 read, D3 read |
| 7.2 Answer Search | F-S57 | F-S62, F-S63 | D2 read, D1 read |
| 7.3 Build Feed | F-S58, F-G01 | F-S64, F-G02 | D2 read, D3 read, D4 read |
| 7.4 Deliver Notification | F-S59 | F-S65, F-S66 | D8 read/write, X-PS |
| 7.5 Track Presence | F-S60, F-S61 | Presence Confirmation | D1 write, D8 write |

`7.1` has no entity flow, so it must not be a separate bubble. Either fold indexing into `7.2` (the
search query over the indexes is the observable behaviour) or draw it as an internal flow. The
recommended drawing folds it into `7.2`.

### 7.8 Parent `8.0 Administer Accounts and Catalog`

| Sub-process | Entity flows in | Entity flows out | Stores |
| --- | --- | --- | --- |
| 8.1 Review Account | F-A05 | F-A06, F-A08, F-A09, F-A10 | D1 read, D2 read |
| 8.2 Change Account Status | F-A07, F-U03, F-U09 | F-U04, Account Status | D1 write, D7 write |
| 8.3 Assign Role | F-A11, F-U01 | F-A12, F-U02 | D1 write, D7 write |
| 8.4 Force Sign-Out | F-U05 | F-U06 | D1 write, D7 write |
| 8.5 Maintain Catalog | F-A13 | F-A14 | D9 write, D7 write |
| 8.6 Audit Administrative Action | F-U10 | F-U11 | D7 read |
| 8.7 Impersonate Account | F-U07 | F-U08 | D1 read, D7 write |

Every write in `8.x` also appends to `admin_audit_log` (D7). Show that as a store edge from the
sub-process, not as a flow to `8.6`.

---

## 8. Context diagram specification

One process, `0 LCCB Connect`, centred. Ten entities around it. Two flows per entity: one in, one
out, each a noun phrase.

| Entity | Flow into process 0 | Flow out of process 0 |
| --- | --- | --- |
| Student | Account and Content Submission | Session, Feed, and Notification |
| Guest | Public Read Request | Public Content Page |
| Department Administrator | Department Decision | Department Queue and Receipt |
| Administrator | Administrative Directive | Administrative Report |
| Super Administrator | System Directive | System Report |
| Google Identity Service | Identity Assertion | Authentication Request |
| Email Delivery Service | Delivery Notice | Code and Notice Message |
| Object Storage | Media Object | Signed Object URL |
| Push Delivery Service | Delivery Ticket | Push Message |
| Content Screening Service | Screening Verdict | Content Sample |

Rules for this page: no data stores, no internal processes, no entity-to-entity flows, no labels
longer than four words, and every one of the ten entities appears exactly once.

---

## 9. Balance and validation rules

Run these before calling a diagram finished. They are the same checks the generator already applies
geometrically; these are the semantic ones.

1. **Entity set is identical at every level.** Ten entities: E1–E5, S1–S5. No additions, no
   renames, no duplicates per page.
2. **Every Level 1 entity flow appears on exactly one Level 2 page**, under its parent, and keeps
   the same label and direction. §6 is the checklist: 115 flows in total — 66 student, 2 guest,
   10 department administrator, 14 administrator, 13 super administrator, 10 service.
3. **Every process has at least one entity flow in and one out.** If a sub-process has none, it is
   internal and must be folded into a sibling.
4. **No forbidden connections:** entity→entity, store→store, entity→store.
5. **Store ownership:** a Level 2 page may only touch stores its parent touches in §5.
6. **Department scope:** every `6.x` flow involving E3 is filtered by the moderator's department.
7. **No invented processes:** snapshots expire by column default, theses live inside posts, and
   authentication is native (JWT + bcrypt) even though `docs/BACKEND_CONTRACT.md` still describes
   the older Supabase client-side flow.
8. **Flow labels are noun phrases.** "Post Draft", not "Submits draft".

Per-entity totals to expect on the Level 1 page:

| Entity | Flows | in / out | Processes touched |
| --- | --- | --- | --- |
| Student | 66 | 36 / 30 | 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0 |
| Guest | 2 | 1 / 1 | 7.0 |
| Department Administrator | 10 | 4 / 6 | 2.0, 6.0 |
| Administrator | 14 | 6 / 8 | 6.0, 8.0 |
| Super Administrator | 13 | 7 / 6 | 6.0, 8.0 |
| Google Identity Service | 2 | 1 / 1 | 1.0 |
| Email Delivery Service | 2 | 1 / 1 | 1.0, 6.0 |
| Object Storage | 2 | 1 / 1 | 2.0, 4.0 |
| Push Delivery Service | 2 | 1 / 1 | 5.0, 7.0 |
| Content Screening Service | 2 | 1 / 1 | 6.0 |

---

## 10. Traceability

| Process | Routes | Controller / service | Primary models |
| --- | --- | --- | --- |
| 1.0 | `/api/auth/*`, `/api/users`, `/api/verification` | `authController`, `userController`, `verificationController`, `nativeAuth`, `mfaService`, `emailService` | `userModel`, `passwordResetModel`, `verificationModel`, `verificationOtpModel` |
| 2.0 | `/api/posts`, `/api/announcements`, `/api/upload`, `/api/files` | `postController`, `announcementController`, `uploadService`, `objectStorage`, `previewService` | `postModel`, `departmentModel` |
| 3.0 | `/api/posts/:id/{like,repost,save,comments}`, `/api/friends`, `/api/social`, `/api/block` | `postController`, `savedPostController`, `savedCollectionController`, `friendController`, `socialController` | `postModel`, `repostModel`, `savedPostModel`, `savedCollectionModel`, `friendModel`, `blockModel` |
| 4.0 | `/api/snaps`, `/api/snaps/:id/{view,react,comments}` | `snapController` | `snapModel`, `snapCommentModel` |
| 5.0 | `/api/conversations`, `/api/messages`, `/api/social/me/message-policy` | `messageController`, `socialController`, `pushService` | `messageModel`, `socialModel`, `notificationModel` |
| 6.0 | `/api/moderation/*`, `/api/reports`, `/api/messages/:id/report`, `/api/verification/queue` | `moderationController`, `verificationController`, `moderationService`, `auditService` | `reportModel`, `verificationModel`, `adminModel` |
| 7.0 | `/api/search`, `/api/notifications`, `/api/public/*`, `/api/social/me/{presence,heartbeat,device-tokens}` | `searchController`, `publicController`, `moderationController` (notifications), `notificationService`, `pushService` | `searchModel`, `notificationModel`, `publicController` joins |
| 8.0 | `/api/admin/*`, `/api/admin/{departments,courses,academic-levels}` | `adminController`, `catalogController`, `auditService`, `accountService` | `adminModel`, `departmentModel`, `academicLevelModel`, `userModel` |

Two code facts worth stating in any defence of the diagram:

- **Screening is inline, not a queue.** `postController` calls `moderationService.scanPost` /
  `scanComment` during the create/update request and writes `moderation_status` before responding.
- **Notifications are one table with types.** `notifications` covers social events, moderation
  notices, and announcements; `pushService` reads `device_tokens` and posts to Expo.

---

## 11. Decisions, gaps, and how the diagrams handle them

| Issue | Evidence | How the diagram treats it |
| --- | --- | --- |
| Guest is frontend-only | `docs/BACKEND_CONTRACT.md` §2.5; no `guest` role in `utils/roles.js` | Guest keeps one read pair on the CFD and L1; no guest store access, no guest write |
| Faculty looks like a sixth actor | `utils/roles.js`, rank 1 | Folded into Student; it has no flow that a student lacks |
| Theses have their own screens | `frontend/app/(tabs)/capstones.tsx`, `upload-thesis.tsx` | Content type inside D2; no thesis store, no thesis process |
| Snap expiry looks like a scheduled job | migration 059 default `+ 24 hours` | No timer process; reads filter on `expires_at` |
| Screening service is optional | `moderationService.geminiScan` returns null without a key | S5 keeps its two flows; note "fallback: local dictionary" beside the process |
| Announcements are admin content, not admin accounts | `/api/announcements` mount, `posts.type = 'announcement'` | Placed under `2.0`, not `8.0` |
| Contract doc is stale on auth | contract §2.1 vs `authRouter` (`/login`, `/verify-signup`, `/refresh`) | Diagrams follow the code |
| Audit is superadmin-only | `adminRouter` line 58–62 | Audit pair exists only on E5 |

### Recommended page set

The five actor entities stay separable by keeping each one in its own vertical band, and by
ordering the Level 1 processes so that an entity's flows leave from a single side of the page.

| # | Page | Content |
| --- | --- | --- |
| 1 | Context | process 0 + 10 entities |
| 2 | Level 1 | `1.0`–`8.0`, `D1`–`D9`, five actors on the left, five services on the right |
| 3 | Level 2 — Identity | parent `1.0`, children `1.1`–`1.5`, entities E1 + S1 + S2 |
| 4 | Level 2 — Publishing and Interaction | parents `2.0` and `3.0`, entities E1 + E3 + S3 |
| 5 | Level 2 — Snap and Messaging | parents `4.0` and `5.0`, entities E1 + S3 + S4 |
| 6 | Level 2 — Moderation | parent `6.0`, entities E1 + E3 + E4 + E5 + S5 |
| 7 | Level 2 — Discovery | parent `7.0`, entities E1 + E2 + S4 |
| 8 | Level 2 — Administration | parent `8.0`, entities E4 + E5 |

Rule for page 2 that keeps entities separate: Student occupies the left column for every process
it touches; Guest sits below Student and touches only `7.0`; the three administrator entities sit in
a single right-hand lane, ordered by the process they touch, so their edges never cross the student
band or the content store lane.

