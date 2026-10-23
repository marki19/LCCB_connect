/**
 * LCCB Connect — Centralized design tokens.
 *
 * Identity: "Campus Ledger" — warm paper, deep ink, institutional cobalt,
 * saffron for operational urgency, jade for healthy signals.
 *
 * Every color in the UI must come from here. Import `useTheme().colors` in
 * components and reference tokens by name. Never hard-code hex, rgb, hsl, or
 * Tailwind color classes directly.
 *
 * The `brand*`, `panel*`, `ink*`, `nav*`, and `hero*` families are the
 * editorial layer used by the admin console and the app's landing surfaces.
 * They intentionally sit alongside the original semantic tokens so unrelated
 * screens keep their behavior while sharing the same canvas, type and motion.
 */

import { Platform, type TextStyle } from "react-native";

// ─── Light Theme ────────────────────────────────────────────────────────────

export const LIGHT_TOKENS = {
  // Surfaces (ordered by elevation)
  surfacePage: "#F4F1E9",         // warm paper canvas
  surface: "#FFFCF6",             // cards, sidebar, popovers
  surfaceElevated: "#FFFEFA",     // modals, dropdowns
  surfaceSunken: "#EDE8DC",       // inset areas, input backgrounds
  surfaceOverlay: "rgba(8, 16, 30, 0.52)", // modal backdrop

  // Borders
  border: "#E4DDCF",              // subtle card/section borders
  borderStrong: "#C9BFAD",        // form inputs, dividers that need contrast
  divider: "#ECE5D8",             // horizontal rules, separators

  // Text
  textPrimary: "#0B1B33",         // headings, body (ink)
  textSecondary: "#44516A",       // secondary info
  textTertiary: "#6A7789",        // labels, captions, timestamps
  textDisabled: "#9AA3B2",        // disabled controls
  textMuted: "#8A94A4",           // placeholder-style text
  textOnPrimary: "#FFFFFF",       // text on primary-colored backgrounds
  textOnDanger: "#FFFFFF",        // text on destructive backgrounds

  // Brand primary (institutional cobalt)
  primary: "#0E3C9C",             // primary buttons, active nav, links
  primaryHover: "#0A2F7E",        // primary hover state
  primarySurface: "#E8EDFA",      // light tint for selected rows, active nav bg
  primarySurfaceAlt: "#D8E2F8",   // slightly deeper tint
  primaryMuted: "#9DB2DC",        // disabled primary text or icons

  // Legacy aliases (so existing code doesn't break during migration)
  action: "#0E3C9C",
  actionSurface: "#E8EDFA",
  actionSurfaceAlt: "#D8E2F8",

  // Semantic: Destructive / Danger
  destructive: "#C0392B",
  destructiveHover: "#9E2F24",
  destructiveSurface: "#FAE9E5",
  destructiveSurfaceAlt: "#F5D8D2",
  destructiveText: "#9E2F24",

  // Semantic: Success (jade)
  success: "#0B7C5C",
  successSurface: "#E2F4EC",
  successText: "#086349",

  // Semantic: Warning (saffron)
  warning: "#B77900",
  warningSurface: "#FBF0D2",
  warningText: "#8A5C00",

  // Semantic: Info
  info: "#2563A8",
  infoSurface: "#E8F1FA",
  infoText: "#1E548C",

  // Semantic: Gold accent (badges, highlights)
  gold: "#F2B21B",
  goldSurface: "#FDF3D4",
  goldText: "#8A5C00",

  // Shadows
  shadow: "rgba(11, 27, 51, 0.10)",
  shadowStrong: "rgba(11, 27, 51, 0.20)",

  // Focus
  focusRing: "rgba(14, 60, 156, 0.42)",

  // Skeleton / Shimmer
  skeletonBase: "#E7E0D2",
  skeletonShimmer: "#F7F2E7",

  // Form inputs
  inputBg: "#FFFEFA",
  inputBorder: "#CFC6B4",
  inputBorderFocus: "#0E3C9C",

  // Cards
  cardBg: "#FFFCF6",

  // Tab bar
  tabBarBg: "#FFFCF6",

  // Hover states
  hoverOverlay: "rgba(11, 27, 51, 0.04)",
  activeOverlay: "rgba(11, 27, 51, 0.07)",

  // Badge variants (portfolio types)
  badgeWebsiteBg: "#E8EDFA",
  badgeWebsiteText: "#1D4ED8",
  badgeThesisBg: "#EFE9FB",
  badgeThesisText: "#6D28D9",
  badgeCapstoneBg: "#E2F4EC",
  badgeCapstoneText: "#086349",
  badgeProjectBg: "#FDF3D4",
  badgeProjectText: "#8A5C00",
  badgeUpdateBg: "#F0EBE0",
  badgeUpdateText: "#44516A",
  badgeImageBg: "#FBE9F1",
  badgeImageText: "#A61E5C",

  // Chat bubbles
  bubbleMine: "#0E3C9C",
  bubbleMineText: "#FFFFFF",
  bubblePeer: "#FFFCF6",
  bubblePeerText: "#0B1B33",
  textOnActionMuted: "#D8E2F8",

  // Sidebar (admin)
  sidebarBg: "#0A1830",
  sidebarBorder: "rgba(246, 242, 232, 0.10)",
  sidebarActiveBg: "rgba(76, 123, 255, 0.20)",
  sidebarActiveText: "#FFFDF8",
  sidebarItemText: "#A9B6CC",
  sidebarItemHover: "rgba(255, 255, 255, 0.06)",
  sidebarHeaderBg: "#081326",

  // Table
  tableHeaderBg: "#F6F1E7",
  tableRowHover: "#FBF6EC",
  tableRowBorder: "#F0EADD",

  // ── Editorial layer: surfaces & ink ──────────────────────────────────────
  panel: "#FFFCF6",
  panelRaised: "#FFFEFA",
  panelInset: "#F0EBE0",
  line: "#E4DDCF",
  lineStrong: "#C9BFAD",
  ink: "#0B1B33",
  inkSoft: "#44516A",
  inkFaint: "#6A7789",
  inkOnDark: "#F6F2E8",

  // ── Editorial layer: cobalt ──────────────────────────────────────────────
  brand: "#0E3C9C",
  brandSolid: "#0E3C9C",
  brandDeep: "#082A70",
  brandBright: "#2B62E8",
  brandWash: "#E8EDFA",
  brandWashStrong: "#D8E2F8",

  // ── Editorial layer: saffron ─────────────────────────────────────────────
  accent: "#C98A00",
  accentBright: "#F2B21B",
  accentText: "#8A5C00",
  accentWash: "#FBF0D2",

  // ── Editorial layer: jade ────────────────────────────────────────────────
  jade: "#0B7C5C",
  jadeBright: "#17A97C",
  jadeText: "#086349",
  jadeWash: "#E2F4EC",

  // ── Editorial layer: coral ───────────────────────────────────────────────
  coral: "#C0392B",
  coralBright: "#E4574A",
  coralText: "#9E2F24",
  coralWash: "#FAE9E5",

  // ── Command sidebar ──────────────────────────────────────────────────────
  navBg: "#0A1830",
  navBgAlt: "#0D2144",
  navLine: "rgba(246, 242, 232, 0.10)",
  navText: "#A9B6CC",
  navTextActive: "#FFFDF8",
  navActiveBg: "rgba(76, 123, 255, 0.20)",
  navHoverBg: "rgba(255, 255, 255, 0.06)",
  navAccent: "#F2B21B",

  // ── Hero / pulse ────────────────────────────────────────────────────────
  heroFrom: "#0B2F78",
  heroTo: "#17439F",
  heroGlow: "#4C7BFF",
  heroText: "#F7F4EC",
  heroTextMuted: "rgba(247, 244, 236, 0.72)",
  heroLine: "rgba(247, 244, 236, 0.16)",

  // Role mix (readable on the cobalt hero in both themes)
  mixStudent: "#8FB4FF",
  mixFaculty: "#8FF0D3",
  mixDept: "#F2B21B",
  mixAdmin: "#FFB4A8",
  mixSuper: "#EAD9FF",

  // Scrim
  scrim: "rgba(10, 24, 48, 0.45)",
};

// ─── Dark Theme ─────────────────────────────────────────────────────────────

export const DARK_TOKENS: typeof LIGHT_TOKENS = {
  // Surfaces (ordered by elevation — lighter = higher elevation)
  surfacePage: "#070C15",
  surface: "#0F1726",
  surfaceElevated: "#141E30",
  surfaceSunken: "#0A111D",
  surfaceOverlay: "rgba(0, 0, 0, 0.62)",

  // Borders
  border: "rgba(236, 241, 249, 0.10)",
  borderStrong: "rgba(236, 241, 249, 0.20)",
  divider: "rgba(236, 241, 249, 0.08)",

  // Text
  textPrimary: "#ECF1F9",
  textSecondary: "#B3C0D4",
  textTertiary: "#8595AD",
  textDisabled: "#4A5B75",
  textMuted: "#62748F",
  textOnPrimary: "#FFFFFF",
  textOnDanger: "#FFFFFF",

  // Brand primary (lighter cobalt for dark backgrounds)
  primary: "#6E9BFF",
  primaryHover: "#8FB4FF",
  primarySurface: "rgba(110, 155, 255, 0.14)",
  primarySurfaceAlt: "rgba(110, 155, 255, 0.22)",
  primaryMuted: "#35548F",

  // Legacy aliases
  action: "#6E9BFF",
  actionSurface: "rgba(110, 155, 255, 0.14)",
  actionSurfaceAlt: "rgba(110, 155, 255, 0.22)",

  // Semantic: Destructive / Danger
  destructive: "#FF8B7E",
  destructiveHover: "#FFA79D",
  destructiveSurface: "rgba(255, 139, 126, 0.12)",
  destructiveSurfaceAlt: "rgba(255, 139, 126, 0.18)",
  destructiveText: "#FF9F94",

  // Semantic: Success
  success: "#4FD3AC",
  successSurface: "rgba(79, 211, 172, 0.12)",
  successText: "#6FE3C0",

  // Semantic: Warning
  warning: "#F2B21B",
  warningSurface: "rgba(242, 178, 27, 0.12)",
  warningText: "#F5C55C",

  // Semantic: Info
  info: "#6DB7F0",
  infoSurface: "rgba(109, 183, 240, 0.12)",
  infoText: "#8FCBF5",

  // Semantic: Gold accent
  gold: "#F5C518",
  goldSurface: "rgba(245, 197, 24, 0.12)",
  goldText: "#F8D45C",

  // Shadows
  shadow: "rgba(0, 0, 0, 0.34)",
  shadowStrong: "rgba(0, 0, 0, 0.54)",

  // Focus
  focusRing: "rgba(110, 155, 255, 0.50)",

  // Skeleton / Shimmer
  skeletonBase: "#141E30",
  skeletonShimmer: "#1C2940",

  // Form inputs
  inputBg: "#0B1424",
  inputBorder: "#243450",
  inputBorderFocus: "#6E9BFF",

  // Cards
  cardBg: "#0F1726",

  // Tab bar
  tabBarBg: "#0A111D",

  // Hover states
  hoverOverlay: "rgba(255, 255, 255, 0.04)",
  activeOverlay: "rgba(255, 255, 255, 0.07)",

  // Badge variants (dark-friendly)
  badgeWebsiteBg: "rgba(110, 155, 255, 0.18)",
  badgeWebsiteText: "#8FB4FF",
  badgeThesisBg: "rgba(139, 92, 246, 0.18)",
  badgeThesisText: "#B794F6",
  badgeCapstoneBg: "rgba(79, 211, 172, 0.15)",
  badgeCapstoneText: "#6FE3C0",
  badgeProjectBg: "rgba(242, 178, 27, 0.15)",
  badgeProjectText: "#F5C55C",
  badgeUpdateBg: "rgba(148, 163, 184, 0.12)",
  badgeUpdateText: "#A9B6CC",
  badgeImageBg: "rgba(244, 114, 182, 0.15)",
  badgeImageText: "#F472B6",

  // Chat bubbles
  bubbleMine: "#2A4A8A",
  bubbleMineText: "#FFFFFF",
  bubblePeer: "#141E30",
  bubblePeerText: "#ECF1F9",
  textOnActionMuted: "rgba(110, 155, 255, 0.60)",

  // Sidebar (admin)
  sidebarBg: "#060B14",
  sidebarBorder: "rgba(236, 241, 249, 0.08)",
  sidebarActiveBg: "rgba(110, 155, 255, 0.16)",
  sidebarActiveText: "#FFFFFF",
  sidebarItemText: "#93A2B8",
  sidebarItemHover: "rgba(255, 255, 255, 0.05)",
  sidebarHeaderBg: "#050A12",

  // Table
  tableHeaderBg: "#0A111D",
  tableRowHover: "rgba(110, 155, 255, 0.06)",
  tableRowBorder: "rgba(236, 241, 249, 0.07)",

  // ── Editorial layer: surfaces & ink ──────────────────────────────────────
  panel: "#0F1726",
  panelRaised: "#141E30",
  panelInset: "#0A111D",
  line: "rgba(236, 241, 249, 0.10)",
  lineStrong: "rgba(236, 241, 249, 0.20)",
  ink: "#ECF1F9",
  inkSoft: "#B3C0D4",
  inkFaint: "#8595AD",
  inkOnDark: "#F6F2E8",

  // ── Editorial layer: cobalt ──────────────────────────────────────────────
  brand: "#82A9FF",
  brandSolid: "#2D5BD7",
  brandDeep: "#0A255C",
  brandBright: "#9DBAFF",
  brandWash: "rgba(130, 169, 255, 0.14)",
  brandWashStrong: "rgba(130, 169, 255, 0.22)",

  // ── Editorial layer: saffron ─────────────────────────────────────────────
  accent: "#F2B21B",
  accentBright: "#F8CB58",
  accentText: "#F5C55C",
  accentWash: "rgba(242, 178, 27, 0.14)",

  // ── Editorial layer: jade ────────────────────────────────────────────────
  jade: "#4FD3AC",
  jadeBright: "#7CE7C8",
  jadeText: "#7CE7C8",
  jadeWash: "rgba(79, 211, 172, 0.14)",

  // ── Editorial layer: coral ───────────────────────────────────────────────
  coral: "#FF8B7E",
  coralBright: "#FFA79D",
  coralText: "#FF9F94",
  coralWash: "rgba(255, 139, 126, 0.14)",

  // ── Command sidebar ──────────────────────────────────────────────────────
  navBg: "#060B14",
  navBgAlt: "#0A1424",
  navLine: "rgba(236, 241, 249, 0.08)",
  navText: "#93A2B8",
  navTextActive: "#FFFFFF",
  navActiveBg: "rgba(110, 155, 255, 0.16)",
  navHoverBg: "rgba(255, 255, 255, 0.05)",
  navAccent: "#F2B21B",

  // ── Hero / pulse ────────────────────────────────────────────────────────
  heroFrom: "#0A255C",
  heroTo: "#123A86",
  heroGlow: "#6E9BFF",
  heroText: "#F7F4EC",
  heroTextMuted: "rgba(247, 244, 236, 0.72)",
  heroLine: "rgba(247, 244, 236, 0.16)",

  // Role mix (readable on the cobalt hero in both themes)
  mixStudent: "#8FB4FF",
  mixFaculty: "#8FF0D3",
  mixDept: "#F2B21B",
  mixAdmin: "#FFB4A8",
  mixSuper: "#EAD9FF",

  // Scrim
  scrim: "rgba(0, 0, 0, 0.62)",
};

export type ThemeTokens = typeof LIGHT_TOKENS;

// ─── Spacing, radii, typography, motion ─────────────────────────────────────

/** 4px base spacing scale. */
export const SPACE = {
  x1: 4,
  x2: 8,
  x3: 12,
  x4: 16,
  x5: 20,
  x6: 24,
  x8: 32,
  x10: 40,
  x12: 48,
  x16: 64,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  pill: 9999,
} as const;

/** System sans for UI, Georgia/serif for editorial display, mono for labels. */
export const sansFamily = Platform.select({
  web: "'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
  default: undefined,
});

export const serifFamily = Platform.select({
  web: "Georgia, 'Palatino Linotype', 'Book Antiqua', 'Times New Roman', serif",
  ios: "Georgia",
  android: "serif",
  default: "Georgia",
});

export const monoFamily = Platform.select({
  web: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

export const TYPE: Record<string, TextStyle> = {
  micro: {
    fontFamily: monoFamily,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 1.3,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  caption: { fontSize: 12, lineHeight: 16 },
  body: { fontSize: 14, lineHeight: 21 },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  title: { fontSize: 16, lineHeight: 22, fontWeight: "700", letterSpacing: -0.2 },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: "700", letterSpacing: -0.4 },
  h1: {
    fontFamily: serifFamily,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    fontWeight: "600",
  },
  display: {
    fontFamily: serifFamily,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -1.6,
    fontWeight: "600",
  },
  kpi: {
    fontFamily: serifFamily,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.2,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
};

export const MOTION = {
  fast: 140,
  base: 200,
  slow: 260,
  countUp: 750,
  stagger: 45,
} as const;

/** Soft layered elevation. Uses the active theme's shadow color. */
export function elevation(
  level: "sm" | "md" | "lg",
  colors: ThemeTokens
): {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
} {
  const map = {
    sm: { height: 1, opacity: 0.06, radius: 3, android: 1 },
    md: { height: 6, opacity: 0.09, radius: 18, android: 4 },
    lg: { height: 14, opacity: 0.16, radius: 34, android: 10 },
  } as const;
  const value = map[level];
  return {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: value.height },
    shadowOpacity: value.opacity,
    shadowRadius: value.radius,
    elevation: value.android,
  };
}

/**
 * Web focus ring that survives React Native Web's style flattening.
 *
 * `outline` is declared by RNW's types but is not emitted by its style
 * resolver, so an inset box-shadow is used instead. It needs no layout space
 * and remains visible inside overflow-hidden panels such as tables.
 */
export function focusRing(colors: ThemeTokens, visible: boolean): import("react-native").ViewStyle {
  if (!visible) return {};
  return {
    boxShadow: `inset 0 0 0 2px ${colors.focusRing}`,
  };
}
