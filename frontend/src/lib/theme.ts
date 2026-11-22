/**
 * Appearance preference — the single source of truth for how the app decides
 * between the light and dark token sets.
 *
 * The application default is `"system"`: a fresh install follows the device
 * unless the user pins Light or Dark in Settings. Keeping the default as a
 * named constant makes that product decision explicit and testable.
 */

import { LIGHT_TOKENS } from "./tokens";

export type ColorSchemePreference = "system" | "light" | "dark";

/** What a new install starts on. */
export const DEFAULT_COLOR_SCHEME: ColorSchemePreference = "system";

/** User-selected accent color. "default" follows the theme's brand accent,
 *  "custom" uses a user-picked hex value. */
export type AccentColorPreference =
  | "default"
  | "indigo"
  | "teal"
  | "green"
  | "olive"
  | "yellow"
  | "orange"
  | "red"
  | "rose"
  | "pink"
  | "purple"
  | "custom";

/** Display + cycle order. The first entry is what a fresh install uses. */
export const ACCENT_CHOICES: readonly AccentColorPreference[] = [
  "default",
  "indigo",
  "teal",
  "green",
  "olive",
  "yellow",
  "orange",
  "red",
  "rose",
  "pink",
  "purple",
  "custom",
];

/** A new install starts on the app's own default accent. */
export const DEFAULT_ACCENT_COLOR: AccentColorPreference = "default";

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
  return ACCENT_CHOICES.includes(value as AccentColorPreference);
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
  tokens: typeof LIGHT_TOKENS,
  customHex?: string | null
): string {
  if (preference === "custom") {
    return customHex || tokens.accentColor.light.default;
  }
  const palette = isDark ? tokens.accentColor.dark : tokens.accentColor.light;
  return palette[preference] || palette.default;
}

/** Next accent color in the cycle (wraps around). */
export function nextAccentColor(preference: AccentColorPreference): AccentColorPreference {
  const index = ACCENT_CHOICES.indexOf(preference);
  return ACCENT_CHOICES[(index + 1) % ACCENT_CHOICES.length];
}

/** Storage keys for the accent preference and the user-picked custom color. */
export const STORAGE_ACCENT_KEY = "accent_color_preference";
export const STORAGE_CUSTOM_ACCENT_KEY = "accent_custom_color";

/** Storage version bump when the default accent palette changes. */
export const STORAGE_ACCENT_VERSION_KEY = "accent_color_preference_version";
export const STORAGE_ACCENT_VERSION = "2";

/**
 * Utility functions for color manipulation and contrast calculations
 */

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Derive accent-related tokens from the selected accent color */
export function deriveAccentTokens(accentHex: string, isDark: boolean): {
  accentWash: string;
  accentText: string;
  accentBright: string;
} {
  const luminance = getLuminance(accentHex);
  const accentText = luminance > 0.5 ? '#0B1B33' : '#FFFFFF';
  const accentBright = lighten(accentHex, 0.3);
  const accentWash = isDark
    ? `rgba(${hexToRgb(accentHex)?.r}, ${hexToRgb(accentHex)?.g}, ${hexToRgb(accentHex)?.b}, 0.14)`
    : `rgba(${hexToRgb(accentHex)?.r}, ${hexToRgb(accentHex)?.g}, ${hexToRgb(accentHex)?.b}, 0.14)`;
  
  return {
    accentWash,
    accentText,
    accentBright
  };
}

/** Lighten a hex color by blending with white */
export function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    Math.min(255, Math.max(0, rgb.r + (255 - rgb.r) * amount)),
    Math.min(255, Math.max(0, rgb.g + (255 - rgb.g) * amount)),
    Math.min(255, Math.max(0, rgb.b + (255 - rgb.b) * amount))
  );
}

/** Darken a hex color by blending with black */
export function darken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    Math.max(0, rgb.r * (1 - amount)),
    Math.max(0, rgb.g * (1 - amount)),
    Math.max(0, rgb.b * (1 - amount))
  );
}

/** Normalise user input to `#RRGGBB`, or null when it is not a valid hex color. */
export function normalizeHex(input: string): string | null {
  const clean = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return `#${clean.split("").map((c) => c + c).join("").toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `#${clean.toUpperCase()}`;
  }
  return null;
}

/** RGB (0-255) to HSL (h: 0-360, s/l: 0-100). */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, l: 50 };
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** HSL (h: 0-360, s/l: 0-100) to `#RRGGBB`. */
export function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgbToHex(
    Math.round((rgb[0] + m) * 255),
    Math.round((rgb[1] + m) * 255),
    Math.round((rgb[2] + m) * 255)
  );
}
