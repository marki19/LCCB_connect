import { describe, it, expect } from "vitest";
import { extractFirstUrl, normalizeWebsiteUrl } from "./linkPreview";

describe("linkPreview helpers", () => {
  describe("extractFirstUrl", () => {
    it("extracts full https and http URLs", () => {
      expect(extractFirstUrl("https://lccb-connect.vercel.app")).toBe("https://lccb-connect.vercel.app");
      expect(extractFirstUrl("Check this out: http://example.com/project")).toBe("http://example.com/project");
    });

    it("extracts domain without protocol", () => {
      expect(extractFirstUrl("lccb-connect.vercel.app")).toBe("lccb-connect.vercel.app");
      expect(extractFirstUrl("visit github.com/facebook/react today")).toBe("github.com/facebook/react");
    });

    it("ignores email addresses", () => {
      expect(extractFirstUrl("contact us at student@lcc.edu.ph")).toBeNull();
      expect(extractFirstUrl("test@example.com")).toBeNull();
    });

    it("ignores plain filenames with document/image extensions", () => {
      expect(extractFirstUrl("document.pdf")).toBeNull();
      expect(extractFirstUrl("photo.png")).toBeNull();
      expect(extractFirstUrl("file.txt")).toBeNull();
    });

    it("returns null for plain text without links", () => {
      expect(extractFirstUrl("Hello campus community!")).toBeNull();
      expect(extractFirstUrl("")).toBeNull();
      expect(extractFirstUrl(null)).toBeNull();
    });
  });

  describe("normalizeWebsiteUrl", () => {
    it("prefixes https:// to naked domains", () => {
      expect(normalizeWebsiteUrl("lccb-connect.vercel.app")).toBe("https://lccb-connect.vercel.app");
    });

    it("preserves existing http/https protocols", () => {
      expect(normalizeWebsiteUrl("http://localhost:3000")).toBe("http://localhost:3000");
      expect(normalizeWebsiteUrl("https://example.com")).toBe("https://example.com");
    });

    it("handles empty and whitespace", () => {
      expect(normalizeWebsiteUrl("   ")).toBe("");
      expect(normalizeWebsiteUrl("")).toBe("");
    });
  });
});
