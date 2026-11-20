# Implementation Plan: Fix Security Defects (R1, R2, R3) & Master Plan Alignment

Consolidated implementation plan integrating the Master Plan (`C:\Users\mark\.opencode\plan\2026-11-17-master-plan.md`), the 3 high-severity security defect fixes (R1, R2, R3), and the working tree checkpoint commit.

---

## 1. Context & Workstream Status

Based on live database and codebase verification on 2026-11-17:

### Shipped and Working
- **Profile Page**: Facebook two-column layout, cover photos (`profiles.cover_url`), friends endpoint, photos endpoint.
- **Profile Notes**: Note bubble, edit/clear modal, Messenger story/note bar (`profiles.note`).
- **Messenger**: Mobile and desktop layout alignment, 3-dots dropdown popover.
- **Object Storage & Caching**: R2 storage, avatar mirroring, `expo-image` disk/memory cache recycling.
- **Custom Contact & Personal Details**: Migration `051`, `ProfileContactInfoCard`, `ProfilePersonalDetailsCard`, `edit-profile.tsx`.

### Not Started
- **Visitor (Guest) Accounts**: Needs `role = 'guest'` DB constraint update and read-only guards.
- **Mentions**: Backend parser, mention notifications, `MentionInput`, and autocomplete.
- **Quick Snap**: Phase 0 only. Migration number moved to `054_quick_snap.sql` (since 049–051 are taken).

---

## 2. The 3 High-Severity Security Defects

| # | Severity | Finding | Location | Fix Est. |
|---|---|---|---|---|
| **R1** | **High** | A Google-only student attempting the login form increments the failed-login counter and **locks their account** for a password that never existed. | `authController.js:209-230` | 2h |
| **R2** | **High** | `verifySignup` ignores the Supabase error. Existing email → random UUID fallback → unique-violation → **500 error**. | `authController.js:510-520` | 0.5h |
| **R3** | **High** | Swallowed Supabase error in `verifySignup`: if Supabase is down, random UUID becomes an **orphan profile** in PostgreSQL with no auth user. | `authController.js:510-520` | 0.5h |

---

## 3. Decisions & Policy Alignments

> [!IMPORTANT]
> - **D1 (Thesis PDF for visitors)**: **Option A (Hide PDF + 1st-Page Title Preview)** — When posting or reading a thesis, only the first page (title page) preview is visible to visitors/guests. The full PDF file and download link are gated to authenticated LCCB campus accounts only.
> - **D2 (Contact Details Scope)**: **Audience Selector (Public vs Organization)** — Users can choose whether their contact info is visible publicly (all users including outside visitors) or organization-only (LCCB users). Default remains protected/organization.
> - **D3 (Login Form)**: **Kept** — Necessary for outside visitors and administrative accounts (`superadmin`) with native password credentials.
> - **D4 (Saving Policy)**: **Deferred** — Guests do not save; cleanup of `requireVerified` on saves deferred until after Visitor Accounts ship.

---

## 4. Recommended Execution Order

| Step | Workstream | Scope / Files | Est. | Gate |
|---|---|---|---|---|
| **1** | **Commit Checkpoint** | Commit current 25+ files (notes, layout, contact info, photo recycling) | 0.25h | Clean `git status` |
| **2** | **R2 + R3 Defect Fix** | `authController.js:verifySignup` error handling & 409/502 status | 1h | 0 orphan profiles, 0 500s on duplicate email |
| **3** | **R1 Defect Fix** | `authController.js:login` Google-only detection & `use_google_signin` | 2h | No lockout on Google accounts |
| **4** | **Permanent Identity** | Freeze `full_name` & `username`, derive mentionable handles (`052`) | 5h | 0 null usernames, 0 duplicate handles |
| **5** | **Visitor Accounts** | Guest role constraint (`051`), read-only gate, PDF 1st-page preview | 18h | Guests read-only; no PDF download |
| **6** | **Mentions** | Mention parsing, autocomplete, RichText, notifications (`053`) | 17h | Mentions deliver inbox notification |
| **7** | **Quick Snap** | Snaps schema (`054`), 24h expiration, camera/gallery upload | 40h | Snap disappears after 24h |

---

## 5. Proposed Changes: Phase 1 & 2 (Immediate Security Fixes)

### Component 1: Working Tree Checkpoint
Commit all existing changes across backend controllers, models, migrations, and frontend profile components.

### Component 2: Fix R2 + R3 (`backend/controllers/authController.js`)
In `verifySignup`:
1. Require Supabase Admin client; fail with 503 if unavailable.
2. Check `supaErr`:
   - If email already registered: return `409 Conflict` with `{ error: "An account with this email already exists", code: "email_already_registered" }`.
   - If auth service error: return `502 Bad Gateway` with `{ error: "Authentication provider error. Please try again.", code: "auth_provider_error" }`.
3. Set `userId = supaUser.user.id` strictly from auth provider.
4. Remove random UUID fallback; prevent orphan profile creation.

```javascript
    const supabase = adminClientOr503(res);
    if (!supabase) return;

    const { data: supaUser, error: supaErr } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: pending.full_name,
      },
    });

    if (supaErr || !supaUser?.user?.id) {
      if (supaErr?.message?.toLowerCase().includes("already registered") || supaErr?.status === 422) {
        return res.status(409).json({
          error: "An account with this email already exists",
          code: "email_already_registered",
        });
      }
      return res.status(502).json({
        error: "Failed to create authentication credentials. Please try again.",
        code: "auth_provider_error",
      });
    }

    const userId = supaUser.user.id;
```

### Component 3: Fix R1 (`backend/controllers/authController.js`)
In `login`:
1. If `user` has NO `password_hash`:
   - Check if account is Google-only (`supabase.auth.admin.getUserById(user.id)` returns provider `google` only, or account has no password set).
   - If Google-only: do **NOT** increment failed logins and do **NOT** lock the account.
   - Return 400 with `{ error: "This account uses Google Sign-In. Please sign in with Google.", code: "use_google_signin" }`.
2. Failed-login increments and lockout apply strictly to accounts possessing native password credentials.

---

## 6. Verification Plan

### Automated Tests
```bash
# 1. Backend test suite
npm --prefix backend test

# 2. Frontend TypeScript typecheck
node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit

# 3. Frontend test suite
npm --prefix frontend test -- --run

# 4. Web production export
npm --prefix frontend run build
```

### Manual Verification
1. Attempt signup verification with an existing email: verify 409 response with clean JSON, zero 500 crashes.
2. Attempt password login with a Google-only student email: verify prompt to use Google Sign-In, zero lockout counter increment.
