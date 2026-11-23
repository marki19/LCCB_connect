# UI/UX Audit & Polish — Task Tracker

**Plan:** `ui-ux-audit-and-polish.md`  
**Status:** Phase 1 — Design System Foundations

---

## Phase 1: Design System Foundations

### Core Component Fixes
- [ ] **Button.tsx** — Fix `subtle` variant dark mode contrast (increase `primarySurface` opacity in dark)
- [ ] **Button.tsx** — Fix `ghost` variant hover in dark mode (use `hoverOverlay` with higher opacity)
- [ ] **Button.tsx** — Fix `IconButton` badge: use `colors.destructiveSurface` + `colors.destructiveText` instead of hardcoded
- [ ] **TextField.tsx** — Fix label color: use `colors.textPrimary` instead of `textSecondary`
- [ ] **TextField.tsx** — Fix placeholder color: use `colors.textMuted` (new token) or lighter `textTertiary` for 4.5:1 contrast
- [ ] **Avatar.tsx** — Make presence colors theme-aware (add dark variants to tokens, use `colors.` not `LIGHT_TOKENS`)
- [ ] **StatusBadge.tsx** — Fix `neutral` tone dark mode: use `colors.surfaceSunken` with adjusted opacity
- [ ] **tokens.ts** — Add dark mode adjustments for `primarySurface`, `primarySurfaceAlt`, `textTertiary`, `surfaceSunken`
- [ ] **tokens.ts** — Add dark presence color tokens (`jadeBright`, `accentBright`, `coralBright`, `irisBright`)

### New Shared Components
- [ ] **Divider.tsx** — Create reusable divider component (hairline, supports inset)
- [ ] **TabPill.tsx** — Create segmented control / tab pill component
- [ ] **RadioGroup.tsx + RadioItem.tsx** — Create accessible radio group
- [ ] **ListItem.tsx** — Create composable list item (leading, content, trailing, pressable)
- [ ] **Popover.tsx** — Create anchor-aware popover for menus

### Verification
- [ ] Run `npx tsc --noEmit` — must pass
- [ ] Run `npx expo lint` — must pass
- [ ] Visual check: Button variants in light + dark
- [ ] Visual check: TextField label/placeholder contrast in light + dark
- [ ] Visual check: Avatar presence dots in light + dark

---

## Phase 2: Core Tab Screens

### Home / Feed (`app/(tabs)/index.tsx`, `PostComposer.tsx`, `HomeHeader.tsx`)
- [ ] **PostComposer.tsx** — Add focus ring to pill input (use `focusRing` from tokens)
- [ ] **PostComposer.tsx** — Fix action button text color: use `colors.textSecondary` not `inkSoft`
- [ ] **PostComposer.tsx** — Ensure action buttons have hover/press states
- [ ] **HomeHeader.tsx** — Add scroll-aware elevation (shadow increases on scroll)
- [ ] **index.tsx** — Replace admin `EmptyState` usage with app tokens (or create app EmptyState)
- [ ] **index.tsx** — Replace error banner hardcoded `coral`/`coralWash` with `colors.destructive`/`colors.destructiveSurface`

### Messages — InboxPane (`components/messages/InboxPane.tsx`)
- [ ] Replace header title hardcoded `28px` with `TYPE.h2`
- [ ] Replace search bar with `TextField` pattern (or `ListItem` with leading icon)
- [ ] Replace custom tab pills with `TabPill` component
- [ ] Fix online dot: use `colors.success` (theme-aware) not `#22C55E`
- [ ] Fix unread dot: use `colors.brand` not `#0084FF`
- [ ] Fix active row background: use `colors.primarySurface` not `colors.brandWash`
- [ ] Replace Accept/View action buttons with `Button` component
- [ ] Replace admin `EmptyState` with app version
- [ ] Standardize note bubble styling (radius, colors)

### Messages — ThreadPane (`components/messages/ThreadPane.tsx`)
- [ ] Make presence colors theme-aware (use `colors.jadeBright` etc. from tokens)
- [ ] Replace send button with `Button` component (primary, size="sm" or IconButton)
- [ ] Extract safety popover to `Popover` component
- [ ] Replace inline empty state with `EmptyState` component
- [ ] Ensure composer input uses `focusRing` (already does — verify)
- [ ] Fix `PRESENCE_LABELS` import — ensure consistent with Avatar

### Notifications (`app/(tabs)/notifications.tsx`)
- [ ] Replace custom list item with `ListItem` component
- [ ] Compose avatar + type badge from `Avatar` + `StatusBadge` primitives
- [ ] Verify `Reveal` stagger timing consistent with design system
- [ ] Ensure `RefreshControl` tint uses `colors.primary` (already does)

---

## Phase 3: Secondary Screens

### Profile (`app/(tabs)/profile.tsx`)
- [ ] Replace custom tabs with `TabPill` component
- [ ] Replace admin `EmptyState` with app version
- [ ] Standardize stats row spacing with `SPACE` tokens
- [ ] Verify header gradient uses tokens correctly

### Settings (`app/settings.tsx`)
- [ ] Replace `SectionLabel` with `SectionHeader` (eyebrow style)
- [ ] Replace custom `Divider` with `Divider` component
- [ ] Replace radio rows with `RadioGroup` + `RadioItem`
- [ ] Replace policy selection with `TabPill` or `RadioGroup`
- [ ] Verify `Switch` track/thumb colors work in both themes

### Auth (`app/(auth)/login.tsx`, `app/(auth)/register.tsx`)
- [ ] Replace custom MFA modals with `Modal` component
- [ ] Replace custom `Divider` with `Divider` component
- [ ] Verify `TextField` usage consistent (already good)
- [ ] Verify `Button` usage consistent (already good)

### Onboarding (`app/onboarding.tsx`)
- [ ] Review `VerificationForm` for consistency
- [ ] Verify `Card`, `Button`, `Modal` usage
- [ ] Check `InteractiveBackground` performance

---

## Phase 4: PostCard Decomposition

### New Components
- [ ] **PostHeader.tsx** — Avatar, name, role, time, menu button
- [ ] **PostContent.tsx** — Text, images, link previews, badges
- [ ] **PostActions.tsx** — Heart, Comment, Share, Repost (use `IconButton`)
- [ ] **PostFooter.tsx** — Visibility, tags, department
- [ ] **PostCardSkeleton.tsx** — Loading skeleton matching structure

### Refactor
- [ ] Update `PostCard.tsx` to compose from parts
- [ ] Review `InlineCommentsDrawer.tsx` for consistency
- [ ] Review `RepostCard.tsx` / `RepostDialog.tsx`
- [ ] Review `ChatImageBubble.tsx` / `ChatImageLightbox.tsx`

---

## Phase 5: Dark Mode & Accessibility QA

### Systematic Testing
- [ ] Test every screen in **light mode** — screenshot baseline
- [ ] Test every screen in **dark mode** — screenshot baseline
- [ ] Verify **4.5:1 contrast** for all body text (axe-core or manual)
- [ ] Verify **3:1 contrast** for UI elements (borders, icons, focus rings)
- [ ] Test **keyboard navigation** (Tab, Shift+Tab, Enter, Escape) on web
- [ ] Test **screen readers**: VoiceOver (iOS), TalkBack (Android), NVDA (web)
- [ ] Verify **focus indicators** on all interactive elements (web)
- [ ] Verify **touch targets** ≥ 44×44 on all interactive elements
- [ ] Test **reduced motion** — verify animations respect `prefers-reduced-motion`
- [ ] Test **high contrast mode** — system accessibility setting

### Automated Checks
- [ ] `npx tsc --noEmit` — strict mode passes
- [ ] `npx expo lint` — passes
- [ ] `npx expo export -p web` — builds successfully
- [ ] No console errors on app load (all screens)

---

## Phase 6: Polish & Refinement

### Motion & Micro-interactions
- [ ] Add **shimmer gradient** to `Skeleton` (replace opacity pulse)
- [ ] Standardize **press scale** to `0.97` across all Pressables
- [ ] Standardize **hover opacity** to `0.9` / `0.8` for pressed
- [ ] Add **staggered Reveal** to Home feed, Messages list, Notifications
- [ ] Add **haptic feedback** (`expo-haptics`) for key actions (send, like, delete)

### Visual Polish
- [ ] Polish **empty states** with custom illustrations (optional)
- [ ] Review and tighten **all spacing** to `SPACE` scale
- [ ] Verify **border radius** consistency (`RADIUS` scale)
- [ ] Check **icon stroke widths** consistent (2.0-2.4 for UI icons)

### Performance
- [ ] Profile FlatList rendering on Home feed (60fps scroll)
- [ ] Verify `React.memo` on list items (`PostCard`, `ListItem`, notification items)
- [ ] Check image loading (prefetch, blur-up placeholders)

---

## Completion Criteria

- [ ] All Phase 1-4 tasks complete
- [ ] All Phase 5 QA checks pass
- [ ] Zero hardcoded colors / font sizes / spacing in component files
- [ ] Design system components used consistently across all screens
- [ ] Dark mode visually polished on every screen
- [ ] Accessibility compliant (WCAG 2.1 AA)
- [ ] TypeScript strict + Lint + Build all pass
- [ ] Ready for production release

---

## Notes

- **Priority order:** Phase 1 → 2 → 3 → 4 → 5 → 6
- **Do not skip Phase 5** — dark mode and accessibility are required
- **Phase 4 (PostCard)** can be done in parallel with Phase 2-3 by another developer
- **Phase 6** is polish — can be deferred if timeline tight, but shimmer skeletons and standardized press feedback are high impact