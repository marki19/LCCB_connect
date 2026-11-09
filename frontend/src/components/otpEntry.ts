/**
 * Pure digit-routing rules behind `OtpInput`. Kept free of React Native imports
 * so vitest can exercise it without the app's component test harness.
 */

export interface OtpEdit {
  digits: string[];
  /** Box that should hold focus after the edit. */
  focus: number;
}

const digitsOf = (value: string): string => value.replace(/\D/g, "");

/**
 * Applies one edit to the digit row.
 *
 * - Empty value: clears a filled box, or steps back and clears the previous
 *   box when the edited box was already empty (smart Backspace).
 * - One digit: writes it, then advances.
 * - Several digits (paste or autofill): spreads them forward from `index`.
 *
 * Returns `null` when the edit changes nothing.
 */
export function applyOtpEdit(
  digits: string[],
  value: string,
  index: number,
): OtpEdit | null {
  const length = digits.length;
  const entered = digitsOf(value);
  const next = [...digits];

  if (entered.length === 0) {
    if (digits[index]) {
      next[index] = "";
      return { digits: next, focus: index };
    }
    if (index > 0) {
      next[index - 1] = "";
      return { digits: next, focus: index - 1 };
    }
    return null;
  }

  if (entered.length === 1) {
    next[index] = entered;
    return { digits: next, focus: Math.min(index + 1, length - 1) };
  }

  let cursor = index;
  for (const char of entered) {
    if (cursor >= length) break;
    next[cursor] = char;
    cursor += 1;
  }
  const firstEmpty = next.findIndex((digit) => digit === "");
  return {
    digits: next,
    focus: firstEmpty === -1 ? length - 1 : firstEmpty,
  };
}
