import { describe, it, expect } from "vitest";
import { mentionQueryAt, renderMentions } from "./mentions";

describe("mentions library", () => {
  it("finds the token under the caret", () => {
    expect(mentionQueryAt("hello @mar", 10)).toEqual({ query: "mar", start: 6 });
    expect(mentionQueryAt("hello @mar ", 11)).toBeNull();
    expect(mentionQueryAt("test@example.com", 16)).toBeNull();
    expect(mentionQueryAt("@", 1)).toEqual({ query: "", start: 0 });
    expect(mentionQueryAt("hello @", 7)).toEqual({ query: "", start: 6 });
  });

  it("renders only known mentions as links", () => {
    expect(
      renderMentions("hi @mark @ghost", [{ username: "mark", user_id: "u1" }])
    ).toEqual([
      { text: "hi " },
      { text: "@mark", username: "mark", user_id: "u1" },
      { text: " @ghost" },
    ]);
  });

  it("handles text with no mentions or empty mentions array", () => {
    expect(renderMentions("hello world", [])).toEqual([{ text: "hello world" }]);
    expect(renderMentions("hello world")).toEqual([{ text: "hello world" }]);
  });
});
