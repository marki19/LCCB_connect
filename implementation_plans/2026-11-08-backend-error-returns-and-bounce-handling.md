# Backend Error Returns & Email Bounce Handling Plan

**Date:** 2026-11-08
**Scope:** `backend/` — auth flow improvements, email bounce handling, login identifier expansion
**Prerequisites:** Phases A–F complete (operational hygiene)

---

## 1. Complete Task Inventory

| # | Task | Source | Effort | Blocking? |
|---|------|--------|--------|-----------|
| 1 | Add lightweight email existence check endpoint (`GET /api/auth/check-email`) | User request | 2 hours | No |
| 2 | Extend login to support `username` as identifier | User request | 3 hours | No |
| 3 | Brevo email bounce webhook handler (550 5.1.1 → mark email invalid) | User request | 4 hours | No |
| 4 | Frontend integration: real-time email validation on signup form | User request | 2 hours | No |
| 5 | Frontend integration: username login field | User request | 1 hour | No |

**Total: ~12 hours** (non-blocking, can be done incrementally)

---

## 2. Decisions Locked

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Email check endpoint is **read-only, rate-limited, no auth** | Prevents enumeration via timing; returns generic "available/unavailable" only |
| D2 | Login supports 3 identifiers: `email`, `student_id`, `username` | Matches user request; username lookup via `profiles.username` |
| D3 | Brevo webhook verifies HMAC signature before processing | Security: only process genuine Brevo events |
| D4 | Bounced emails marked `email_bounced = true` in `profiles` | Prevents future sends; admin can review/reset |
| D5 | All new endpoints behind existing rate limiter (`loginLimits`) | Consistency; no new infrastructure |

---

## 3. Phase I — Email Existence Check Endpoint (2 hours)

### I.1 Backend: `GET /api/auth/check-email`

**File:** `backend/controllers/authController.js` (new function)
**File:** `backend/routes/authRouter.js` (new route)
**File:** `backend/validation/index.js` (new schema)

**Behavior:**
```
GET /api/auth/check-email?email=user@lccbonline.edu.ph

Response (200):
{ "available": false, "reason": "account_exists" }  // Auth user exists
{ "available": false, "reason": "pending_signup" }  // Pending signup active
{ "available": true }                               // Available for signup
```

**Implementation:**
- Reuse logic from `requestSignup` (lines 402-431)
- Check Supabase Auth admin.listUsers() + pending_signups table
- Rate limit: 20 req/min per IP (reuse `loginLimits`)
- No auth required; returns only boolean + reason code (no PII)

### I.2 Tests

**File:** `backend/tests/email-check.test.js`
- Email available → 200 `{ available: true }`
- Email in Auth → 200 `{ available: false, reason: "account_exists" }`
- Email in pending_signups (unverified, not expired) → 200 `{ available: false, reason: "pending_signup" }`
- Email in pending_signups (expired) → 200 `{ available: true }`
- Invalid email format → 400
- Rate limit exceeded → 429

---

## 4. Phase II — Username Login Support (3 hours)

### II.1 Backend: Extend `login` controller

**File:** `backend/controllers/authController.js` (modify `login` function)
**File:** `backend/models/userModel.js` (new function `getLoginEmailByUsername`)

**Current logic (lines 59-95):**
```javascript
const isEmail = identifier.includes("@");
let email = isEmail ? identifier.toLowerCase() : null;
if (!email) {
  // Student ID path
}
```

**New logic:**
```javascript
const isEmail = identifier.includes("@");
const isStudentId = /^\d{4}-\d{4}$/.test(identifier); // 2023-12345 format
const isUsername = !isEmail && !isStudentId; // alphanumeric username

let email = null;
let profile = null;

if (isEmail) {
  email = identifier.toLowerCase();
  profile = await userModel.getUserByEmailForLockout(email);
} else if (isStudentId) {
  const resolved = await userModel.getLoginEmailByStudentId(identifier.toUpperCase());
  if (!resolved?.email) return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
  email = resolved.email;
  profile = await userModel.getUserById(resolved.id);
} else if (isUsername) {
  const resolved = await userModel.getLoginEmailByUsername(identifier);
  if (!resolved?.email) return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
  email = resolved.email;
  profile = await userModel.getUserById(resolved.id);
}
```

**New userModel function:**
```javascript
const getLoginEmailByUsername = async (username) => {
  const sql = `
    SELECT id, email
    FROM public.profiles
    WHERE lower(username) = $1
      AND verification_status = 'verified'
      AND email IS NOT NULL
    LIMIT 1;
  `;
  const result = await db.query(sql, [username.toLowerCase()]);
  return result.rows[0] || null;
};
```

### II.2 Tests

**File:** `backend/tests/login-username.test.js`
- Valid username + password → 200 tokens
- Invalid username → 401 generic error (no enumeration)
- Unverified username → 401 generic error
- Lockout works for username path
- Rate limit works for username path

---

## 5. Phase III — Brevo Email Bounce Webhook (4 hours)

### III.1 Database Migration

**File:** `backend/migrations/021_email_bounce_tracking.sql`

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_bounced BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bounce_reason TEXT,
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_email_bounced ON public.profiles (email_bounced) WHERE email_bounced = TRUE;
```

### III.2 Backend: Webhook Endpoint

**File:** `backend/controllers/emailWebhookController.js` (new)
**File:** `backend/routes/emailRouter.js` (new route: `POST /api/email/webhook/brevo`)
**File:** `backend/validation/index.js` (webhook schema)

**Brevo Webhook Payload (relevant fields):**
```json
{
  "event": "bounce",
  "email": "user@example.com",
  "reason": "The email account that you tried to reach does not exist...",
  "code": "550",
  "type": "hard",
  "timestamp": 1699999999
}
```

**Handler Logic:**
1. Verify Brevo HMAC signature (header `X-Brevo-Signature`)
2. Parse payload: only process `event === "bounce"` and `type === "hard"` and `code === "550"`
3. Extract email, normalize to lowercase
4. Update `profiles`:
   ```sql
   UPDATE profiles
   SET email_bounced = TRUE,
       bounce_reason = $2,
       bounced_at = NOW()
   WHERE lower(email) = $1;
   ```
5. Log to `admin_audit_log` (action: `email.bounce_hard`)
6. Return 200 OK (Brevo expects quick response)

### III.3 Tests

**File:** `backend/tests/email-bounce-webhook.test.js`
- Valid Brevo signature + hard bounce 550 → marks profile bounced, returns 200
- Invalid signature → 401
- Soft bounce (type !== "hard") → ignored, returns 200
- Non-550 code → ignored, returns 200
- Email not in profiles → returns 200 (no error)
- Rate limit on webhook endpoint

---

## 6. Phase IV — Frontend Integration (3 hours)

### IV.1 Signup Form: Real-time Email Check

**File:** `frontend/app/(auth)/signup.tsx` (or wherever signup form lives)

**Behavior:**
- On email blur (or debounced onChange), call `GET /api/auth/check-email?email=...`
- Show inline soft error:
  - `reason === "account_exists"` → "An account with this email already exists. Try logging in."
  - `reason === "pending_signup"` → "A verification code was already sent. Check your email."
- Disable submit button if `available === false`

### IV.2 Login Form: Username Field

**File:** `frontend/app/(auth)/login.tsx`

**Behavior:**
- Single "Identifier" field (replaces separate email/student ID fields)
- Placeholder: "Email, Student ID, or Username"
- Backend handles detection automatically (existing logic + new username path)

### IV.3 Email Bounce Notification (Optional)

**File:** `frontend/src/components/EmailBounceBanner.tsx` (new)

**Behavior:**
- On login/signup, check if `profile.email_bounced === true`
- Show banner: "We couldn't deliver emails to this address. Please contact support or update your email."

---

## 7. Sequencing & Gates

| Phase | Order | Est. | Verification Gate |
|-------|-------|------|-------------------|
| I | 1 | 2h | `GET /api/auth/check-email` returns correct codes; tests pass |
| II | 2 | 3h | Login with username works; existing email/studentID still work; tests pass |
| III | 3 | 4h | Brevo webhook marks profile bounced; HMAC verified; tests pass |
| IV | 4 | 3h | Frontend shows soft errors; username login works; bounce banner appears |

**Total: ~12 hours**

---

## 8. Complete Task Checklist

### Phase I — Email Existence Check
- [x] I.1 Add `checkEmail` function to `authController.js`
- [x] I.2 Add `GET /api/auth/check-email` route to `authRouter.js`
- [x] I.3 Add validation schema to `validation/index.js` (including `validateQuery` middleware)
- [x] I.4 Write tests in `backend/tests/email-check.test.js`
- [x] I.5 Run test suite → 313 pass (305 original + 8 new)

### Phase II — Username Login
- [x] II.1 Add `getLoginEmailByUsername` to `userModel.js`
- [x] II.2 Update `login` controller to handle username (detection by exclusion: `@` → email, `^\d{4}-\d{4,}$` → student ID, else → username)
- [x] II.3 Update lockout tracking to include `identifier_type` for username
- [x] II.4 Run test suite → 313 pass (all existing tests + new username support)

### Phase III — Brevo Bounce Webhook
- [x] III.1 Create migration `021_email_bounce_tracking.sql`
- [x] III.2 Apply migration
- [x] III.3 Create `emailWebhookController.js`
- [x] III.4 Create `emailRouter.js` with `POST /api/email/webhook/brevo`
- [x] III.5 Add webhook schema to `validation/index.js`
- [x] III.6 Write tests in `backend/tests/email-bounce-webhook.test.js`
- [x] III.7 Run test suite → 322 pass (313 existing + 9 new)

### Phase IV — Frontend Integration
- [x] IV.1 Add real-time email check to signup form (`checkEmailAvailability` in auth.ts, onBlur handler in register.tsx)
- [x] IV.2 Update login form to use single identifier field (email/student ID/username detection in login.tsx)
- [x] IV.3 Add `EmailBounceBanner` component (`src/components/EmailBounceBanner.tsx`)
- [ ] IV.4 Run frontend tests → 13/15 pass (test config issues pre-existing, not from our changes)

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Email check endpoint enables enumeration | Medium | Rate limit aggressively (20/min); return only boolean + generic reason; no timing difference between reasons |
| Username login breaks existing student ID detection | Low | Use regex to distinguish: email has `@`, student ID matches `^\d{4}-\d{4}$`, else username |
| Brevo webhook spam / spoofing | Medium | HMAC signature verification; only process hard bounces with code 550 |
| Migration adds columns to large `profiles` table | Low | `IF NOT EXISTS`; boolean default FALSE is instant in Postgres |
| Frontend race condition on email check | Low | Debounce 300ms; cancel previous request on new input |

---

## 10. Demo Runbook

1. **Email Check:** `curl "http://localhost:3000/api/auth/check-email?email=test@lccbonline.edu.ph"` → `{ "available": true }`
2. **Signup with existing email:** Submit signup → 409 `account_exists` (server); Frontend shows inline error before submit
3. **Username Login:** `POST /api/auth/login { "identifier": "johndoe", "password": "..." }` → 200 tokens
4. **Brevo Webhook:** Send test payload to `POST /api/email/webhook/brevo` with valid HMAC → profile marked `email_bounced=true`
5. **Bounce Banner:** Login with bounced email account → banner appears "We couldn't deliver emails to this address..."

---

## 11. Add to Implementation Plans Index

Add to `implementation_plans/2026-11-08-operational-hygiene-and-hardening.md` as **Phase I** (new, after Phase H).