import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LIGHT_TOKENS, DARK_TOKENS, ThemeTokens } from "../lib/tokens";
import {
  DEFAULT_COLOR_SCHEME,
  isColorSchemePreference,
  isAccentColorPreference,
  nextColorScheme,
  resolveColorScheme,
  type ColorSchemePreference,
  DEFAULT_ACCENT_COLOR,
  resolveAccentColor,
  nextAccentColor,
  type AccentColorPreference,
  deriveAccentTokens,
  lighten,
  darken,
  hexToRgb,
  STORAGE_ACCENT_KEY,
  STORAGE_ACCENT_VERSION_KEY,
  STORAGE_ACCENT_VERSION,
  STORAGE_CUSTOM_ACCENT_KEY,
} from "../lib/theme";

export type { ColorSchemePreference } from "../lib/theme";

interface ThemeContextValue {
  preference: ColorSchemePreference;
  resolved: "light" | "dark";
  isDark: boolean;
  colors: ThemeTokens;
  accentColor: string;
  setColorScheme: (preference: ColorSchemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
  /** Cycle through Light → Dark → System */
  cycleTheme: () => Promise<void>;
  accentPreference: AccentColorPreference;
  setAccent: (preference: AccentColorPreference) => void;
  /** Hex chosen in the custom color picker; used when accentPreference is "custom". */
  customAccentHex: string | null;
  setCustomAccent: (hex: string) => void;
  /** Restore the shipped appearance (system theme, default accent) on logout. */
  resetTheme: () => Promise<void>;
  toggleAccent: () => Promise<void>;
}

const STORAGE_KEY = "theme_preference";

/**
 * Persisted-preference schema version. Bumped when the shipped default changes
 * so a choice saved by an older build cannot pin the app to the old default.
 */
const STORAGE_VERSION_KEY = "theme_preference_version";
const STORAGE_VERSION = "2";

const ThemeContext = createContext<ThemeContextValue>({
  preference: DEFAULT_COLOR_SCHEME,
  resolved: "light",
  isDark: false,
  colors: LIGHT_TOKENS,
  accentColor: "#0E3C9C",
  setColorScheme: async () => {},
  toggleTheme: async () => {},
  cycleTheme: async () => {},
  accentPreference: DEFAULT_ACCENT_COLOR,
  setAccent: (_: AccentColorPreference) => {},
  customAccentHex: null,
  setCustomAccent: (_: string) => {},
  resetTheme: async () => {},
  toggleAccent: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null | undefined
  const [preference, setPreference] = useState<ColorSchemePreference>(DEFAULT_COLOR_SCHEME);
  const [accentPreference, setAccent] = useState<AccentColorPreference>(DEFAULT_ACCENT_COLOR);
  const [customAccentHex, setCustomAccentHex] = useState<string | null>(null);

  /**
   * AsyncStorage is async. Without this guard a storage read that resolves
   * after the user has already tapped a theme can overwrite their choice with
   * the stale value read from disk — the tap looks like it "did nothing".
   * Every explicit user action sets this flag; restore checks it after every
   * await and bails out as soon as the user has taken control.
   */
  const userInteractedRef = useRef(false);

  // Restore the user's explicit choices. Builds older than v2 defaulted to
  // forced appearances, so their saved values are discarded once and the app
  // adopts the current defaults (system theme + default accent).
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const version = await AsyncStorage.getItem(STORAGE_VERSION_KEY);
        if (!mounted || userInteractedRef.current) return;

        if (version !== STORAGE_VERSION) {
          await AsyncStorage.multiRemove([
            STORAGE_KEY,
            STORAGE_VERSION_KEY,
            STORAGE_ACCENT_KEY,
            STORAGE_ACCENT_VERSION_KEY,
            STORAGE_CUSTOM_ACCENT_KEY,
          ]);
          if (!mounted || userInteractedRef.current) return;
          // Write the schema marker first so a restart during a slow write can
          // never make the next launch discard the just-saved preference.
          await AsyncStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
          await AsyncStorage.setItem(STORAGE_ACCENT_VERSION_KEY, STORAGE_ACCENT_VERSION);
          if (!mounted || userInteractedRef.current) return;
          setPreference(DEFAULT_COLOR_SCHEME);
          setAccent(DEFAULT_ACCENT_COLOR);
          setCustomAccentHex(null);
          return;
        }

        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted || userInteractedRef.current) return;
        if (isColorSchemePreference(saved)) {
          setPreference(saved);
        }

        const accentSaved = await AsyncStorage.getItem(STORAGE_ACCENT_KEY);
        if (!mounted || userInteractedRef.current) return;
        if (isAccentColorPreference(accentSaved)) {
          setAccent(accentSaved);
        }

        const customSaved = await AsyncStorage.getItem(STORAGE_CUSTOM_ACCENT_KEY);
        if (!mounted || userInteractedRef.current) return;
        if (customSaved) {
          setCustomAccentHex(customSaved);
        }
      } catch {
        // Storage unavailable: stay on the defaults.
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setColorScheme = useCallback(async (newPref: ColorSchemePreference) => {
    // Update React state synchronously — the UI must react on the same tick as
    // the tap, independent of how slow the storage write is.
    userInteractedRef.current = true;
    setPreference(newPref);
    try {
      // Keep the schema marker ahead of the value so a partial write cannot
      // make the next launch wipe the preference the user just chose.
      await AsyncStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
      await AsyncStorage.setItem(STORAGE_KEY, newPref);
    } catch {}
  }, []);

  /** Persist the accent color whenever it changes. */
  const setAccentAndPersist = useCallback(
    (pref: AccentColorPreference) => {
      userInteractedRef.current = true;
      setAccent(pref);
      try {
        AsyncStorage.setItem(STORAGE_ACCENT_VERSION_KEY, STORAGE_ACCENT_VERSION);
        AsyncStorage.setItem(STORAGE_ACCENT_KEY, pref);
      } catch {}
    },
    []
  );

  /** Apply a color chosen in the custom color picker. */
  const setCustomAccent = useCallback((hex: string) => {
    userInteractedRef.current = true;
    setCustomAccentHex(hex);
    setAccent("custom");
    try {
      AsyncStorage.setItem(STORAGE_ACCENT_VERSION_KEY, STORAGE_ACCENT_VERSION);
      AsyncStorage.setItem(STORAGE_CUSTOM_ACCENT_KEY, hex);
      AsyncStorage.setItem(STORAGE_ACCENT_KEY, "custom");
    } catch {}
  }, []);

  /**
   * Return the app to its shipped appearance when a user signs out. Write the
   * defaults to storage (not just memory) so they survive a restart too.
   */
  const resetTheme = useCallback(async () => {
    // Block any storage restore still in flight from re-applying the previous
    // account's preferences after the reset.
    userInteractedRef.current = true;
    setPreference(DEFAULT_COLOR_SCHEME);
    setAccent(DEFAULT_ACCENT_COLOR);
    setCustomAccentHex(null);
    try {
      await AsyncStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
      await AsyncStorage.setItem(STORAGE_KEY, DEFAULT_COLOR_SCHEME);
      await AsyncStorage.setItem(STORAGE_ACCENT_VERSION_KEY, STORAGE_ACCENT_VERSION);
      await AsyncStorage.setItem(STORAGE_ACCENT_KEY, DEFAULT_ACCENT_COLOR);
      await AsyncStorage.removeItem(STORAGE_CUSTOM_ACCENT_KEY);
    } catch {}
  }, []);

  /** Cycle accent colors forward (default → indigo → … → custom → default). */
  const toggleAccent = useCallback(async () => {
    const next = nextAccentColor(accentPreference);
    setAccentAndPersist(next);
  }, [accentPreference, setAccentAndPersist]);

  const resolved = resolveColorScheme(preference, systemScheme);
  const isDark = resolved === "dark";

  // Select the appropriate token set (light/dark) and compute the resolved
  // accent color hex so UI elements instantly pick up the new accent.
  const baseTokens = isDark ? DARK_TOKENS : LIGHT_TOKENS;
  const accentColorHex = resolveAccentColor(accentPreference, isDark, baseTokens, customAccentHex);

  // Derive accent-related tokens (wash, text, bright) from the selected accent
  const derivedAccent = deriveAccentTokens(accentColorHex, isDark);

  // For the primary action colors (buttons, links, focus rings, etc.),
  // use the selected accent color. This replaces the default cobalt branding
  // with the user's chosen accent across the entire UI.
  const primaryHover = isDark ? lighten(accentColorHex, 0.15) : darken(accentColorHex, 0.15);
  const primarySurface = isDark
    ? `rgba(${hexToRgb(accentColorHex)?.r}, ${hexToRgb(accentColorHex)?.g}, ${hexToRgb(accentColorHex)?.b}, 0.14)`
    : `rgba(${hexToRgb(accentColorHex)?.r}, ${hexToRgb(accentColorHex)?.g}, ${hexToRgb(accentColorHex)?.b}, 0.14)`;
  const primarySurfaceAlt = isDark
    ? `rgba(${hexToRgb(accentColorHex)?.r}, ${hexToRgb(accentColorHex)?.g}, ${hexToRgb(accentColorHex)?.b}, 0.22)`
    : `rgba(${hexToRgb(accentColorHex)?.r}, ${hexToRgb(accentColorHex)?.g}, ${hexToRgb(accentColorHex)?.b}, 0.22)`;

  // Augment the base token set with the user's selected accent so every
  // component reading colors.accent (buttons, badges, links, focus rings,
  // etc.) instantly picks up the new color. colors.accentColor keeps the
  // full palette for the swatch grid itself.
  const colors: ThemeTokens = {
    ...baseTokens,
    accent: accentColorHex,
    accentWash: derivedAccent.accentWash,
    accentText: derivedAccent.accentText,
    accentBright: derivedAccent.accentBright,
    // Primary action colors - these drive buttons, links, active states, etc.
    primary: accentColorHex,
    primaryHover,
    primarySurface,
    primarySurfaceAlt,
    primaryMuted: isDark ? darken(accentColorHex, 0.4) : lighten(accentColorHex, 0.4),
    // Legacy aliases (used by some components)
    action: accentColorHex,
    actionSurface: primarySurface,
    actionSurfaceAlt: primarySurfaceAlt,
    // Focus ring uses the accent color
    focusRing: isDark
      ? `rgba(${hexToRgb(accentColorHex)?.r}, ${hexToRgb(accentColorHex)?.g}, ${hexToRgb(accentColorHex)?.b}, 0.50)`
      : `rgba(${hexToRgb(accentColorHex)?.r}, ${hexToRgb(accentColorHex)?.g}, ${hexToRgb(accentColorHex)?.b}, 0.42)`,
    // Input focus border
    inputBorderFocus: accentColorHex,
  };

  const toggleTheme = useCallback(async () => {
    await setColorScheme(isDark ? "light" : "dark");
  }, [isDark, setColorScheme]);

  /** Cycle: light → dark → system → light … */
  const cycleTheme = useCallback(async () => {
    await setColorScheme(nextColorScheme(preference));
  }, [preference, setColorScheme]);

  return (
    <ThemeContext.Provider
      value={{
        preference,
        resolved,
        isDark,
        colors,
        accentColor: accentColorHex,
        setColorScheme,
        toggleTheme,
        cycleTheme,
        accentPreference,
        setAccent: setAccentAndPersist,
        customAccentHex,
        setCustomAccent,
        resetTheme,
        toggleAccent,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
