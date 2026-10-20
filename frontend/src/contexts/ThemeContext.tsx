import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LIGHT_TOKENS, DARK_TOKENS, ThemeTokens } from "../lib/tokens";

export type ColorSchemePreference = "system" | "light" | "dark";

interface ThemeContextValue {
  preference: ColorSchemePreference;
  resolved: "light" | "dark";
  isDark: boolean;
  colors: ThemeTokens;
  setColorScheme: (preference: ColorSchemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const STORAGE_KEY = "theme_preference";

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system",
  resolved: "light",
  isDark: false,
  colors: LIGHT_TOKENS,
  setColorScheme: async () => {},
  toggleTheme: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null | undefined
  const [preference, setPreference] = useState<ColorSchemePreference>("system");

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!mounted || !saved) return;
        if (saved === "light" || saved === "dark" || saved === "system") {
          setPreference(saved);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const setColorScheme = useCallback(async (newPref: ColorSchemePreference) => {
    setPreference(newPref);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newPref);
    } catch {}
  }, []);

  const resolved: "light" | "dark" =
    preference === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : preference;

  const isDark = resolved === "dark";
  const colors = isDark ? DARK_TOKENS : LIGHT_TOKENS;

  const toggleTheme = useCallback(async () => {
    const next = isDark ? "light" : "dark";
    await setColorScheme(next);
  }, [isDark, setColorScheme]);

  return (
    <ThemeContext.Provider
      value={{
        preference,
        resolved,
        isDark,
        colors,
        setColorScheme,
        toggleTheme,
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
