import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLOR_SCHEME,
  colorSchemeLabel,
  isColorSchemePreference,
  nextColorScheme,
  resolveColorScheme,
} from "./theme";

describe("theme preference", () => {
  it("defaults to the system scheme", () => {
    expect(DEFAULT_COLOR_SCHEME).toBe("system");
  });

  it("follows the device when the preference is system", () => {
    expect(resolveColorScheme("system", "dark")).toBe("dark");
    expect(resolveColorScheme("system", "light")).toBe("light");
    // No reported scheme must not resolve to dark.
    expect(resolveColorScheme("system", null)).toBe("light");
    expect(resolveColorScheme("system", undefined)).toBe("light");
  });

  it("honours a pinned preference over the device", () => {
    expect(resolveColorScheme("light", "dark")).toBe("light");
    expect(resolveColorScheme("dark", "light")).toBe("dark");
  });

  it("falls back to the default for unknown values", () => {
    expect(resolveColorScheme("midnight", "dark")).toBe("dark");
    expect(resolveColorScheme(null, "light")).toBe("light");
  });

  it("validates stored values", () => {
    expect(isColorSchemePreference("system")).toBe(true);
    expect(isColorSchemePreference("light")).toBe(true);
    expect(isColorSchemePreference("dark")).toBe(true);
    expect(isColorSchemePreference("auto")).toBe(false);
    expect(isColorSchemePreference(null)).toBe(false);
  });

  it("cycles system → light → dark → system", () => {
    expect(nextColorScheme("system")).toBe("light");
    expect(nextColorScheme("light")).toBe("dark");
    expect(nextColorScheme("dark")).toBe("system");
  });

  it("labels every preference for menus and toggles", () => {
    expect(colorSchemeLabel("light")).toBe("Light");
    expect(colorSchemeLabel("dark")).toBe("Dark");
    expect(colorSchemeLabel("system")).toBe("System");
    // Unknown or missing values fall back to the default's label.
    expect(colorSchemeLabel(null)).toBe("System");
    expect(colorSchemeLabel("sepia")).toBe("System");
  });
});
