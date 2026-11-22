/**
 * Appearance preference — the single source of truth for how the app decides
 * between the light and dark token sets.
 *
 * The application default is `"system"`: a fresh install follows the device
 * unless the user pins Light or Dark in Settings. Keeping the default as a
 * named constant makes that product decision explicit and testable.
 */

import { LIGHT_TOKENS, DARK_TOKENS } from "./tokens";

export type ColorSchemePreference = "system" | "light" | "dark";

/** What a new install starts on. */
export const DEFAULT_COLOR_SCHEME: ColorSchemePreference = "system";

/** User-selected accent color index into the accentColor palette. */
export type AccentColorPreference =
  | "blue"
  | "indigo"
  | "teal"
  | "green"
  | "olive"
  | "yellow"
  | "orange"
  | "brown"
  | "rose"
  | "pink"
  | "purple"
  | "violet";

/** Default accent preserves the existing cobalt branding. */
export const DEFAULT_ACCENT_COLOR: AccentColorPreference = "blue";

/** Cycle order used by the theme toggle (System → Light → Dark → System). */
export const COLOR_SCHEME_ORDER: readonly ColorSchemePreference[] = [
  "system",
  "light",
  "dark",
];

export function isColorSchemePreference(value: unknown): value is ColorSchemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/** Narrow the accent color preference type guard. */
export function isAccentColorPreference(value: unknown): value is AccentColorPreference {
  return (
    value === "blue" ||
    value === "indigo" ||
    value === "teal" ||
    value === "green" ||
    value === "olive" ||
    value === "yellow" ||
    value === "orange" ||
    value === "brown" ||
    value === "rose" ||
    value === "pink" ||
    value === "purple" ||
    value === "violet"
  );
}

/**
 * Turns a stored preference into a concrete scheme.
 *
 * `"system"` follows the device; anything unrecognised falls back to the
 * default. A device that reports no scheme resolves to light, which is the
 * conservative choice for first paint.
 */
export function resolveColorScheme(
  preference: unknown,
  systemScheme: string | null | undefined
): "light" | "dark" {
  const pref = isColorSchemePreference(preference) ? preference : DEFAULT_COLOR_SCHEME;

  if (pref === "system") {
    return systemScheme === "dark" ? "dark" : "light";
  }

  return pref;
}

/** Next preference in the toggle cycle. */
export function nextColorScheme(preference: unknown): ColorSchemePreference {
  const current = isColorSchemePreference(preference) ? preference : DEFAULT_COLOR_SCHEME;
  const index = COLOR_SCHEME_ORDER.indexOf(current);
  return COLOR_SCHEME_ORDER[(index + 1) % COLOR_SCHEME_ORDER.length];
}

/** Human-readable name for a preference. Every surface that shows the current
 * appearance (menus, toggles, radio lists) reads the label from here so the
 * wording cannot drift between them.
 */
export function colorSchemeLabel(preference: unknown): string {
  const current = isColorSchemePreference(preference) ? preference : DEFAULT_COLOR_SCHEME;
  if (current === "light") return "Light";
  if (current === "dark") return "Dark";
  return "System";
}

/** Return the hex for the user's selected accent color (light/dark aware). */
export function resolveAccentColor(
  preference: AccentColorPreference,
  isDark: boolean,
  tokens: typeof LIGHT_TOKENS
): string {
  const palette = isDark ? tokens.accentColor.dark : tokens.accentColor.light;
  return palette[preference];
}

/** Next accent color in the cycle (wraps around). */
export function nextAccentColor(preference: AccentColorPreference): AccentColorPreference {
  const order: readonly AccentColorPreference[] = [
    "blue",
    "indigo",
    "teal",
    "green",
    "olive",
    "yellow",
    "orange",
    "brown",
    "rose",
    "pink",
    "purple",
    "violet",
  ];
  const index = order.indexOf(preference);
  return order[(index + 1) % order.length];
}

/** Local-storage key for the persisted accent-color preference. */
const STORAGE_ACCENT_KEY = "accent_color_preference";

/** Storage version bump when the default accent palette changes. */
const STORAGE_ACCENT_VERSION_KEY = "accent_color_preference_version";
const STORAGE_ACCENT_VERSION = "1";
