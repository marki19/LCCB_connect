import { describe, expect, it } from "vitest";
import { applyOtpEdit } from "./otpEntry";

const empty = (length = 6) => Array<string>(length).fill("");

describe("applyOtpEdit", () => {
  it("writes a typed digit and advances", () => {
    const result = applyOtpEdit(empty(), "7", 0);
    expect(result?.digits).toEqual(["7", "", "", "", "", ""]);
    expect(result?.focus).toBe(1);
  });

  it("stays on the last box when typing into it", () => {
    const result = applyOtpEdit(["1", "2", "3", "4", "5", ""], "6", 5);
    expect(result?.digits).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(result?.focus).toBe(5);
  });

  it("strips non-digits before writing", () => {
    const result = applyOtpEdit(empty(), "a4", 2);
    expect(result?.digits).toEqual(["", "", "4", "", "", ""]);
  });

  it("spreads a pasted code forward from the edited box", () => {
    const result = applyOtpEdit(empty(), "12-34 56", 0);
    expect(result?.digits).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(result?.focus).toBe(5);
  });

  it("spreads a paste that starts mid-row and focuses the first remaining gap", () => {
    const result = applyOtpEdit(empty(), "9876", 2);
    expect(result?.digits).toEqual(["", "", "9", "8", "7", "6"]);
    expect(result?.focus).toBe(0);
  });

  it("truncates a paste longer than the remaining boxes", () => {
    const result = applyOtpEdit(empty(4), "123456789", 0);
    expect(result?.digits).toEqual(["1", "2", "3", "4"]);
    expect(result?.focus).toBe(3);
  });

  it("clears only the current box when Backspace hits a filled box", () => {
    const result = applyOtpEdit(["1", "2", "", "", "", ""], "", 1);
    expect(result?.digits).toEqual(["1", "", "", "", "", ""]);
    expect(result?.focus).toBe(1);
  });

  it("steps back and clears the previous box when Backspace hits an empty box", () => {
    const result = applyOtpEdit(["1", "", "", "", "", ""], "", 1);
    expect(result?.digits).toEqual(["", "", "", "", "", ""]);
    expect(result?.focus).toBe(0);
  });

  it("does nothing when Backspace hits the first empty box", () => {
    expect(applyOtpEdit(empty(), "", 0)).toBeNull();
  });

  it("advances focus to the first empty box after a full-row paste", () => {
    const result = applyOtpEdit(["1", "", "", "", "", ""], "234", 1);
    expect(result?.digits).toEqual(["1", "2", "3", "4", "", ""]);
    expect(result?.focus).toBe(4);
  });
});
