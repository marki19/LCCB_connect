# Reverse Signup Flow with Ghost Account Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Reverse the signup flow to verify OTP before creating Auth user, and add 24-hour cleanup for unverified/ghost accounts

**Architecture:** Pending signup requests stored in database with hashed passwords and OTP codes. Auth user and profile created only after successful OTP verification. Cron job cleans up pending requests and orphaned Auth users after 24 hours.

**Tech Stack:** PostgreSQL, Express, Supabase Admin, Node.js, bcrypt

**Spec:** Security enhancement to prevent orphaned Auth users and improve signup security posture

## Global Constraints

- Email domain locked to `@lccbonline.edu.ph`
- Password minimum 8 characters
- OTP validity: 10 minutes
- Pending signup TTL: 24 hours
- Profile creation only after OTP verification
- No breaking changes to existing frontend UI

## Review Focus

- Orphaned Auth users with no profile after 24h → must be deleted
- Pending signup with weak password hash → bcrypt with salt rounds ≥10
- OTP replay attack → OTP marked used after first successful verification
- Race condition on duplicate email check → database unique constraint required
- Password in pending table → must be hashed, never plaintext

---

### Task 1: Create pending_signups table migration

**Files:**
- Create: `backend/migrations/018_pending_signups.sql`
- Test: `backend/tests/migrations.test.js`

**Interfaces:**
- Produces: `pending_signups` table with email, password_hash, full_name, otp_code, otp_expires_at, created_at, verified_at

- [x] **Step 1: Write failing migration test**
```javascript
// Verify table creation
const result = await pool.query("SELECT * FROM pending_signups LIMIT 1");
assert.equal(result.rows.length, 0);
```

- [x] **Step 2: Run test to verify it fails**
Run: `npm test -- tests/migrations.test.js`
Expected: FAIL with "relation pending_signups does not exist"

- [x] **Step 3: Implement migration**

```sql
CREATE TABLE IF NOT EXISTS public.pending_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  otp_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  UNIQUE(email)
);
CREATE INDEX idx_pending_signups_email ON pending_signups(email);
CREATE INDEX idx_pending_signups_created_at ON pending_signups(created_at);
```

- [x] **Step 4: Run test to verify it passes**
Run: `npm test -- tests/migrations.test.js`
Expected: PASS

- [x] **Step 5: Commit**
```bash
git add backend/migrations/018_pending_signups.sql
git commit -m "feat: add pending_signups table for reverse signup flow"
```

### Task 2: Update requestSignup controller to use pending table

**Files:**
- Modify: `backend/controllers/authController.js:220-283`
- Test: `backend/tests/e2e-signup-flow.test.js`

**Interfaces:**
- Consumes: `pending_signups` table
- Produces: Pending signup record with hashed password and OTP

- [x] **Step 1: Write failing test for pending signup**
```javascript
it("creates pending signup record instead of Auth user", async () => {
  const res = await request(app).post("/api/auth/request-signup").send({...});
  assert.equal(res.status, 202);
  // Verify no Auth user created yet
  const authUser = await supabase.auth.admin.listUsers();
  assert.equal(authUser.users.find(u => u.email === email), undefined);
});
```

- [x] **Step 2: Run test to verify it fails**
Expected: FAIL with Auth user created

- [x] **Step 3: Implement requestSignup**
- Hash password with bcrypt
- Generate OTP
- Insert into pending_signups
- Send OTP email via Supabase resend or custom service
- Return 202

- [x] **Step 4: Run test to verify it passes**
Run: `npm test -- tests/e2e-signup-flow.test.js`
Expected: PASS

- [x] **Step 5: Commit**
```bash
git add backend/controllers/authController.js
git commit -m "feat: reverse signup flow - store pending signup"
```

### Task 3: Update verifySignup to create Auth user from pending

**Files:**
- Modify: `backend/controllers/authController.js:117-171`
- Test: `backend/tests/e2e-signup-flow.test.js`

**Interfaces:**
- Consumes: `pending_signups` table
- Produces: Auth user + profile

- [x] **Step 1: Write failing test for Auth creation on verify**
```javascript
it("creates Auth user only after OTP verification", async () => {
  // Request signup
  await request(app).post("/api/auth/request-signup").send({...});
  // Verify OTP
  const res = await request(app).post("/api/auth/verify-signup").send({email, token});
  assert.equal(res.status, 201);
  // Verify Auth user exists
  assert.ok(await authUserExists(email));
});
```

- [x] **Step 2: Run test to verify it fails**

- [x] **Step 3: Implement verifySignup**
- Verify OTP against pending_signups
- Check expiry and not already verified
- Create Auth user with password from pending record
- Create profile
- Delete pending record
- Return session

- [x] **Step 4: Run test to verify it passes**

- [x] **Step 5: Commit**

### Task 4: Add cleanup job for pending signups

**Files:**
- Create: `backend/scripts/cleanup-expired-pending-signups.js`
- Test: `backend/tests/migrations.test.js` (integration)

**Interfaces:**
- Consumes: `pending_signups` table
- Produces: Deleted records older than 24h

- [x] **Step 1: Write failing test**
```javascript
it("deletes pending signups older than 24h", async () => {
  // Create old pending record
  await insertOldPendingSignup();
  await cleanupPendingSignups();
  const record = await getPendingSignup(email);
  assert.equal(record, null);
});
```

- [x] **Step 2: Run test to verify it fails**

- [x] **Step 3: Implement cleanup**
```javascript
async function cleanupExpiredPendingSignups() {
  await pool.query(
    "DELETE FROM pending_signups WHERE otp_expires_at < NOW() - INTERVAL '24 hours' AND verified_at IS NULL"
  );
}
```

- [x] **Step 4: Run test to verify it passes**

- [x] **Step 5: Commit**

### Task 5: Add cleanup job for ghost Auth users

**Files:**
- Create: `backend/scripts/cleanup-ghost-auth-users.js`
- Test: `backend/tests/migrations.test.js` (integration)

**Interfaces:**
- Consumes: `auth.users` and `profiles`
- Produces: Deleted orphaned Auth users

- [x] **Step 1: Write failing test**
```javascript
it("deletes Auth users without profile older than 24h", async () => {
  // Create Auth user without profile
  await createAuthUserWithoutProfile();
  await cleanupGhostUsers();
  assert.equal(await authUserExists(email), false);
});
```

- [x] **Step 2: Run test to verify it fails**

- [x] **Step 3: Implement cleanup**
```javascript
async function cleanupGhostUsers() {
  // Find Auth users created >24h ago with no profile
  // Delete from auth.users
}
```

- [x] **Step 4: Run test to verify it passes**

- [x] **Step 5: Commit**

### Task 6: Update validation and tests

**Files:**
- Modify: `backend/validation/index.js`
- Modify: `backend/tests/e2e-signup-flow.test.js`
- Modify: `backend/tests/login.test.js`

**Interfaces:**
- All existing tests must pass with new flow

- [x] **Step 1: Update tests for new flow**
- Verify pending signup created
- Verify no Auth user before verification
- Verify cleanup works

- [x] **Step 2: Run full test suite**
Run: `npm test`
Expected: All 296+ tests pass

- [x] **Step 3: Commit**

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Password hashing in DB | High | Use bcrypt with salt rounds 12, never store plaintext |
| OTP replay | Medium | Mark OTP as used, delete pending record after verification |
| Race condition on email | Medium | Unique constraint on pending_signups.email + auth.users.email |
| Cron job failure | Low | Log deletions, monitor with alerting |
| Migration rollback | Low | Test migration down script |

## Open Questions

- Should pending signups receive rate limiting? Currently signup rate limiter removed, will be re-added in final stage
- Should we keep existing Auth users created before this change? Yes, cleanup job handles them
- What email service for OTP? Use existing Supabase email or custom?
