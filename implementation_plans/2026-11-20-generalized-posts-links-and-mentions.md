# Generalized Posts, Clickable Links, and Mention Picker Sheet

## Context & User Requirements
1. **Generalize beyond IT**:
   - Posts and repository submissions must cater to all courses and academic programs across LCCB (Architecture, Business, Hospitality, Tourism, Nursing, Education, Fine Arts, and IT).
   - "Technologies (comma-separated)" and "Repository URL" are currently IT-biased. They must be generalized into flexible fields (Tools, Materials, or Skills; Project / Resource Link).
   - Pasting a link directly into the post caption must be fully optional and supported.
2. **Clickable & Highlighted Links**:
   - Any URL in a caption or post body (`https://...`, `http://...`, `www....`) must be highlighted in link color and clickable to open externally.
3. **Mentions**:
   - Mentions (`@username`) must be highlighted and clickable to open user profiles.
   - Mentioned users must receive a notification, and clicking that notification must navigate directly to the post.
   - Typing `@` opens a responsive pop-up window from the bottom displaying contacts that can be mentioned (department mates and friends), with live filtering.
4. **Responsive & Mobile Warnings**:
   - Clean responsive layout on both web and mobile, avoiding layout clipping and mobile-only warnings.

---

## Architecture & Implementation Slices

### Phase 1: Generalize Repository Fields for All Programs
- **Files**:
  - `frontend/src/components/composer/RepositoryFields.tsx`
  - `frontend/app/create.tsx`
  - `frontend/src/components/composer/RepositoryFields.test.tsx`
- **Changes**:
  - Replace "Technologies (comma-separated)" with "Tools, Materials, or Skills (optional)" with multi-program placeholder `"e.g. AutoCAD, SPSS, React, Figma, Oil on Canvas, Financial Modeling"`.
  - Replace "Repository URL" with "Project or Resource Link (optional)" with placeholder `"https://... (Portfolio, Google Drive, Behance, GitHub, Canva)"`.
  - Replace "Live Demo URL" with "Demo / Live Presentation Link (optional)".
  - Add generalized category options: `"Capstone"`, `"Thesis"`, `"Dissertation"`, `"Research Paper"`, `"Creative Portfolio"`, `"Case Study"`, `"Feasibility Study"`.
  - Ensure links in captions are cleanly recognized without forcing dedicated repository links.

### Phase 2: Clickable & Highlighted Links in RichText
- **Files**:
  - `frontend/src/lib/mentions.ts`
  - `frontend/src/lib/mentions.test.ts`
  - `frontend/src/components/mentions/RichText.tsx`
- **Changes**:
  - Implement URL regex extraction alongside mentions in `renderRichText(text, mentions)`:
    - Matches standard HTTP/HTTPS URLs and `www.` prefixes.
    - Yields segments with `{ text, url }` or `{ text, username, user_id }` or `{ text }`.
  - In `RichText.tsx`:
    - URL segments render as clickable `<Text>` with `colors.action` (`#0284C7`), underline, and `Linking.openURL(url)`.
    - Mention segments render with `colors.primary`, font weight 600, and `router.push('/profile/' + user_id)`.
  - Unit tests verifying mixed text: `"Check https://lccb.edu.ph and @mark's work"`.

### Phase 3: Bottom Sheet / Pop-Up for '@' Mentions
- **Files**:
  - `frontend/src/components/mentions/MentionPickerSheet.tsx` (or enhanced `MentionInput.tsx`)
  - `frontend/src/components/mentions/MentionInput.tsx`
  - `frontend/app/create.tsx`
- **Changes**:
  - When caret touches `@`, detect query via `mentionQueryAt`.
  - Instead of clipping inside the composer's scroll view with an absolute position, render a responsive bottom sheet pop-up modal on mobile (and anchored/modal overlay on web).
  - Fetches contacts from `GET /api/users/mentionable?q=${query}`.
  - Lists contacts with Avatar, Full Name, `@username`, and contact badge (Friend / Department).
  - Tapping a contact inserts `@username ` at caret position, adds token to `mentions`, and closes the sheet.

### Phase 4: Verification & Quality Gates
- **Checks**:
  - `npx tsc -p frontend/tsconfig.json --noEmit` -> 0 errors.
  - `npm --prefix frontend test -- --run` -> All suites pass.
  - `$env:ALLOW_REMOTE_TEST_DB='true'; node --test backend/tests/validation.test.js backend/tests/mentions.test.js` -> 0 failures.
