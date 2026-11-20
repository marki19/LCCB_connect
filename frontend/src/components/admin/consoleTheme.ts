/**
 * Admin console visual language.
 *
 * The console is a working surface, so headings, labels and metrics all use the
 * UI sans on one shared scale. Screens import these values instead of
 * re-declaring font sizes, which keeps the console consistent as it grows.
 */

import { type TextStyle, type ViewStyle } from "react-native";
import { RADIUS, sansFamily, type ThemeTokens } from "../../lib/tokens";

export const CONSOLE_TEXT: Record<string, TextStyle> = {
  /** Small uppercase label above a page title or a card heading. */
  eyebrow: {
    fontFamily: sansFamily,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  pageTitle: {
    fontFamily: sansFamily,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "600",
    letterSpacing: -0.7,
  },
  sectionTitle: {
    fontFamily: sansFamily,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  strong: {
    fontFamily: sansFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  body: {
    fontFamily: sansFamily,
    fontSize: 14,
    lineHeight: 21,
  },
  caption: {
    fontFamily: sansFamily,
    fontSize: 12.5,
    lineHeight: 17,
  },
  /** Large figure, used for a card's primary number. */
  metric: {
    fontFamily: sansFamily,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "600",
    letterSpacing: -0.9,
    fontVariant: ["tabular-nums"],
  },
  /** Secondary figure, used inside list rows and small summaries. */
  metricSmall: {
    fontFamily: sansFamily,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
};

/** Flat working card: one border, one radius, no shadow. */
export function consoleCard(colors: ThemeTokens): ViewStyle {
  return {
    backgroundColor: colors.panel,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.line,
  };
}
