# LCCB Connect - UI/UX Overhaul Implementation Plan

## Overview
Address fundamental UI/UX issues across the app based on user feedback from screenshots. Focus on: presence accuracy, social graph integrity, header/sidebar redesign, messaging UX, onboarding flow, and responsiveness.

---

## Phase 1: Presence & Social Graph Accuracy (Critical)

### 1.1 Fix Campus Peers Online Status
**Problem:** `GET /api/public/peers` returns ALL users; frontend shows green "active" badge for everyone regardless of actual presence.

**Root Cause:** 
- `publicController.getPeers` → `userModel.getAllUsers` returns all profiles
- Frontend `HomeScreen.fetchActivePeers` calls `/public/peers` and renders all with hardcoded `colors.jade` dot
- No integration with `PresenceContext.presences` (Realtime presence)

**Solution:**
- Add optional `?online=true` filter to `/api/public/peers` that cross-references Supabase Realtime presence
- Or: create new endpoint `/api/presence/active` requiring auth that returns only online users
- Frontend: use `usePresence().isOnline(id)` to determine badge color
- Default peers list (unauthenticated) shows no status badge; authenticated view shows real presence

**Files:**
- `backend/controllers/publicController.js` - add online filter
- `backend/models/userModel.js` - add `getOnlineUsers` or filter param
- `frontend/app/(tabs)/index.tsx` - integrate `usePresence().isOnline`
- `frontend/src/components/PeerPicker.tsx` - show presence for authenticated users

### 1.2 Filter Campus Peers by Social Graph
**Problem:** Non-friends appear in "Campus Peers" rail; user hasn't sent/accepted friend requests.

**Root Cause:** `/api/public/peers` returns all users unfiltered.

**Solution:**
- Authenticated requests to `/api/public/peers` should support `?scope=friends` or `?scope=network`
- `scope=friends` → only accepted friends (mutual)
- `scope=network` → friends + pending requests + same department (configurable)
- Default (unauthenticated) → all users (public directory)
- Update `HomeScreen` to use `scope=friends` for right rail; `PeerPicker` uses `scope=network` for "New message"

**Files:**
- `backend/controllers/publicController.js` - add scope parameter
- `backend/models/userModel.js` - add `getFriends`, `getNetwork` queries
- `frontend/app/(tabs)/index.tsx` - pass `scope=friends`
- `frontend/src/components/PeerPicker.tsx` - pass `scope=network`

### 1.3 Remove Self from Peer Lists
**Problem:** User sees themselves in PeerPicker and can message themselves.

**Solution:**
- Backend: exclude current user ID from `/api/public/peers` when authenticated
- Frontend: defensive filter `peers.filter(p => p.id !== profile.id)` (already in PeerPicker line 67, verify HomeScreen)

---

## Phase 2: Header Redesign (Icons Only)

### 2.1 Desktop Web Top Bar (`_layout.tsx`)
**Current:** Text labels ("Campus network", "Create post", "Admin console") alongside icons.
**Target:** Icons only with tooltips; labels appear on hover/focus.

**Changes:**
- `DesktopTab` component: `showLabel` prop driven by hover/focus state, not width breakpoint
- `webCreateButton`: icon-only, tooltip "Create post"
- `webAdminButton`: icon-only, tooltip "Admin console"
- Brand wordmark: keep "LCCB Connect" (identity), remove "Campus network" subtitle

### 2.2 Mobile Header (`HomeHeader.tsx`)
**Current:** Already icon-only (menu, theme, search, messages) ✓
**Verify:** No text labels on mobile header.

### 2.3 Tab Bar Labels
**Current:** Mobile shows labels under icons; Desktop shows labels beside icons.
**Target:** 
- Mobile: keep labels (accessibility)
- Desktop: icons only, labels on hover

---

## Phase 3: Sidebar Interactivity

### 3.1 Left Rail (Desktop) - `index.tsx` lines 431-540
**Current:** Static links with active states.
**Enhancements:**
- Collapsible sections (Shortcuts, Messaging, Institution)
- Hover previews for "Messages" showing unread count badge
- Drag-to-reorder shortcuts (persist to localStorage)
- Keyboard shortcuts (1-9 for first 9 items)
- Mini-profile card at top: click → profile, hover → quick actions (status, theme)

### 3.2 Right Rail (Desktop) - `index.tsx` lines 915-1096
**Current:** "Deposit manuscript", "Academic deadlines", "Campus peers" (all users)
**Redesign:**
- **Module system:** Each card is a plugin; user can enable/disable/reorder in Settings
- **Default modules:**
  1. Campus Peers (friends only, real presence) - *keep*
  2. Quick Actions (create post, upload thesis) - *new*
  3. Upcoming Deadlines (from calendar API) - *configurable*
  4. Repository Stats (my posts, my theses, views) - *new*
- **Remove:** "Deposit a manuscript" card (redundant with Create button), "Academic deadlines" (unless calendar integration)

### 3.3 Settings Sidebar (`SettingsSidebar.tsx`)
**Current:** Static menu.
**Enhancements:**
- Collapsible sections with icons
- Live toggle for Dark Mode (already has Switch)
- Module manager for right rail (enable/disable/reorder)
- Keyboard navigation (arrow keys, Enter, Esc)

---

## Phase 4: Messaging UX Overhaul

### 4.1 PeerPicker (`PeerPicker.tsx`)
**Issues:**
- Shows ALL users including self (line 67 filters but verify)
- "Message" button always visible; should respect "who can message me" policy
- No visual distinction between friends (direct) and non-friends (request)

**Fixes:**
- ✓ Self-filter exists (line 67)
- Add `policy` field from `/api/conversations/preview?peer_id=X` (or extend peers API)
- Button label: "Message" (friends/direct) vs "Request" (non-friends)
- Visual indicator: lock icon for restricted users
- Group list: "Friends" → "Campus" → "Other departments"

### 4.2 Friends Screen (`friends.tsx`)
**Issues:**
- Can message self? No - only shows accepted friends (line 48 `listFriends`)
- But: `startChat` allows any peer from `ConversationPeer` type
**Verify:** `listFriends` only returns mutual friends → cannot message self ✓

### 4.3 Messages Inbox (`messages/index.tsx`)
**Current:** Works correctly - only shows conversations user participates in.

---

## Phase 5: Remove "Hello Mark" Hero Banner

### 5.1 HomeScreen Hero Section (lines 562-678)
**Current:** Large gradient card with greeting, date, stats, "Share" button.
**User Feedback:** "Remove that, its not important. its like an admin dashboard."

**Options:**
- **Option A (Minimal):** Remove entire hero gradient card; feed starts immediately
- **Option B (Compact):** Reduce to single-line status bar: "6 active · 12 posts" with Create button
- **Option C (Contextual):** Show only for new users (< 5 posts); hide for active users

**Recommendation:** Option B - compact stats bar, no greeting, no gradient.

**Files:** `frontend/app/(tabs)/index.tsx` - replace ListHeaderComponent hero with compact bar.

---

## Phase 6: Profile Completion Onboarding

### 6.1 Requirement
After signup + email verification → modal prompting profile completion (department, course, year, bio, avatar).
- Can "Skip for now" but write actions (posts, messages, thesis deposit) disabled
- Read-only access maintained
- Persistent banner/nag until complete
- Completion unlocks all features

### 6.2 Implementation
**Backend:**
- Add `profile_completed_at` timestamp to `profiles` table (nullable)
- Add `is_profile_complete` computed property or check in middleware
- Middleware `requireCompleteProfile` for write endpoints

**Frontend:**
- `AuthContext`: track `profileComplete` boolean
- `ProfileCompletionModal` component (full-screen modal, not dismissible except "Skip")
- `useProfileCompletion` hook: checks on app load, shows modal if incomplete
- Write endpoints: check before mutation, show toast + open modal if incomplete

**Files:**
- `backend/migrations/XXX_profile_completion.sql`
- `backend/middleware/requireCompleteProfile.js`
- `backend/controllers/*.js` - apply middleware to create post, send message, upload thesis
- `frontend/src/contexts/AuthContext.tsx` - add profileComplete state
- `frontend/src/components/ProfileCompletionModal.tsx` (new)
- `frontend/src/hooks/useProfileCompletion.ts` (new)
- `frontend/app/(tabs)/index.tsx` - integrate hook

---

## Phase 7: Right Rail Cleanup

### 7.1 Remove "Deposit a Manuscript" Card
- Redundant with Create (+) button in tab bar and hero
- Remove lines 926-978 in `index.tsx`

### 7.2 Remove "Academic Deadlines" Card
- Hardcoded "Capstone Title Defense" - not dynamic
- Unless calendar integration exists, remove lines 980-1016

### 7.3 Keep "Campus Peers" but Fix
- Filter to friends only (Phase 1.2)
- Show real presence (Phase 1.1)
- Make collapsible

---

## Phase 8: Responsiveness Audit

### 8.1 Breakpoints (from `_layout.tsx` and `index.tsx`)
| Breakpoint | Current Use | Action |
|------------|-------------|--------|
| `< 380` | `compact` in HomeHeader | Verify |
| `< 480` | `compact` in HomeScreen | Verify |
| `< 768` | Mobile tab bar / no desktop rails | Verify |
| `< 1120` | `compactNav` in desktop top bar | Verify |
| `< 1200` | `isDesktopWeb` left rail | Verify |
| `< 1320` | `compactActions` admin button | Verify |
| `< 1600` | `isWideWeb` wider rails | Verify |

### 8.2 Test Matrix
| Device | Width | Left Rail | Right Rail | Top Bar | Tab Bar |
|--------|-------|-----------|------------|---------|---------|
| Mobile portrait | 375 | Hidden (hamburger) | Hidden | Hidden | Bottom |
| Mobile landscape | 667 | Hidden | Hidden | Hidden | Bottom |
| Tablet | 768-1024 | Hidden | Hidden | Icons only | Bottom |
| Desktop small | 1200 | Visible (272px) | Visible (312px) | Icons + labels on hover | Top |
| Desktop large | 1600+ | Visible (320px) | Visible (320px) | Icons + labels on hover | Top |

### 8.3 Specific Fixes
- PeerPicker modal: max-width 520px on desktop, full-width mobile
- SettingsSidebar: 360px desktop, 78% mobile (max 360px) ✓
- PostCard: max-width 760px / 860px ✓
- Hero gradient: responsive padding ✓
- Filter chips: horizontal scroll ✓

---

## Phase 9: Technical Debt & Polish

### 9.1 Avatar Component
- Verify `showPresence` prop correctly reads `mode` and shows colored dot
- Current: `Avatar` in `friends.tsx` line 189, `messages/index.tsx` line 138, `index.tsx` line 1052

### 9.2 Presence Colors
- `online` → green (`colors.jade`)
- `away` → yellow (`colors.amber`)
- `busy` → red (`colors.destructive`)
- `invisible` → gray (`colors.inkFaint`)
- `offline` → no dot

### 9.3 Accessibility
- All icon-only buttons: `accessibilityLabel` required ✓
- Focus rings: `focusRing` token used ✓
- Color contrast: verify jade dot on surface backgrounds

### 9.4 Performance
- `activePeers` fetch: limit 20, not 100
- Presence subscription: only for visible peers (current subscribes to all)
- Debounce peer list renders

---

## File Inventory

### Backend (New/Modified)
```
backend/
├── migrations/
│   └── XXX_profile_completion.sql           (NEW)
├── middleware/
│   └── requireCompleteProfile.js            (NEW)
├── controllers/
│   └── publicController.js                  (MODIFY: scope, online filter)
├── models/
│   └── userModel.js                         (MODIFY: getFriends, getNetwork)
└── routes/
    └── publicRouter.js                      (MODIFY: pass scope param)
```

### Frontend (New/Modified)
```
frontend/
├── src/
│   ├── contexts/
│   │   └── AuthContext.tsx                  (MODIFY: profileComplete)
│   ├── hooks/
│   │   └── useProfileCompletion.ts          (NEW)
│   ├── components/
│   │   ├── ProfileCompletionModal.tsx       (NEW)
│   │   ├── HomeHeader.tsx                   (MODIFY: verify icons only)
│   │   ├── SettingsSidebar.tsx              (MODIFY: module manager)
│   │   ├── Avatar.tsx                       (VERIFY: presence colors)
│   │   └── PeerPicker.tsx                   (MODIFY: policy labels, grouping)
│   └── lib/
│       └── api.ts                           (MODIFY: peers API params)
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx                        (MODIFY: hero, rails, peers)
│   │   ├── _layout.tsx                      (MODIFY: header icons only)
│   │   └── search.tsx                       (VERIFY)
│   ├── messages/
│   │   ├── index.tsx                        (VERIFY)
│   │   └── [id].tsx                         (VERIFY)
│   └── friends.tsx                          (VERIFY)
```

---

## Dependencies

### Backend
- No new packages needed

### Frontend
- No new packages needed (all UI with existing `lucide-react-native`, `react-native` primitives)

---

## Testing Strategy

### Unit Tests
- `requireCompleteProfile` middleware: blocks write endpoints when incomplete
- `userModel.getFriends` / `getNetwork`: correct SQL, filters self
- `publicController.getPeers`: scope=online/friends/network filters

### Integration Tests
- Signup → verify → profile incomplete → write action blocked → modal shows
- Profile complete → write action succeeds
- Peers API: unauth=all, auth+scope=friends=mutual only
- Presence: green dot only for actual online users

### E2E Scenarios
1. New user: signup → verify → sees modal → completes → can post/message
2. Existing user: incomplete profile → tries to post → blocked → completes → succeeds
3. Campus peers rail: shows only friends with real presence dots
4. Header: desktop shows icons only, hover shows labels
5. Right rail: modular, user can disable "Campus Peers"
6. Responsive: test all breakpoints in browser dev tools

---

## Priority Order

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| P0 | 1.1, 1.2, 1.3 | Medium | High (trust/security) |
| P0 | 5 | Low | High (user complaint) |
| P0 | 6 | High | High (onboarding) |
| P1 | 2 | Low | Medium (polish) |
| P1 | 3 | Medium | Medium (usability) |
| P1 | 4 | Medium | High (core feature) |
| P1 | 7 | Low | Low (cleanup) |
| P2 | 8 | Medium | Medium (quality) |
| P2 | 9 | Low | Low (polish) |

---

## Notes

- **Presence Architecture:** Current `PresenceContext` uses Supabase Realtime broadcast. The `presences` object maps `userId → PresenceState[]`. `isOnline(id)` checks `Boolean(presences[id]?.length)`. This is correct for realtime presence but doesn't persist "last seen" for offline users. Consider adding `last_seen_at` to profiles for "last seen 5m ago" UI.

- **Friend vs Network:** "Friends" = mutual accepted. "Network" = friends + pending incoming/outgoing + same department (opt-in). This matches Facebook/LinkedIn mental models.

- **Profile Completion Fields:** Minimum: `department_id`, `course_id`, `year_level`, `full_name`, `avatar_url`. Optional: `bio`, `student_id`.

- **Migration Safety:** `profile_completed_at` nullable, default null. Backfill: `UPDATE profiles SET profile_completed_at = NOW() WHERE department_id IS NOT NULL AND course_id IS NOT NULL AND year_level IS NOT NULL AND full_name IS NOT NULL;`