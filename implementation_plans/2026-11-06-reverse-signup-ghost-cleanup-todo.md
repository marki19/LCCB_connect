# Reverse Signup Flow with Ghost Account Cleanup - Task List

## Phase 1: Foundation
- [x] Task 1: Create pending_signups table migration
- [x] Task 2: Update requestSignup controller to use pending table
- [x] Checkpoint: Migration applied, tests pass

## Phase 2: Core Features
- [x] Task 3: Update verifySignup to create Auth user from pending
- [x] Task 4: Add cleanup job for pending signups
- [x] Task 5: Add cleanup job for ghost Auth users
- [x] Checkpoint: E2E flow works end-to-end

## Phase 3: Polish
- [x] Task 6: Update validation and tests
- [x] Checkpoint: All tests pass, ready for review
