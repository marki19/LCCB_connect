# UI/UX Redesign — Plan

Goal: a modern, professional, production-quality UI across LCCB Connect with a
single cohesive design system, clear navigation, accessible components, and
subtle motion — without changing business logic.

## Constraints / decisions

- **Motion library:** Framer Motion is web/DOM-only and does not run in
  Expo / React Native. This project already ships `react-native-reanimated`
  (v4) + the `Reveal` primitive. All motion is built on Reanimated, which is the
  React Native equivalent of Framer Motion (shared values, springs, timing,
  reduced-motion support).
- **Design tokens:** `frontend/src/lib/tokens.ts` is the single source of truth
  (colors, spacing, radii, type, motion, elevation, focus ring). No new hard-coded
  hex values in screens.
- **Primitives:** `src/components/ui/*` (Button, Card, TextField, Skeleton,
  SectionHeader, Reveal) are the base layer. Screens compose primitives.

## Phase 1 — Auth flow (this change) ✅

The login page in the screenshot is the odd one out: all auth screens used a
bespoke gradient-card layout while an unused modern `AuthScaffold` existed.

- Enhance `AuthScaffold` into the shared shell for every auth screen:
  branded split panel on desktop, centered card on mobile, built-in theme
  toggle, staggered `Reveal` entrance, optional back link.
- Add reusable `ui/ThemeToggle`, `ui/Alert`, and extend `ui/TextField` with a
  leading icon / submit / autoFocus props.
- Redesign all 5 screens on the shared shell + primitives:
  - `login` (identifier + password, MFA challenge, Google, guest)
  - `register`
  - `forgot-password`
  - `reset-password`
  - `verify-email`
- Remove ~500 lines of duplicated inline styles + per-screen theme toggles.

## Phase 2 — App shell, navigation & modal system ✅

### App shell / navigation
- Reviewed `app/(tabs)/_layout.tsx`: already responsive (top bar on wide web,
  bottom bar on mobile), token-based colors, focus rings, and theme toggle.
  No changes needed.
- `app/_layout.tsx` root Stack + RouteGuard and `admin/PageHeader` already
  provide consistent page chrome.

### Shared animated modal system
- **New `src/components/ui/Modal.tsx`** — one dialog primitive for the app:
  - Backdrop fades; panel fades + lifts (slight scale on desktop).
  - Centered card on ≥640 px, bottom sheet below 640 px.
  - Backdrop blur on web, scrim on native.
  - Escape / backdrop / Android back close it; focus moves into the dialog
    and returns to the trigger on web.
  - Honors reduced motion; animates out before unmounting.
- Refactored every reusable / screen dialog onto it:
  - `admin/ActionDialog.tsx` (all admin & moderation confirmations) — now uses
    `ui/Button` + `ui/TextField`.
  - `SelectField.tsx` (department/course pickers) — tokenized.
  - `PeerPicker.tsx` (message/add-friend) — centered on desktop, sheet on
    mobile; removed hard-coded hex colors.
  - `app/messages/[id].tsx` safety + report dialogs — tokenized.
  - `app/verify-requests.tsx` decline dialog — now `ui/TextField` + `ui/Button`.

### Known follow-ups
- ~~Native `Alert.alert` still remains in `onboarding.tsx`, `upload-thesis.tsx`,
  `verify-requests.tsx`, and `PeerPicker.tsx`.~~ ✅ Resolved in Phase 5 — the
  entire app now uses the shared notice/confirm `Modal`; zero `Alert.alert`
  calls remain.
- ~~Pre-existing API contract bug found while verifying: `GET /api/verification/queue`
  returns `{ requests: [...] }` while `app/verify-requests.tsx` expects
  `{ items, total, page, pageSize }`, so the screen crashes on load.~~ ✅ Fixed in
  Phase 5: the screen accepts `{ requests }`, `{ items }`, or a bare array and
  normalises `user_email` → email, `review_note` → note, derived username, and
  `reviewed_at` → decided date.
- `PeerPicker` still renders inline error text rather than a toast.

## Phase 3 — Content surfaces

Status: **complete** (screens rebuilt on the design system; no business logic,
handlers, or API calls changed).

### Rebuilt
- `app/(tabs)/index.tsx` — Campus Feed: composer, filter pills, and error banner
  moved into `ListHeaderComponent`; duplicate trailing block and duplicate
  "Campus peers" heading removed; type badge tokenized.
- `app/(tabs)/search.tsx` — Repository: header, focus-ring search field, filter
  pills, `Card` result rows, `Skeleton`, `EmptyState`, `Reveal`.
- `app/(tabs)/profile.tsx` — hero band, overlapping identity `Card`,
  `StatusBadge`, skill pills, stats, portfolio `SectionHeader`, `PostCard` list,
  empty/error states.
- `app/(tabs)/notifications.tsx` — header + unread badge, `Card` rows,
  `badgeTone` icon tones, `Skeleton`, `EmptyState`, `RefreshControl`.
- `app/post/[id].tsx` — tokenized header/card/bubbles; delete-post and
  delete-comment confirm `Modal`s; notice `Modal`; guest composer state;
  comment edit/delete preserved.
- `app/create.tsx` — 3-step flow on `Card`/`TextField`/`Button`; `FORMATS`
  option cards with `badgeTone`; `Reveal` per step; progress dots; all
  `Alert.alert` replaced with the shared notice `Modal`.
- `app/messages/index.tsx` — header, segmented tabs, `Card` conversation /
  request rows, `EmptyState`, `RefreshControl`, realtime debounce preserved.
- `app/messages/[id].tsx` — tokenized bubbles/ticks/pending, banners, composer
  focus ring, safety sheet, report `Modal`, block confirm + notice `Modal`s;
  every `Alert.alert` removed.
- `app/friends.tsx` — header/tabs, `Card` rows, `EmptyState`, remove-friend
  confirm `Modal`, notice `Modal`.
- `app/settings.tsx` — section labels, `Card` rows with `Divider`/`Radio`,
  tokenized switches; presence / policy / department / blocked logic preserved.
- `app/edit-profile.tsx` — header save `Button`, avatar picker, `ReadOnlyField`,
  `TextField`s, skill pills, notice `Modal`.
- `src/components/PostCard.tsx` — shared post card with delete-confirm +
  notice `Modal`s (was native `Alert`).
- `src/components/HomeHeader.tsx` — badge tokenized (`coral` /
  `textOnDanger`); inner `IconButton` uses `useTheme`.
- `src/components/SettingsSidebar.tsx` — tokens throughout: `scrim` backdrop,
  brand hero header (`brandSolid` / `heroText*` / `heroLine`), hover/focus
  `MenuItem`s, tokenized switches.
- `src/components/ui/Modal.tsx` — dialog container suppresses the browser's
  default focus outline (was an off-brand amber frame on web); backdrop blur,
  escape/backdrop close, and focus restore unchanged.

### Phase 3 verification
- `npx tsc --noEmit` clean; `npx expo lint` 0 errors / 0 warnings.
- Browser pass (dark + light) on feed, search, profile, notifications, post
  detail, create, messages, friends, settings, edit-profile: no console errors.
  Only benign warnings remain (`expo-notifications` web push listener,
  Reanimated shared-value inline-style note).
- Shared `Modal` exercised via the create flow's validation notice: backdrop
  blur, entrance animation, focus handling, and light/dark surfaces all correct.
- Fixed while verifying: posts whose `title` is null (seed data) rendered an
  empty heading on the detail screen. Detail now falls back to "Post Update"
  like the feed and skips the description block when empty.

### Phase 3 follow-ups
- Desktop admin accounts are auto-redirected from `(tabs)` routes back to
  `/(admin)/` by `app/_layout.tsx` unless "Back to App" preview is active. This
  is existing routing behaviour, but it makes the user-facing screens hard to
  reach for admins; consider an explicit "view as member" toggle in the admin
  shell.
- ~~`GET /api/verification/queue` still returns `{ requests: [...] }` while
  `app/verify-requests.tsx` expects `{ items, total, page, pageSize }`.~~ ✅
  Resolved in Phase 5 (see above).

## Phase 4 — Admin & moderation consoles ✅

Status: **complete** — the admin and moderation surfaces were already built on
the shared admin primitives, so this phase was an audit plus the last token
cleanups.

- Audited every `(admin)` and `(moderation)` route:
  - 0 `Alert.alert` calls; every confirmation uses `ActionDialog`.
  - 0 hard-coded hex values after replacing the last three literals in
    `app/(admin)/_layout.tsx` (`rgba(255,255,255,0.06)` → `colors.navHoverBg`,
    `#20160A` → `colors.navBg` for text on the saffron button).
  - `PageHeader`, `KpiCard`, `DataTable`, `ActionDialog` used consistently;
    `ModerationQueue` uses `PageHeader`, `ActionDialog`, and tokenized rows.
- Verified the console overview and moderation queue render with no console
  errors in both themes.

## Phase 5 — Polish & remaining legacy screens ✅

### Remaining screens rebuilt on the design system
- `app/onboarding.tsx` — full rewrite: `Card` + `TextField` + `SelectField` +
  `Button` + notice `Modal`; identity gate with brand mark, field-level
  validation (including a new `onBlur` on `TextField`), reviewer-note banner for
  declined requests, submitted-details panel for pending requests, and an
  approved state. All prefill/validation/submit logic preserved; the three
  `Alert.alert` calls became notice modals. Birthdate accepts hyphens on mobile.
- `app/upload-thesis.tsx` — full rewrite: sticky action bar, `TextField`s,
  segmented category control, tokenized PDF dropzone, `VisibilityPicker`
  preserved; six `Alert.alert` calls became a single notice `Modal` with
  success/error tones. Success navigates back only after the notice is
  dismissed, matching the old blocking-alert behaviour.
- `app/suspended.tsx` — `Card`/`Button`/`Reveal`, tokenized reason/duration
  panel.
- `app/index.tsx` (splash) — fixed dark institutional palette driven by
  `DARK_TOKENS` (no hex), `Reveal` entrance, seal glow, and a "Preparing your
  campus…" loading row. Uses `useWindowDimensions` instead of a module-level
  `Dimensions.get`.

### Token sweep
- Removed the last hard-coded colors outside `tokens.ts`:
  `PostCard` avatar (now `brandWash`/`brand`), `Avatar` presence colors
  (from `LIGHT_TOKENS`), `VisibilityPicker` check icon
  (`textOnPrimary`), `push.ts` notification light (`LIGHT_TOKENS.primary`), and
  the unused dev `ErrorDisplay` overlay (now tokenized).
- `frontend/src` and `frontend/app` now contain **zero** hard-coded hex values
  and **zero** `Alert.alert` calls outside `tokens.ts`.

### Bug found and fixed during verification
- `app/verify-requests.tsx` called `/verification/queue/:id/approve` and
  `/decline`, but the backend exposes `/verification/:id/approve` and
  `/decline`. Approve/decline would have 404'd; the paths now match
  `backend/routes/verificationRouter.js`, and the decline note is capped at the
  schema's 300 characters.
- `Card` spread its `style` prop directly. `VirtualizedList` clones a
  `ListEmptyComponent` with `StyleSheet.compose(...)`, which returns an
  **array**; spreading it produced numeric style keys and crashed React DOM
  with `Failed to set an indexed property [1] on 'CSSStyleDeclaration'`. `Card`
  now accepts `StyleProp<ViewStyle>` and flattens it, fixing empty states built
  on `Card` everywhere (the verification queue exposed it).
- The verification queue's empty-state copy now distinguishes "no pending
  requests" from "no matching search" / other status filters.

### Verification
- `npx tsc --noEmit` clean; `npx expo lint` 0 errors / 0 warnings.
- Browser pass (dark + light) on: onboarding (validation, department→course
  cascade, modal picker), upload-thesis (validation notice, category, dropzone),
  verify-requests (empty state, filter tabs, search, no crash), admin overview,
  moderation queue, feed, repository, notifications, profile, post detail,
  create, messages, friends, settings, edit-profile. No console errors.
- Theme toggled to light and back to dark; both palettes confirmed via computed
  styles (`surfacePage`, `surface`, `surfaceElevated`, `brandWash`).

## Phase 6 — Accessibility, contrast & SEO pass

Lighthouse was run against every top-level surface in **both** palettes
(feed, onboarding, upload-thesis, verify-requests, admin console, moderation
console, settings, messages, friends, create, profile). The pass is now
Accessibility **1.00**, Best Practices **1.00**, SEO **1.00** on all of them.

### Colour-contrast fixes (tokens)
- Dark mode's `primary` (`#6E9BFF`) and `destructive` (`#FF8B7E`) are
  intentionally *bright* accents. White text on them is only 2.69:1, so
  `textOnPrimary` / `textOnDanger` are now dark ink in the dark palette
  (`#0B1B33` / `#2A0E0A`). Added `textOnBrandSolid` (`#FFFFFF`, both palettes)
  for the deep `brandSolid` blue used by active chips, CTA pills, unread badges
  and send buttons; ~20 call sites were moved to it.
- Light mode's `textTertiary` and `inkFaint` were `#6A7789` (4.44:1 on
  `#FFFCF6`). Both are now `#5A6577`, which clears 4.5:1 on `surfacePage`,
  `surface` and `surfaceSunken`. Two admin captions that used `textMuted` were
  moved to `textTertiary`.
- Added `dangerOnDark` (`#FF9F94`, both palettes) for destructive text on the
  always-dark console sidebars, where the light theme's `destructiveText`
  (`#9E2F24`) was unreadable (1.8:1).
- The moderation console sidebar was the last light-theme-on-dark-surface bug:
  it painted `sidebarBg` (`#0A1830`) but used `textPrimary`, `primary`,
  `textSecondary`, `textTertiary` and `destructiveText`. It now uses
  `sidebarActiveText`, `sidebarItemText`, `sidebarActiveBg`,
  `sidebarItemHover`, `sidebarBorder` and `navAccent` throughout, including the
  department card, profile block and utility rows.

### ARIA / screen-reader fixes
- `accessibilityRole="tablist"` added to every tab group: verification filters,
  messages and friends segmented controls, feed filter rail, search scope rail.
  React Native Web does not infer the parent role, so axe flagged
  `aria-required-parent` on each tab.
- Radios (settings theme/presence/message policy, create format, upload-thesis
  category) now pass flat `aria-checked`; `accessibilityState` is ignored by
  react-native-web 0.21.
- Every `ActivityIndicator` (33 call sites) now has
  `accessibilityLabel="Loading"` — RN Web renders spinners as unnamed
  `role="progressbar"`, which tripped `aria-progressbar-name`.
- `MixBar` progressbars got a label describing the segment mix, and the admin
  "View directory" button's label now contains its visible text
  (`label-content-name-mismatch`).
- The upload-thesis category radio dropped its explicit label: the visible text
  wraps onto two lines, so the computed name never contained the literal string
  and axe reported a mismatch.

### Motion fix
- `Reveal` now animates only `translateY`, not opacity. Fading text through
  partial opacity drops its effective contrast for the first frames *and* makes
  contrast audits non-deterministic (axe samples the live DOM mid-entrance);
  the profile page failed 3/3 runs while animated. The rise alone still reads
  as motion, and audits are now stable.

### SEO
- `frontend/public/index.html` gained a meta description and `theme-color`;
  `frontend/public/robots.txt` was added.

### Verification
- Lighthouse, both themes: all 11 surfaces at 1.00 accessibility / 1.00 best
  practices / 1.00 SEO, no failing audits.
- `npx tsc --noEmit` clean; `npx expo lint` 0 errors / 0 warnings.
- Theme left on **dark** (the product default).

## Phase 7 — Messaging split view (desktop)

Tapping **Messages** on a wide desktop window now opens the two-pane messenger
layout people expect from web chat: the conversation list stays on the left
(360 px) and the open thread fills the right pane. Picking a chat swaps the pane
instead of pushing a route, so the list keeps its scroll position and never
refetches mid-conversation.

### Structure
- `src/components/messages/InboxPane.tsx` — the inbox (Chats / Requests, live
  updates, accept/ignore, new-message picker) with no navigation of its own:
  `onSelect(id)`, `activeId`, `showBack`/`onBack`. Rows highlight the open
  thread (`primarySurface` + `brand` border) and sent requests are now tappable
  so you can keep writing in a pending thread.
- `src/components/messages/ThreadPane.tsx` — the 1:1 thread (bubbles, ticks,
  typing, request banner, offline queue, report/block) without page chrome; the
  back affordance renders only when a host passes `onBack`.
- `src/components/messages/MessagesSplit.tsx` — list + thread, with a
  "Select a conversation" empty pane and `initialId` for deep links.
- `app/messages/index.tsx` and `app/messages/[id].tsx` are now thin hosts: split
  view at `width >= 900` on web, single-column inbox → thread below that (phone
  and tablet behaviour unchanged, including the back arrow).

### Details
- The list auto-selects the tab that holds a deep-linked thread (a request opens
  under Requests) without overriding a manual tab switch.
- A Requests tab with only sent requests no longer shows the "No message
  requests" empty card above the SENT section.
- Verified in the browser: 360 px list pane + 936 px thread pane at 1296 px
  wide, composer pinned to the bottom of the right pane, no horizontal overflow,
  active-row highlight, deep link `/messages/:id`, and Lighthouse 1.00
  accessibility in both themes.

## Verification

- `npx tsc --noEmit`
- `npx expo lint`
- Manual run: `npm run dev` (backend :3000, Expo web :8081).
