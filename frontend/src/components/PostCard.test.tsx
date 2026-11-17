import { describe, it, expect, vi } from "vitest";
import React from "react";
import RichText from "./mentions/RichText";

vi.mock("../contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      primary: "#0E3C9C",
      textPrimary: "#0B1B33",
      textSecondary: "#44516A",
    },
  }),
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("RichText mentions rendering", () => {
  it("renders known mentions as styled segments", () => {
    const element = React.createElement(RichText, {
      text: "Hello @alice and @bob!",
      mentions: [
        { username: "alice", user_id: "u_alice" },
        { username: "bob", user_id: "u_bob" },
      ],
    });
    expect(element).toBeTruthy();
    expect(element.props.text).toBe("Hello @alice and @bob!");
    expect(element.props.mentions).toHaveLength(2);
  });
});
