/**
 * Appearance preference — the single source of truth for how the app decides
 * between the light and dark token sets.
 *
 * The application default is `"system"`: a fresh install follows the device
 * unless the user pins Light or Dark in Settings. Keeping the default as a
 * named constant makes that product decision explicit and testable.
 */

export type ColorSchemePreference = "system" | "light" | "dark";

/** What a new install starts on. */
export const DEFAULT_COLOR_SCHEME: ColorSchemePreference = "system";

/** Cycle order used by the theme toggle (System → Light → Dark → System). */
export const COLOR_SCHEME_ORDER: readonly ColorSchemePreference[] = [
  "system",
  "light",
  "dark",
];

export function isColorSchemePreference(value: unknown): value is ColorSchemePreference {
  return value === "system" || value === "light" || value === "dark";
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

/**
 * Human-readable name for a preference. Every surface that shows the current
 * appearance (menus, toggles, radio lists) reads the label from here so the
 * wording cannot drift between them.
 */
export function colorSchemeLabel(preference: unknown): string {
  const current = isColorSchemePreference(preference) ? preference : DEFAULT_COLOR_SCHEME;
  if (current === "light") return "Light";
  if (current === "dark") return "Dark";
  return "System";
}
