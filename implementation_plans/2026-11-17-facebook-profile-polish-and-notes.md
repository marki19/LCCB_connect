# Facebook Profile Polish, Cards & Notes Implementation Plan

## Overview
Polish the Facebook desktop & mobile profile UI, fix feed alignment, restore all Facebook profile cards (Personal details, Education, Contact info, Friends grid, Photos grid), fix the Home icon in DesktopTopBar, implement the Story capture/upload chooser, and build the Notes feature (speech bubble over avatar in Profile and Messenger).

---

## Phases

| Phase | Scope | Est. | Gate |
|---|---|---|---|
| **0** | Baseline re-check | 0.25h | Backend 687 / tsc 0 / lint 65 / vitest 41 |
| **1** | Post card alignment & DesktopTopBar Home icon | 1h | Pixel alignment + House icon |
| **2** | Add to Story chooser modal (Camera vs Gallery) | 1.5h | Action modal with camera & picker options |
| **3** | Facebook profile cards (Personal details, Contact info, Education, Friends & Photos persistence) | 3h | All 5 cards visible, zero disappearing cards |
| **4** | Notes feature backend (Migration 050, schema, routes, tests) | 2.5h | Migration applies, tests green |
| **5** | Notes feature frontend (Avatar speech bubble in Profile & Messenger) | 3h | Note bubble appears on avatar, tap to set/clear note |
| **6** | Verification & Web Build | 1h | All 5 gates pass |

---

## Detailed Phase Breakdown

### Phase 1: Post Card Alignment & Home Icon
- **File**: `frontend/src/components/PostCard.tsx`
  - Accept optional `style?: StyleProp<ViewStyle>` prop to allow callers to override container margin (specifically `marginHorizontal: 0`).
- **File**: `frontend/app/profile/[id].tsx`
  - Pass `style={{ marginHorizontal: 0 }}` to `PostCard` in `feedListWrapper`.
- **File**: `frontend/src/components/topbar/DesktopTopBar.tsx`
  - Replace `Sparkles` icon with `Home` from `lucide-react-native` for the `"all"` category tab.

### Phase 2: Add to Story Chooser Modal
- **File**: `frontend/src/components/profile/StoryActionModal.tsx`
  - Create modal component with options:
    - "Take Photo or Video" (Camera - calls `captureSnap()`)
    - "Upload from Gallery" (Photo/Video picker - calls `pickSnap()`)
    - "Cancel" button
- **File**: `frontend/app/profile/[id].tsx`
  - Wire `onAddStory` to toggle `StoryActionModal` instead of pushing `/create`.

### Phase 3: Facebook Profile Cards
- **File**: `frontend/src/components/profile/ProfilePersonalDetailsCard.tsx`
  - Card showing relationship status (e.g. "Single 🔒") and gender/pronouns, with edit button for owner.
- **File**: `frontend/src/components/profile/ProfileContactInfoCard.tsx`
  - Card showing school email, username handle, and social links.
- **File**: `frontend/src/components/profile/ProfileEducationCard.tsx`
  - Ensure school badge and "La Consolacion College Bacolod" is always displayed with course & department details.
- **File**: `frontend/src/components/profile/ProfileFriendsCard.tsx`
  - Never return `null`; render empty state when friend count is 0, and 3x3 photo grid when friends exist.
- **File**: `frontend/src/components/profile/ProfilePhotosCard.tsx`
  - Never return `null`; render empty state when photo count is 0, and photo grid when photos exist.

### Phase 4: Notes Feature Backend
- **Migration**: `backend/migrations/050_profile_notes.sql`
  - `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS note VARCHAR(60) DEFAULT NULL;`
  - `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS note_updated_at TIMESTAMPTZ DEFAULT NULL;`
- **Backend Model & Validation**:
  - Update `userModel.js` `PROFILE_COLUMNS` to include `note` and `note_updated_at`.
  - Add `setNote(userId, note)` in `userModel.js`.
  - Add `noteSchema = z.object({ note: z.string().trim().max(60).nullable() }).strict()` in `validation/index.js`.
  - Add `PUT /api/users/me/note` and `DELETE /api/users/me/note` in `userRouter.js` and `userController.js`.
  - Add unit test in `backend/tests/user.test.js`.

### Phase 5: Notes Feature Frontend
- **File**: `frontend/src/components/profile/NoteBubble.tsx`
  - Instagram/Facebook-style speech bubble attached over avatar with pointer triangle.
  - Interactive: if `isSelf`, tap opens note editor prompt/modal ("Share a thought... Max 60 chars").
  - If viewing another user, displays their note.
- **File**: `frontend/src/components/profile/ProfileIdentity.tsx`
  - Mount `NoteBubble` directly above avatar.
- **File**: Messaging integration (`frontend/src/components/messages/ThreadPane.tsx`, `ChatsPopover.tsx`)
  - Render compact note bubble above participant avatar when note is present.

### Phase 6: Verification
- Backend test suite: 687+ tests green
- TypeScript: 0 errors
- ESLint: <= 65 errors
- Vitest: 41+ tests green
- Web build: clean export
