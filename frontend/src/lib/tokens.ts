/**
 * LCCB Connect — Centralized design tokens.
 *
 * Every color in the UI must come from here. Import `useTheme().colors` in
 * components and reference tokens by name. Never hard-code hex, rgb, hsl, or
 * Tailwind color classes directly.
 *
 * Brand identity derived from the official LCCB logo:
 *   Primary: Royal Blue ~#0540B0
 *   Neutral: Charcoal  ~#555555
 *   Accent:  Heart Red ~#E53935, Gold #F5C518
 */

// ─── Light Theme ────────────────────────────────────────────────────────────

export const LIGHT_TOKENS = {
  // Surfaces (ordered by elevation)
  surfacePage: "#F5F8FF",        // page / canvas background
  surface: "#FFFFFF",             // cards, sidebar, popovers
  surfaceElevated: "#FFFFFF",     // modals, dropdowns (same in light, shadows differentiate)
  surfaceSunken: "#EDF1F7",       // inset areas, code blocks, input backgrounds
  surfaceOverlay: "rgba(15, 23, 42, 0.40)",  // modal backdrop

  // Borders
  border: "#DBEAFE",              // subtle card/section borders
  borderStrong: "#94A3B8",        // form inputs, dividers that need more contrast
  divider: "#E2E8F0",             // horizontal rules, separators

  // Text
  textPrimary: "#0F172A",         // headings, body
  textSecondary: "#334155",       // secondary info
  textTertiary: "#64748B",        // labels, captions, timestamps
  textDisabled: "#94A3B8",        // disabled controls
  textMuted: "#94A3B8",           // placeholder-style text
  textOnPrimary: "#FFFFFF",       // text on primary-colored backgrounds
  textOnDanger: "#FFFFFF",        // text on destructive backgrounds

  // Brand primary (Royal Blue)
  primary: "#0540B0",             // primary buttons, active nav, links
  primaryHover: "#043A9E",        // primary hover state
  primarySurface: "#EBF1FF",      // light tint for selected rows, active nav bg
  primarySurfaceAlt: "#DBEAFE",   // slightly deeper tint
  primaryMuted: "#93B4F0",        // disabled primary text or icons

  // Legacy aliases (so existing code doesn't break during migration)
  action: "#0540B0",
  actionSurface: "#EBF1FF",
  actionSurfaceAlt: "#DBEAFE",

  // Semantic: Destructive / Danger
  destructive: "#E53935",
  destructiveHover: "#C62828",
  destructiveSurface: "#FEF2F2",
  destructiveSurfaceAlt: "#FEE2E2",
  destructiveText: "#DC2626",

  // Semantic: Success
  success: "#16A34A",
  successSurface: "#F0FDF4",
  successText: "#15803D",

  // Semantic: Warning
  warning: "#D97706",
  warningSurface: "#FFFBEB",
  warningText: "#B45309",

  // Semantic: Info
  info: "#0284C7",
  infoSurface: "#F0F9FF",
  infoText: "#0369A1",

  // Semantic: Gold accent (badges, highlights)
  gold: "#F5C518",
  goldSurface: "#FEF9E7",
  goldText: "#92400E",

  // Shadows
  shadow: "rgba(5, 64, 176, 0.08)",
  shadowStrong: "rgba(0, 0, 0, 0.12)",

  // Focus
  focusRing: "rgba(5, 64, 176, 0.35)",

  // Skeleton / Shimmer
  skeletonBase: "#E2E8F0",
  skeletonShimmer: "#F1F5F9",

  // Form inputs
  inputBg: "#FFFFFF",
  inputBorder: "#CBD5E1",
  inputBorderFocus: "#0540B0",

  // Cards
  cardBg: "#FFFFFF",

  // Tab bar
  tabBarBg: "#FFFFFF",

  // Hover states
  hoverOverlay: "rgba(0, 0, 0, 0.04)",
  activeOverlay: "rgba(0, 0, 0, 0.07)",

  // Badge variants (portfolio types)
  badgeWebsiteBg: "#DBEAFE",
  badgeWebsiteText: "#1D4ED8",
  badgeThesisBg: "#EDE9FE",
  badgeThesisText: "#6D28D9",
  badgeCapstoneBg: "#D1FAE5",
  badgeCapstoneText: "#047857",
  badgeProjectBg: "#FEF3C7",
  badgeProjectText: "#B45309",
  badgeUpdateBg: "#F1F5F9",
  badgeUpdateText: "#475569",
  badgeImageBg: "#FCE7F3",
  badgeImageText: "#BE185D",

  // Chat bubbles
  bubbleMine: "#0540B0",
  bubbleMineText: "#FFFFFF",
  bubblePeer: "#FFFFFF",
  bubblePeerText: "#0F172A",
  textOnActionMuted: "#DBEAFE",

  // Sidebar (admin)
  sidebarBg: "#FFFFFF",
  sidebarBorder: "#E2E8F0",
  sidebarActiveBg: "#0540B0",
  sidebarActiveText: "#FFFFFF",
  sidebarItemText: "#475569",
  sidebarItemHover: "#F5F8FF",
  sidebarHeaderBg: "#FAFBFE",

  // Table
  tableHeaderBg: "#F8FAFC",
  tableRowHover: "#F5F8FF",
  tableRowBorder: "#F1F5F9",
};

// ─── Dark Theme ─────────────────────────────────────────────────────────────

export const DARK_TOKENS: typeof LIGHT_TOKENS = {
  // Surfaces (ordered by elevation — lighter = higher elevation)
  surfacePage: "#0B1220",
  surface: "#121A2B",
  surfaceElevated: "#18223A",
  surfaceSunken: "#0D1526",
  surfaceOverlay: "rgba(0, 0, 0, 0.60)",

  // Borders
  border: "#1E2D4A",
  borderStrong: "#374B6D",
  divider: "#1E2D4A",

  // Text
  textPrimary: "#E6EAF2",
  textSecondary: "#B8C4D6",
  textTertiary: "#7B8BA5",
  textDisabled: "#3D4F6B",
  textMuted: "#5A6E8A",
  textOnPrimary: "#FFFFFF",
  textOnDanger: "#FFFFFF",

  // Brand primary (lighter blue for dark backgrounds)
  primary: "#4C84FF",
  primaryHover: "#6B9BFF",
  primarySurface: "rgba(76, 132, 255, 0.12)",
  primarySurfaceAlt: "rgba(76, 132, 255, 0.18)",
  primaryMuted: "#2A4A8A",

  // Legacy aliases
  action: "#4C84FF",
  actionSurface: "rgba(76, 132, 255, 0.12)",
  actionSurfaceAlt: "rgba(76, 132, 255, 0.18)",

  // Semantic: Destructive / Danger
  destructive: "#FF6B6B",
  destructiveHover: "#FF8A8A",
  destructiveSurface: "rgba(255, 107, 107, 0.12)",
  destructiveSurfaceAlt: "rgba(255, 107, 107, 0.18)",
  destructiveText: "#FF6B6B",

  // Semantic: Success
  success: "#4ADE80",
  successSurface: "rgba(74, 222, 128, 0.12)",
  successText: "#4ADE80",

  // Semantic: Warning
  warning: "#FBBF24",
  warningSurface: "rgba(251, 191, 36, 0.12)",
  warningText: "#FBBF24",

  // Semantic: Info
  info: "#38BDF8",
  infoSurface: "rgba(56, 189, 248, 0.12)",
  infoText: "#38BDF8",

  // Semantic: Gold accent
  gold: "#F5C518",
  goldSurface: "rgba(245, 197, 24, 0.12)",
  goldText: "#F5C518",

  // Shadows (darker, stronger on dark backgrounds)
  shadow: "rgba(0, 0, 0, 0.30)",
  shadowStrong: "rgba(0, 0, 0, 0.50)",

  // Focus
  focusRing: "rgba(76, 132, 255, 0.45)",

  // Skeleton / Shimmer
  skeletonBase: "#1E2D4A",
  skeletonShimmer: "#253550",

  // Form inputs
  inputBg: "#0F1A2E",
  inputBorder: "#26324A",
  inputBorderFocus: "#4C84FF",

  // Cards
  cardBg: "#121A2B",

  // Tab bar
  tabBarBg: "#0F1726",

  // Hover states
  hoverOverlay: "rgba(255, 255, 255, 0.04)",
  activeOverlay: "rgba(255, 255, 255, 0.07)",

  // Badge variants (dark-friendly)
  badgeWebsiteBg: "rgba(76, 132, 255, 0.18)",
  badgeWebsiteText: "#8FB4FF",
  badgeThesisBg: "rgba(139, 92, 246, 0.18)",
  badgeThesisText: "#B794F6",
  badgeCapstoneBg: "rgba(74, 222, 128, 0.15)",
  badgeCapstoneText: "#6EE7A0",
  badgeProjectBg: "rgba(251, 191, 36, 0.15)",
  badgeProjectText: "#FCD34D",
  badgeUpdateBg: "rgba(148, 163, 184, 0.12)",
  badgeUpdateText: "#94A3B8",
  badgeImageBg: "rgba(244, 114, 182, 0.15)",
  badgeImageText: "#F472B6",

  // Chat bubbles
  bubbleMine: "#2A4A8A",
  bubbleMineText: "#FFFFFF",
  bubblePeer: "#18223A",
  bubblePeerText: "#E6EAF2",
  textOnActionMuted: "rgba(76, 132, 255, 0.60)",

  // Sidebar (admin)
  sidebarBg: "#0F1726",
  sidebarBorder: "#1E2D4A",
  sidebarActiveBg: "#4C84FF",
  sidebarActiveText: "#FFFFFF",
  sidebarItemText: "#8FA3BF",
  sidebarItemHover: "rgba(76, 132, 255, 0.08)",
  sidebarHeaderBg: "#0D1320",

  // Table
  tableHeaderBg: "#0F1726",
  tableRowHover: "rgba(76, 132, 255, 0.06)",
  tableRowBorder: "#1A2540",
};

export type ThemeTokens = typeof LIGHT_TOKENS;
