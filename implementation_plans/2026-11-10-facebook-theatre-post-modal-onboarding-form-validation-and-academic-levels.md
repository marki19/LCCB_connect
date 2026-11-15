# Facebook-Style Post Theatre View Modal, Onboarding Form Validation, and Superadmin Academic Levels

## Context & Motivation
1. **Onboarding Form Validation**: The current onboarding/completion form allows arbitrary text in Year Level (`3rddad`) and invalid birthdates (`2006-19-19`). The user requested Year Level to be a dropdown (`1st Year`, `2nd Year`, `3rd Year`, `4th Year`, etc.) with customizable levels (e.g., `IBED`, `Integrated Studies`) that Superadmins can add from the admin dashboard.
2. **Post Theatre View Modal**: Opening a post on desktop currently renders a standard vertical feed card. As demonstrated in user attachment `media_1794316562217_77e78d13.jpg`, opening a post must display Facebook's split Theatre View: post media/content on the left dark backdrop, and a fixed right sidebar containing the author, caption, engagement stats, scrollable comments stream, and sticky comment composer.
3. **Comment Gating & Error Feedback**: Submitting comments currently fails silently when a student profile is incomplete because the backend enforces `requireVerified` on `POST /api/posts/:id/comments`, while the frontend optimistically inserted the comment without checking `res.ok`.
4. **Merge Conflict Cleanup**: `frontend/app/post/[id].tsx` contains leftover git merge conflict markers (`<<<<<<< HEAD`) from an earlier merge that must be cleanly resolved.

---

## Architecture & Implementation Plan

### Phase 1: Onboarding & Completion Form Validation
- **Year Level Dropdown**: Replace the text input with `SelectField` in `frontend/app/onboarding.tsx`. Populate with options fetched from `/api/public/academic-levels`, falling back to default years (`1st Year` through `5th Year`).
- **Birthdate Validation**: Add strict date format validation (`YYYY-MM-DD`), validating valid month (01–12), valid days for the month, and a realistic year range (1900 to current year).
- **Student ID Constraints**: Allow alphanumeric characters and dashes (`/^[A-Za-z0-9-]+$/`) up to 30 characters, rejecting invalid symbols.
- **Backend Validation**: Update `createVerificationSchema` in `backend/validation/index.js` with regexes and date parsing.

### Phase 2: Superadmin Customizable Academic Levels
- **Database Migration (`035_academic_levels.sql`)**:
  ```sql
  CREATE TABLE IF NOT EXISTS public.academic_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  INSERT INTO public.academic_levels (name, code, sort_order) VALUES
    ('1st Year', '1ST_YEAR', 1),
    ('2nd Year', '2ND_YEAR', 2),
    ('3rd Year', '3RD_YEAR', 3),
    ('4th Year', '4TH_YEAR', 4),
    ('5th Year', '5TH_YEAR', 5),
    ('IBED', 'IBED', 6),
    ('Integrated Studies', 'INTEGRATED_STUDIES', 7)
  ON CONFLICT DO NOTHING;
  ```
- **Backend Endpoints**:
  - `GET /api/public/academic-levels`: Public read endpoint returning active levels ordered by `sort_order`.
  - `GET /api/admin/academic-levels`: Superadmin list endpoint.
  - `POST /api/admin/academic-levels`: Superadmin create endpoint.
  - `PUT /api/admin/academic-levels/:id`: Superadmin update / toggle active status.
  - `DELETE /api/admin/academic-levels/:id`: Superadmin deactivate / delete endpoint.
- **Admin Dashboard UI**: In `frontend/app/(admin)/`, add Academic Levels management tab allowing superadmins to create custom academic levels.

### Phase 3: Facebook-Style Post Theatre View Modal (Comments on Side)
- **Resolve Merge Conflicts**: Clean up `frontend/app/post/[id].tsx` lines 151-154 and 162-190.
- **Desktop Split Layout (width >= 1024px)**:
  - **Left Area (flex: 1)**: Full-height dark theater canvas (`#000000` / `#0A0F1D`). Displays the post's media (single image, multi-image gallery with navigation arrows, code snippet, or web app preview card) with an overlay Close (X) button in the top left.
  - **Right Sidebar (fixed 420px width)**:
    - **Header**: Author avatar, author name, timestamp, privacy badge, more options menu.
    - **Scrollable Body**:
      - Post text content & hashtags.
      - Reaction counts (Like count, comment count, share count).
      - Action bar: Like button (interactive with active filled state), Comment button, Share button.
      - Comments stream: Scrollable list of comments with author avatars, names, relative timestamps, and delete/actions for comment owners.
    - **Sticky Footer Composer**: User avatar, auto-expanding comment text input, and send button.
- **Mobile Responsive Fallback**: Single vertical column with media, text, actions, and comments below.

### Phase 4: Comment Verification Check & Error Handling
- In `frontend/app/post/[id].tsx`:
  - Before sending `POST /posts/:id/comments`, verify `profile?.role !== "student" || profile?.profile_completed`.
  - If incomplete, alert the user with a direct shortcut to `/onboarding`.
  - Check `res.ok` on `apiFetch` in `addComment` and roll back optimistic comment updates if the backend responds with 403 or error.

---

## Verification & Testing
1. `npm test` in `backend` — all 409+ test suites must pass.
2. `npx tsc --noEmit` in `frontend` — 0 TypeScript compilation errors.
3. Test onboarding form validation with invalid birthdate (`2006-19-19`) and invalid year level (`3rddad`) — both must be blocked with explicit error feedback.
4. Verify desktop theatre view modal opens with media on the left and comments on the right.

