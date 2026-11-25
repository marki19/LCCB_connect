# LCCB Connect — Comprehensive UI/UX Audit & Polish Plan

**Date:** 2026-11-23  
**Status:** Planning  
**Scope:** Frontend only (UI/UX) — no backend/logic changes unless required for UI fixes

---

## Executive Summary

The codebase has a **strong design system foundation** (tokens.ts, Button, Card, TextField, Modal, etc.) but exhibits **inconsistent application** across screens. The merge conflict resolution fixed critical loading issues, but there are significant opportunities to elevate the UI to **professional 2026 mobile app quality** with native feel, consistent dark/light mode, and accessibility compliance.

---

## Design System Assessment

### ✅ Strengths
- **Tokens (tokens.ts):** Comprehensive, well-organized with warm paper/ink theme, cobalt brand, saffron warning, jade success. Supports both themes fully.
- **Typography:** Single system-sans stack (`TYPE` scale: micro → display) — consistent voice.
- **Spacing/Radii:** 4px base scale (`SPACE`), semantic radii (`RADIUS`) — good foundation.
- **Motion:** Consistent durations (`MOTION`) — fast/base/slow/stagger.
- **Core Components:** Button, Card, TextField, Modal, Skeleton, Alert, StatusBadge, Avatar, SectionHeader, Reveal — well-built with proper theming.

### ⚠️ Issues Found

| Area | Issue | Severity |
|------|-------|----------|
| **Button** | `subtle` variant uses `primarySurface` but no dark-mode override — low contrast in dark | High |
| **Button** | Ghost variant hover uses `surfaceSunken` — too subtle in dark mode | Medium |
| **Button** | `IconButton` badge uses hardcoded `colors.destructive` instead of `colors.destructiveSurface` for bg | Medium |
| **Card** | Single elevation level — no `elevated` prop variant for cards needing more depth | Low |
| **TextField** | Label uses `textSecondary` — should be `textPrimary` for better readability | Medium |
| **TextField** | Placeholder uses `textTertiary` — too faint, fails 4.5:1 in dark | High |
| **Modal** | Sheet mode bottom radius only on top corners — correct | — |
| **Skeleton** | Uses opacity pulse — good for perf, but shimmer gradient would feel more premium | Low |
| **EmptyState** | Admin version uses `CONSOLE_TEXT` — inconsistent with app tokens | Medium |
| **StatusBadge** | Good system but `neutral` tone uses `surfaceSunken` — too weak in dark | Medium |
| **Avatar** | Presence colors from `LIGHT_TOKENS` directly — not theme-aware | High |
| **SectionHeader** | Eyebrow uses `textTertiary` — too faint | Low |

---

## Screen-by-Screen Audit

### 1. Home / Feed (`app/(tabs)/index.tsx`)
| Issue | Details | Fix |
|-------|---------|-----|
| **Header** | `HomeHeader` has elevation but no sticky shadow on scroll | Add scroll-aware elevation |
| **IdentityBanner** | Not reviewed — likely needs audit | Review |
| **PostComposer** | Pill input lacks focus ring; action buttons use `inkSoft` (too faint) | Use `textSecondary`, add focus ring |
| **PostCard** | Large component — needs detailed audit | See PostCard section |
| **SnapRail** | Not reviewed | Review |
| **EmptyState** | Uses admin `EmptyState` with `CONSOLE_TEXT` | Use app tokens |
| **Skeletons** | Good but could use shimmer gradient | Optional upgrade |
| **Error banner** | Uses `coral`/`coralWash` directly — should use token `destructive`/`destructiveSurface` | Replace with tokens |

### 2. Messages — InboxPane (`components/messages/InboxPane.tsx`)
| Issue | Details | Fix |
|-------|---------|-----|
| **Header** | Title uses hardcoded `28px` — should use `TYPE.h2` | Use token |
| **Search bar** | Custom styles — should use `TextField` pattern | Align with TextField |
| **Tab pills** | Custom pill styles — inconsistent with Button variants | Use Button or shared pill component |
| **Active friends rail** | Note bubbles use `surfaceSunken` + `border` — inconsistent radius | Standardize |
| **Online dot** | Hardcoded `#22C55E` — should use `colors.success` | Use token |
| **Chat rows** | `hoverOverlay` for hover — good; but `brandWash` for active — should be `primarySurface` | Align with tokens |
| **Unread dot** | Hardcoded `#0084FF` — should use `colors.brand` | Use token |
| **Request actions** | Accept button uses `brandSolid` directly — should use Button component | Use Button |
| **Empty state** | Uses admin `EmptyState` — inconsistent | Use app EmptyState |

### 3. Messages — ThreadPane (`components/messages/ThreadPane.tsx`)
| Issue | Details | Fix |
|-------|---------|-----|
| **Header** | `panel` bg with `line` border — good | — |
| **Presence badge** | Uses `PRESENCE_COLORS` from `LIGHT_TOKENS` — not theme-aware | Use theme-aware colors |
| **Message bubbles** | `colors.bubbleMine`/`bubblePeer` — good token usage | — |
| **Timestamp exposure** | On hover/click — good UX | — |
| **Composer** | Input uses `inputBg`/`inputBorder` — good; send button uses `brandSolid` directly | Use Button component |
| **Image attachment preview** | Good | — |
| **Safety popover** | Custom styles — should use Modal or Popover component | Extract to reusable Popover |
| **Report modal** | Uses `Modal` — good | — |
| **Block confirmation** | Uses `Modal` — good | — |
| **Empty state** | Inline Card + Text — should use `EmptyState` component | Use EmptyState |

### 4. Notifications (`app/(tabs)/notifications.tsx`)
| Issue | Details | Fix |
|-------|---------|-----|
| **Header** | `TYPE.micro` for "Inbox" — good; `TYPE.h2` for title — good | — |
| **Unread badge** | Uses `StatusBadge` — good | — |
| **List items** | Custom Pressable with `primarySurface`/`panel` — inconsistent with other lists | Standardize list item pattern |
| **Avatar + badge** | Custom implementation — should use `Avatar` + `StatusBadge` | Compose from primitives |
| **Time format** | Client-side interval — good | — |
| **Empty state** | Uses `EmptyState` + `Card` — good | — |
| **Skeleton** | Uses `Skeleton` — good | — |
| **Reveal animation** | Staggered entrance — good | — |

### 5. Profile (`app/(tabs)/profile.tsx`)
| Issue | Details | Fix |
|-------|---------|-----|
| **Header** | Gradient hero — uses `heroFrom`/`heroTo` tokens — good | — |
| **Avatar** | Large, with presence — good | — |
| **Stats row** | Custom layout — should use consistent spacing | Use `SPACE` tokens |
| **Tabs** | Custom segmented control — inconsistent with messages tabs | Unify tab pill component |
| **Posts list** | Uses `PostCard` — see PostCard audit | — |
| **Empty state** | Uses admin `EmptyState` — inconsistent | Use app EmptyState |

### 6. Settings (`app/settings.tsx`)
| Issue | Details | Fix |
|-------|---------|-----|
| **Header** | Back button + title — good | — |
| **Avatar editor** | Custom — good | — |
| **Theme toggle** | Uses `ThemeToggle` — good | — |
| **Radio groups** | Custom Pressable with `Radio` icon — should use shared Radio component | Extract RadioGroup |
| **Switch** | Native `Switch` with custom track/thumb colors — good | — |
| **Section labels** | Custom `SectionLabel` — should use `SectionHeader` | Use SectionHeader |
| **Divider** | Custom `Divider` — should be standardized | Create Divider component |
| **Blocked users** | Good use of Avatar + Button | — |

### 7. Auth — Login/Register (`app/(auth)/login.tsx`, `register.tsx`)
| Issue | Details | Fix |
|-------|---------|-----|
| **AuthScaffold** | Good structure; desktop split view — good | — |
| **TextField** | Uses `TextField` component — good | — |
| **Buttons** | Uses `Button` component — good | — |
| **MFA flow** | Custom modals — should use `Modal` component | Use Modal |
| **Error/Success alerts** | Uses `Alert` component — good | — |
| **Divider** | Custom `Divider` — standardize | Create Divider component |
| **Google button** | Secondary variant with custom icon — good | — |

### 8. Onboarding (`app/onboarding.tsx`)
| Issue | Details | Fix |
|-------|---------|-----|
| **InteractiveBackground** | Good | — |
| **Cards** | Uses `Card` — good | — |
| **Buttons** | Uses `Button` — good | — |
| **VerificationForm** | Not reviewed | Review |
| **Modal** | Uses `Modal` — good | — |

### 9. PostCard (`components/PostCard.tsx`) — **Critical: Most Complex Component**
| Issue | Details | Fix |
|-------|---------|-----|
| **Size** | 661 lines — too large, should be split | Decompose into sub-components |
| **Avatar** | Uses `Avatar` — good | — |
| **Content** | Complex parsing for media/links — good logic | — |
| **Actions** | Heart/Comment/Share/Repost — custom Pressables | Use IconButton or shared ActionRow |
| **Menu** | `PostMenu` — custom popover | Use shared Popover |
| **Images** | `ChatImageBubble` — good | — |
| **Comments** | `InlineCommentsDrawer` — large, not reviewed | Review |
| **Skeleton** | Not present — add for loading state | Add PostCardSkeleton |
| **Repost** | `RepostCard` wrapper — good pattern | — |

---

## Cross-Cutting Issues

### 1. Dark Mode Inconsistencies
- **Avatar presence colors** use `LIGHT_TOKENS` directly (line 14-19 in Avatar.tsx)
- **Button subtle variant** uses `primarySurface` without dark adjustment
- **TextField placeholder** uses `textTertiary` — fails contrast in dark
- **InboxPane online dot** hardcoded `#22C55E`
- **ThreadPane presence labels** use `PRESENCE_COLORS` from light tokens
- **StatusBadge neutral** uses `surfaceSunken` — too weak in dark

### 2. Component Duplication / Lack of Composition
- **Custom pill tabs** in InboxPane, Settings, Profile — should be one `TabPill` component
- **Custom radio rows** in Settings — should be `RadioGroup` + `RadioItem`
- **Custom list items** in Notifications, InboxPane, ThreadPane — should be `ListItem` component
- **Custom dividers** in Settings, Auth — should be `Divider` component
- **Custom action buttons** in ThreadPane composer, InboxPane requests — should use `Button`

### 3. Hardcoded Values
- Colors: `#22C55E`, `#0084FF`, `#BFDBFE` scattered
- Font sizes: `28px`, `15.5px`, `13.5px` instead of TYPE scale
- Spacing: Magic numbers instead of SPACE tokens

### 4. Accessibility Gaps
- **Focus rings** missing on many interactive elements (PostComposer pill, InboxPane tabs, etc.)
- **Touch targets** — some below 44×44 (IconButton at 36-38px)
- **Screen reader labels** — generally good but some missing
- **Color-only indicators** — unread dot, online status should have text alternative

### 5. Motion & Micro-interactions
- **Press feedback** — inconsistent scale values (0.97, 0.98, 0.95, 0.93)
- **Hover states** — missing on many desktop web elements
- **Staggered reveals** — only in Notifications and AuthScaffold
- **Loading states** — Skeletons good but could use shimmer gradient

---

## Implementation Plan

### Phase 1: Design System Foundations (Week 1)
**Goal:** Fix token-level issues, enhance core components

| Task | Files | Priority |
|------|-------|----------|
| Fix `Button.subtle` dark mode contrast | `Button.tsx` | High |
| Fix `Button.ghost` hover in dark mode | `Button.tsx` | High |
| Fix `IconButton` badge background | `Button.tsx` | Medium |
| Make `Avatar` presence colors theme-aware | `Avatar.tsx` | High |
| Fix `TextField` label/placeholder contrast | `TextField.tsx` | High |
| Fix `StatusBadge.neutral` dark mode | `StatusBadge.tsx` | Medium |
| Create `Divider` component | `components/ui/Divider.tsx` | Medium |
| Create `TabPill` / `SegmentedControl` component | `components/ui/TabPill.tsx` | High |
| Create `RadioGroup` / `RadioItem` components | `components/ui/RadioGroup.tsx` | High |
| Create `ListItem` component | `components/ui/ListItem.tsx` | High |
| Create `Popover` component (for menus) | `components/ui/Popover.tsx` | High |
| Add shimmer gradient to `Skeleton` (optional) | `Skeleton.tsx` | Low |

### Phase 2: Screen Fixes — Core Tabs (Week 2)
**Goal:** Apply design system consistently to main screens

| Task | Files | Priority |
|------|-------|----------|
| Home: Fix PostComposer pill focus ring, action button colors | `PostComposer.tsx` | High |
| Home: Replace admin EmptyState with app tokens | `index.tsx` | Medium |
| Home: Add scroll-aware header elevation | `HomeHeader.tsx` | Medium |
| Messages Inbox: Replace custom tabs with TabPill | `InboxPane.tsx` | High |
| Messages Inbox: Replace search bar with TextField pattern | `InboxPane.tsx` | Medium |
| Messages Inbox: Fix hardcoded colors (online dot, unread dot) | `InboxPane.tsx` | High |
| Messages Inbox: Use Button for Accept/View actions | `InboxPane.tsx` | Medium |
| Messages Inbox: Replace admin EmptyState | `InboxPane.tsx` | Medium |
| Messages Thread: Make presence colors theme-aware | `ThreadPane.tsx` | High |
| Messages Thread: Use Button for send action | `ThreadPane.tsx` | Medium |
| Messages Thread: Extract safety popover to Popover component | `ThreadPane.tsx` | Medium |
| Messages Thread: Replace inline empty state with EmptyState | `ThreadPane.tsx` | Low |
| Notifications: Standardize list items with ListItem | `notifications.tsx` | High |
| Notifications: Compose avatar+badge from primitives | `notifications.tsx` | Medium |

### Phase 3: Screen Fixes — Secondary Screens (Week 3)
**Goal:** Polish remaining screens

| Task | Files | Priority |
|------|-------|----------|
| Profile: Unify tabs with TabPill | `profile.tsx` | High |
| Profile: Replace admin EmptyState | `profile.tsx` | Medium |
| Settings: Replace SectionLabel with SectionHeader | `settings.tsx` | High |
| Settings: Replace custom dividers with Divider | `settings.tsx` | Medium |
| Settings: Replace radio rows with RadioGroup | `settings.tsx` | High |
| Settings: Use TabPill for policy selection | `settings.tsx` | Medium |
| Auth: Replace custom MFA modals with Modal | `login.tsx`, `register.tsx` | Medium |
| Auth: Replace custom Divider with Divider component | `login.tsx`, `register.tsx` | Low |
| Onboarding: Review VerificationForm | `onboarding.tsx`, `VerificationForm.tsx` | Medium |

### Phase 4: PostCard Decomposition (Week 4)
**Goal:** Break down the monolithic PostCard

| Task | Files | Priority |
|------|-------|----------|
| Extract `PostHeader` (avatar, name, time, menu) | `components/PostCard/` | High |
| Extract `PostContent` (text, images, links) | `components/PostCard/` | High |
| Extract `PostActions` (heart, comment, share, repost) | `components/PostCard/` | High |
| Extract `PostFooter` (visibility, tags) | `components/PostCard/` | Medium |
| Create `PostCardSkeleton` | `components/PostCard/` | High |
| Update `PostCard` to compose from parts | `PostCard.tsx` | High |
| Review `InlineCommentsDrawer` | `components/InlineCommentsDrawer.tsx` | Medium |
| Review `RepostCard` / `RepostDialog` | `components/RepostCard.tsx` | Low |

### Phase 5: Dark Mode & Accessibility QA (Week 5)
**Goal:** Systematic verification

| Task | Priority |
|------|----------|
| Test every screen in light + dark mode | Critical |
| Verify 4.5:1 contrast for all text | Critical |
| Verify 3:1 contrast for UI elements | Critical |
| Test keyboard navigation (web) | High |
| Test screen reader (VoiceOver/TalkBack) | High |
| Verify focus indicators on all interactive elements | High |
| Check touch targets ≥ 44×44 | High |
| Verify motion reduction respected | Medium |

### Phase 6: Polish & Refinement (Week 6)
**Goal:** Premium feel

| Task | Priority |
|------|----------|
| Add shimmer gradient to Skeletons | Medium |
| Standardize press scale (0.97) and hover opacity | Medium |
| Add staggered Reveal to more lists (Home feed, Messages) | Low |
| Polish empty states with illustrations | Low |
| Add haptic feedback (expo-haptics) for key actions | Low |
| Review and tighten all spacing to SPACE scale | Medium |

---

## Component API Standardization

### New Shared Components to Create

#### `TabPill` / `SegmentedControl`
```tsx
// Single source of truth for pill-style tabs
<TabPill
  options={[{ value: 'chats', label: 'Chats' }, { value: 'requests', label: 'Requests', badge: 3 }]}
  value={activeTab}
  onChange={setActiveTab}
/>
```

#### `RadioGroup` / `RadioItem`
```tsx
// Accessible radio groups with consistent styling
<RadioGroup value={policy} onChange={setPolicy}>
  <RadioItem value="everyone" label="Everyone" hint="Anyone can message you" />
  <RadioItem value="selected" label="Selected departments" hint="Choose who can reach you" />
</RadioGroup>
```

#### `ListItem`
```tsx
// Composable list item: leading (avatar), content, trailing (time/badge), pressable
<ListItem
  leading={<Avatar />}
  title="Conversation title"
  subtitle="Last message preview"
  trailing={<Text>2h</Text>}
  unread={true}
  onPress={...}
/>
```

#### `Popover`
```tsx
// Anchor-aware popover for menus (PostMenu, ThreadPane safety, etc.)
<Popover anchorRef={menuButtonRef} content={<MenuItems />} />
```

#### `Divider`
```tsx
// Consistent hairline divider
<Divider inset={SPACE.x4} /> // or full-width
```

---

## Token Corrections Needed

### Dark Mode Token Adjustments
```typescript
// In tokens.ts DARK_TOKENS:
// Button subtle variant needs darker primarySurface for contrast
primarySurface: "rgba(110, 155, 255, 0.18)",  // was 0.14
primarySurfaceAlt: "rgba(110, 155, 255, 0.26)", // was 0.22

// TextField placeholder needs more contrast
textTertiary: "#8A95A8",  // was #8595AD — slightly lighter

// StatusBadge neutral needs visible background
surfaceSunken: "#101A2E",  // was #0A111D — slightly lighter

// Avatar presence colors need dark variants
// Add to DARK_TOKENS:
jadeBright: "#17A97C",      // online
accentBright: "#F2B21B",    // away
coralBright: "#FF8B7E",     // busy
irisBright: "#A78BFA",      // dnd
```

---

## Verification Checklist

### Pre-merge Requirements
- [ ] `npx tsc --noEmit` passes (strict mode)
- [ ] `npx expo lint` passes
- [ ] Web export builds (`npx expo export -p web`)
- [ ] All screens render in browser (login, home, messages, notifications, profile, settings)
- [ ] Dark/light mode toggle works on all screens
- [ ] No console errors on load
- [ ] Touch targets ≥ 44×44 on all interactive elements
- [ ] Focus visible on all interactive elements (web)

### Post-merge QA
- [ ] iOS simulator: test all tabs, modals, keyboard avoidance
- [ ] Android emulator: test all tabs, modals, keyboard avoidance
- [ ] Web desktop: test hover states, keyboard nav, responsive layouts
- [ ] Web mobile viewport: test touch interactions, sheets
- [ ] Screen reader: VoiceOver (iOS), TalkBack (Android), NVDA (web)
- [ ] Reduced motion: verify animations respect `prefers-reduced-motion`
- [ ] High contrast: verify readability in system high contrast mode

---

## File Structure After Refactor

```
frontend/src/components/
├── ui/
│   ├── Button.tsx           ✅ (fixes)
│   ├── Card.tsx             ✅
│   ├── TextField.tsx        ✅ (fixes)
│   ├── Modal.tsx            ✅
│   ├── Skeleton.tsx         ✅ (optional shimmer)
│   ├── Alert.tsx            ✅
│   ├── StatusBadge.tsx      ✅ (fixes)
│   ├── SectionHeader.tsx    ✅
│   ├── Reveal.tsx           ✅
│   ├── Avatar.tsx           ✅ (fixes)
│   ├── Divider.tsx          🆕 NEW
│   ├── TabPill.tsx          🆕 NEW
│   ├── RadioGroup.tsx       🆕 NEW
│   ├── ListItem.tsx         🆕 NEW
│   ├── Popover.tsx          🆕 NEW
│   ├── ThemeToggle.tsx      ✅
│   └── index.ts             (barrel exports)
├── PostCard/
│   ├── PostCard.tsx         ✅ (composed)
│   ├── PostHeader.tsx       🆕
│   ├── PostContent.tsx      🆕
│   ├── PostActions.tsx      🆕
│   ├── PostFooter.tsx       🆕
│   └── PostCardSkeleton.tsx 🆕
├── messages/
│   ├── InboxPane.tsx        ✅ (refactored)
│   ├── ThreadPane.tsx       ✅ (refactored)
│   └── MessagesSplit.tsx    ✅
├── auth/
│   ├── AuthScaffold.tsx     ✅
│   ├── InteractiveBackground.tsx ✅
│   └── MfaSetupModal.tsx    ✅
└── admin/
    ├── EmptyState.tsx       ✅ (or move to ui/)
    ├── StatusBadge.tsx      ✅ (move to ui/)
    └── consoleTheme.ts      ✅
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing screens during refactor | Phase approach: fix design system first, then one screen at a time with visual regression testing |
| Dark mode regressions | Test every component in both themes after each change |
| Performance regression from new components | Profile FlatList rendering; ensure `React.memo` on list items |
| Accessibility regressions | Run axe-core or react-native-accessibility-info after each phase |
| Token drift | Centralize all color references to `useTheme().colors` — lint rule |

---

## Success Metrics

1. **Zero hardcoded colors** in component files (all via `colors.` tokens)
2. **Zero hardcoded font sizes** (all via `TYPE.` scale)
3. **Zero hardcoded spacing** (all via `SPACE.` scale)
4. **All interactive elements** have focus rings (web) and ≥44×44 touch targets
5. **All text** meets 4.5:1 contrast in both themes
6. **All screens** load with skeletons, no layout shift
7. **TypeScript strict** passes with zero errors
8. **Lint** passes with zero warnings

---

*This plan will be executed in phases with verification at each step. The design system fixes (Phase 1) are prerequisite for all screen work.*