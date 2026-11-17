# Task List: Native-First Client Auth & Private File Authorization

- [x] C1.1: `backend/models/userModel.js` - Replace SELECT * and RETURNING * with PROFILE_COLUMNS
- [x] C1.2: `backend/utils/profile.js` - Add sanitizeProfile(row) removing password_hash & wire into authController
- [x] C1.3: `backend/tests/profile-serialization.test.js` - Assert no response contains password_hash
- [x] C1.4: `backend/services/nativeAuth.js` - Enforce JWT_SECRET throw on startup & remove hardcoded fallbacks
- [x] C1.5: `backend/routes/fileRouter.js` - Add auth + ownership verification for theses and documents (404 on unauth)
- [x] C1.6: Fix open risks in C1 (`verifySignup` preserve role, log Supabase sync failure)
- [x] C2.1: `backend/migrations/046_refresh_tokens.sql` - Create table, indexes, drop default email_confirmed_at
- [x] C2.2: `backend/services/nativeAuth.js` - Persist jti, 15m access / 30d refresh TTL, token rotation, logout revocation
- [x] C2.3: `backend/init-schema.sql` - Update baseline to 046 with refresh_tokens table
- [x] C3.1: `frontend/src/lib/session.ts` - Implement platform token store (SecureStore / localStorage)
- [x] C3.2: `frontend/src/lib/auth.ts` - Wire installSession to store & implement refreshSession()
- [x] C3.3: `frontend/src/lib/api.ts` - Attach token from store & handle 401 transparent auto-refresh
- [x] C3.4: `frontend/src/contexts/AuthContext.tsx` & `SettingsSidebar.tsx` - Wire native session subscribe & logout
- [x] C3.5: Frontend test suite updates for native session store
- [x] C4.1: `backend/scripts/migrate.js` - Don't close pool in finally unless entry point
- [x] C4.2: `frontend/src/lib/upload.ts` - Remove unused Supabase import
- [x] C4.3: Final test runs & verification
