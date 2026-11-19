import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LIGHT_TOKENS, DARK_TOKENS, ThemeTokens } from "../lib/tokens";
import {
  DEFAULT_COLOR_SCHEME,
  isColorSchemePreference,
  nextColorScheme,
  resolveColorScheme,
  type ColorSchemePreference,
} from "../lib/theme";

export type { ColorSchemePreference } from "../lib/theme";

interface ThemeContextValue {
  preference: ColorSchemePreference;
  resolved: "light" | "dark";
  isDark: boolean;
  colors: ThemeTokens;
  setColorScheme: (preference: ColorSchemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
  /** Cycle through Light → Dark → System */
  cycleTheme: () => Promise<void>;
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
  setColorScheme: async () => {},
  toggleTheme: async () => {},
  cycleTheme: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null | undefined
  const [preference, setPreference] = useState<ColorSchemePreference>(DEFAULT_COLOR_SCHEME);

  // Restore the user's explicit choice. Builds older than v2 defaulted to a
  // forced appearance, so their saved value is discarded once and the app
  // adopts the current default (system).
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const version = await AsyncStorage.getItem(STORAGE_VERSION_KEY);

        if (version !== STORAGE_VERSION) {
          await AsyncStorage.multiRemove([STORAGE_KEY, STORAGE_VERSION_KEY]);
          await AsyncStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
          if (mounted) setPreference(DEFAULT_COLOR_SCHEME);
          return;
        }

        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (mounted && isColorSchemePreference(saved)) {
          setPreference(saved);
        }
      } catch {
        // Storage unavailable: stay on the default.
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

  const resolved = resolveColorScheme(preference, systemScheme);
  const isDark = resolved === "dark";
  const colors = isDark ? DARK_TOKENS : LIGHT_TOKENS;

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
        setColorScheme,
        toggleTheme,
        cycleTheme,
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
