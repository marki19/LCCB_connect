# Task List: Facebook Theatre Post Modal, Onboarding Form Validation, and Academic Levels

## Phase 1: Onboarding & Completion Form Validation
- [x] **Task 1.1**: In `frontend/app/onboarding.tsx`, replace free-text `year_level` with `SelectField` dropdown using standard year levels (`1st Year` through `5th Year`) and dynamic options.
- [x] **Task 1.2**: In `frontend/app/onboarding.tsx`, add strict birthdate validation (`YYYY-MM-DD`, valid month/day ranges, 1900-current year) and student ID alphanumeric constraints.
- [x] **Task 1.3**: In `backend/validation/index.js`, add date regex & range checks for birthdate and year level string checks.
- [x] **Checkpoint 1**: Verify `3rddad` and `2006-19-19` are rejected with descriptive validation errors.

## Phase 2: Superadmin Customizable Academic Levels
- [x] **Task 2.1**: Create migration `backend/migrations/035_academic_levels.sql` with table `academic_levels` and default seeds.
- [x] **Task 2.2**: In `backend/routes/catalogRouter.js` and `adminRouter.js`, add public `GET /api/public/academic-levels` and superadmin CRUD routes.
- [x] **Task 2.3**: In `frontend/app/(admin)/`, add Academic Levels management panel allowing superadmins to create custom academic levels.
- [x] **Checkpoint 2**: Verify superadmin can add custom levels (like `IBED`) and they appear in the onboarding dropdown.

## Phase 3: Facebook-Style Post Theatre View Modal
- [x] **Task 3.1**: In `frontend/app/post/[id].tsx`, clean up git merge conflict markers (`<<<<<<< HEAD`).
- [x] **Task 3.2**: Refactor `frontend/app/post/[id].tsx` into split desktop layout: Left full-height dark theatre media canvas + Right 420px sidebar with author, text, engagement, comments stream, and sticky comment composer.
- [x] **Checkpoint 3**: Verify post details on desktop match the Facebook Theatre View screenshot.

## Phase 4: Comment Verification & Error Feedback
- [x] **Task 4.1**: In `frontend/app/post/[id].tsx`, add profile completion check before posting comments, prompting users to complete their profile if incomplete.
- [x] **Task 4.2**: Handle `res.ok` and error statuses in `addComment`, rolling back optimistic additions on 403.
- [x] **Checkpoint 4**: Run `cd backend; npm test` and `cd frontend; npx tsc --noEmit`.
