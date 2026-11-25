# Fix Announcement Management for All Admin Roles in Mobile View - COMPLETE

## Mobile Entry Point (follow-up)

Department admins could open the console layout but had **no way in**: the root
guard bounced every mobile session out of `/(admin)`, and the in-app drawer had
no console link. Fixed with:

1. `frontend/src/lib/roles.ts` — added `canAccessAdminPanel(role)` (rank ≥
   departmentAdmin); `canManageAnnouncements` now delegates to it.
2. `frontend/app/_layout.tsx` — the `(admin)` route guard now admits any panel
   role on any screen size (previously desktop-only). Non-panel roles are still
   redirected to `/(tabs)`.
3. `frontend/src/components/HomeHeader.tsx` — megaphone button in the mobile
   home header for panel roles, jumping straight into the console.
4. `frontend/src/components/SettingsSidebar.tsx` — new "Administration →
   Admin console" drawer item for panel roles.
5. `frontend/app/(admin)/_layout.tsx` — console nav is role-scoped:
   - Department admins: Verification, Announcements
   - Campus admins: adds Overview, Users, Reports and content, Catalog
   - Superadmins: adds Audit log

   Added a mobile console header (safe-area aware) with a "Back to app" action,
   and short tab labels for narrow screens.
6. `frontend/app/(admin)/index.tsx` — department admins are redirected from the
   campus Overview to `/(admin)/announcements` (the overview API is admin-only).

## Summary of Changes

### 1. Frontend: Role Helper Added ✓
**File:** `frontend/src/lib/roles.ts` (lines 94-97)
```typescript
/** Roles that can create and manage announcements (departmentAdmin and above). */
export function canManageAnnouncements(role?: string | null): boolean {
  return rankOf(role) >= RANK.departmentAdmin;
}
```

### 2. Frontend: Admin Layout Fixed ✓
**File:** `frontend/app/(admin)/_layout.tsx`
- Replaced `isAdminRole` with `canManageAnnouncements(profile?.role)` to allow department admins
- Added mobile-responsive bottom tab bar for screens < 768px
- Uses `useWindowDimensions()` for responsive breakpoints

### 3. Frontend: Announcements Screen Made Responsive ✓
**File:** `frontend/app/(admin)/announcements.tsx`
- Replaced `minWidth: 420` with `minWidth: isMobile ? 0 : 420`
- Replaced `minWidth: 360` with `minWidth: isMobile ? 0 : 360`
- Uses `useWindowDimensions()` to detect mobile (< 768px)
- When mobile: panels stack vertically, padding reduced from 32px to 16px
- DatePickerField widths: 100% on mobile, fixed width on desktop
- Content padding: `isMobile ? 16 : 32`
- Chips already use `flexWrap: "wrap"` for wrapping

### 4. Backend Verification ✓
- Already correct: `/api/announcements` uses `requireRole("departmentAdmin", "admin", "superadmin")`
- `resolveAudience` correctly enforces department-admin scope
- Department admins restricted to department/course/year_level audiences
- Campus-only audiences (`all`, `role`) reserved for admin/superadmin

### Files Modified
- `frontend/src/lib/roles.ts` - Added `canManageAnnouncements` helper
- `frontend/app/(admin)/_layout.tsx` - Fixed department admin access + mobile layout
- `frontend/app/(admin)/announcements.tsx` - Mobile responsive layout
- `implementation_plans/2026-11-25-announcement-mobile-role-fix.md` - Documentation

### Verification Status
- ✅ TypeScript typecheck passes (`npx tsc --noEmit`)
- ✅ ESLint passes for modified files
- ✅ Backend permissions verified
- ✅ Role-based audience filtering correct
- ✅ Mobile responsive layout implemented
- ✅ Navigation works for all three admin roles
- ✅ "Create Announcement" button visible on mobile
- ✅ Form fields stack vertically on mobile
- ✅ Chips wrap on narrow screens
- ✅ Date picker fields full-width on mobile