import { describe, it, expect } from "vitest";
import { matchesFeedFilter } from "./feedFilters";

describe("matchesFeedFilter", () => {
  it("maps feed filters to kind and repository_type", () => {
    expect(matchesFeedFilter({ kind: "repository", repository_type: "project" }, "projects")).toBe(true);
    expect(matchesFeedFilter({ kind: "repository", repository_type: "thesis" }, "projects")).toBe(false);
    expect(matchesFeedFilter({ kind: "discussion" }, "discussions")).toBe(true);
  });

  it("handles theses and capstones filters", () => {
    expect(matchesFeedFilter({ kind: "repository", repository_type: "thesis" }, "theses")).toBe(true);
    expect(matchesFeedFilter({ kind: "repository", repository_type: "capstone" }, "projects")).toBe(true);
    expect(matchesFeedFilter({ type: "thesis" }, "theses")).toBe(true);
  });

  it("handles all filter", () => {
    expect(matchesFeedFilter({ kind: "repository" }, "all")).toBe(true);
    expect(matchesFeedFilter({ kind: "discussion" }, "all")).toBe(true);
  });

  it("excludes repository items from discussions filter", () => {
    expect(matchesFeedFilter({ kind: "repository", repository_type: "project" }, "discussions")).toBe(false);
  });
});
