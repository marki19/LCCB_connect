import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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
  toggleAccent: () => Promise<void>;
}

const STORAGE_KEY = "theme_preference";

/**
 * Persisted-preference schema version. Bumped when the shipped default changes
 * so a choice saved by an older build cannot pin the app to the old default.
 */
const STORAGE_VERSION_KEY = "theme_preference_version";
const STORAGE_VERSION = "2";

/** Storage keys for the accent color preference. */
const STORAGE_ACCENT_KEY = "accent_color_preference";

const STORAGE_ACCENT_VERSION_KEY = "accent_color_preference_version";
const STORAGE_ACCENT_VERSION = "1";

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
  toggleAccent: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null | undefined
  const [preference, setPreference] = useState<ColorSchemePreference>(DEFAULT_COLOR_SCHEME);
  const [accentPreference, setAccent] = useState<AccentColorPreference>(DEFAULT_ACCENT_COLOR);

  // Restore the user's explicit choices. Builds older than v2 defaulted to
  // forced appearances, so their saved values are discarded once and the app
  // adopts the current defaults (system theme + blue accent).
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const version = await AsyncStorage.getItem(STORAGE_VERSION_KEY);

        if (version !== STORAGE_VERSION) {
          await AsyncStorage.multiRemove([STORAGE_KEY, STORAGE_VERSION_KEY, STORAGE_ACCENT_KEY, STORAGE_ACCENT_VERSION_KEY]);
          await AsyncStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
          await AsyncStorage.setItem(STORAGE_ACCENT_VERSION_KEY, STORAGE_ACCENT_VERSION);
          if (mounted) {
            setPreference(DEFAULT_COLOR_SCHEME);
            setAccent(DEFAULT_ACCENT_COLOR);
          }
          return;
        }

        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (mounted && isColorSchemePreference(saved)) {
          setPreference(saved);
        }

        const accentSaved = await AsyncStorage.getItem(STORAGE_ACCENT_KEY);
        if (mounted && isAccentColorPreference(accentSaved)) {
          setAccent(accentSaved);
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
    setPreference(newPref);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newPref);
      await AsyncStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
    } catch {}
  }, []);

  /** Persist the accent color whenever it changes. */
  const setAccentAndPersist = useCallback(
    (pref: AccentColorPreference) => {
      setAccent(pref);
      try {
        AsyncStorage.setItem(STORAGE_ACCENT_KEY, pref);
        AsyncStorage.setItem(STORAGE_ACCENT_VERSION_KEY, STORAGE_ACCENT_VERSION);
      } catch {}
    },
    []
  );

  /** Cycle accent colors forward (blue → indigo → teal → … → violet → blue). */
  const toggleAccent = useCallback(async () => {
    const next = nextAccentColor(accentPreference);
    setAccentAndPersist(next);
  }, [accentPreference, setAccentAndPersist]);

  const resolved = resolveColorScheme(preference, systemScheme);
  const isDark = resolved === "dark";

  // Select the appropriate token set (light/dark) and compute the resolved
  // accent color hex so UI elements instantly pick up the new accent.
  const baseTokens = isDark ? DARK_TOKENS : LIGHT_TOKENS;
  const accentColorHex = resolveAccentColor(accentPreference, isDark, baseTokens);

  // Build the augmented token set so colors.accentColor is the resolved hex.
  const colors: ThemeTokens = {
    ...baseTokens,
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
