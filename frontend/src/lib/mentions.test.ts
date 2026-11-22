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

  it("extracts and tokenizes links as clickable URL segments", () => {
    const res = renderMentions("Check https://lccb.edu.ph and www.google.com for updates");
    expect(res).toEqual([
      { text: "Check " },
      { text: "https://lccb.edu.ph", url: "https://lccb.edu.ph" },
      { text: " and " },
      { text: "www.google.com", url: "https://www.google.com" },
      { text: " for updates" },
    ]);
  });

  it("tokenizes both mentions and links in the same text", () => {
    const res = renderMentions(
      "Hey @mark, check out https://github.com/project today!",
      [{ username: "mark", user_id: "u_mark" }]
    );
    expect(res).toEqual([
      { text: "Hey " },
      { text: "@mark", username: "mark", user_id: "u_mark" },
      { text: ", check out " },
      { text: "https://github.com/project", url: "https://github.com/project" },
      { text: " today!" },
    ]);
  });
});
