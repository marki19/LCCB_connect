# Generalized Posts, Clickable Links, and Mention Picker — Todo List

- [x] **Phase 1: Generalize Repository Fields for All Academic Programs**
  - [x] Update `frontend/src/components/composer/RepositoryFields.tsx` (re-label Technologies -> Tools/Materials/Skills, generalize placeholders, add all-program categories).
  - [x] Update `frontend/app/create.tsx` to handle generalized fields and optional link pasting.
  - [x] Update `frontend/src/components/composer/RepositoryFields.test.tsx` to match new labels.

- [x] **Phase 2: Clickable & Highlighted Links in RichText**
  - [x] Enhance `frontend/src/lib/mentions.ts` to tokenize URLs (`https://...`, `http://...`, `www....`) alongside mentions.
  - [x] Update `frontend/src/components/mentions/RichText.tsx` to render clickable links and clickable mention profiles.
  - [x] Add unit tests in `frontend/src/lib/mentions.test.ts` for URL and mixed URL/mention parsing.

- [x] **Phase 3: Interactive Bottom Sheet / Pop-Up for '@' Mentions**
  - [x] Update `frontend/src/components/mentions/MentionInput.tsx` with responsive bottom-sheet pop-up for mobile and clean overlay for web.
  - [x] Display mentionable contacts (friends & department mates) with avatars, names, handles, and badge.
  - [x] Insert `@username ` on selection and register mention tokens.

- [x] **Phase 4: Verification & Quality Gates**
  - [x] `npx tsc -p frontend/tsconfig.json --noEmit` -> 0 errors.
  - [x] `npm --prefix frontend test -- --run` -> All 73 vitest tests pass across 15 suites.
  - [x] Backend test suite verification -> All 39 tests pass.
