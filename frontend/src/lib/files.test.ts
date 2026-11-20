import { describe, it, expect } from "vitest";
import { fileKeyFromUrl, fileUrl, resolveFileUrl } from "./files";

describe("files utility", () => {
  it("resolves storage keys to api URLs", () => {
    expect(fileUrl("posts/abc.jpg")).toContain("/api/files/posts/abc.jpg");
    expect(fileUrl("/posts/abc.jpg")).toContain("/api/files/posts/abc.jpg");
    expect(fileUrl("")).toBe("");
  });

  it("resolves file URLs correctly", () => {
    expect(resolveFileUrl("https://example.com/photo.jpg")).toBe("https://example.com/photo.jpg");
    expect(resolveFileUrl("posts/abc.jpg")).toContain("/api/files/posts/abc.jpg");
    expect(resolveFileUrl(null)).toBeNull();
    expect(resolveFileUrl("")).toBeNull();
  });

  it("extracts content-addressed cache keys via fileKeyFromUrl", () => {
    expect(fileKeyFromUrl("http://localhost:3000/api/files/posts/9f83ab24e10c71a39bd5.jpg")).toBe(
      "posts/9f83ab24e10c71a39bd5.jpg"
    );
    expect(fileKeyFromUrl("/api/files/avatars/user-hash.png")).toBe("avatars/user-hash.png");
    expect(fileKeyFromUrl("https://domain.com/api/files/posts/123.jpg?t=456")).toBe("posts/123.jpg");
    expect(fileKeyFromUrl("posts/raw-key.jpg")).toBe("posts/raw-key.jpg");

    // External, local, and arbitrary relative paths should NOT have a storage cache key
    expect(fileKeyFromUrl("ImagePicker/abc.jpg")).toBeUndefined();
    expect(fileKeyFromUrl("DCIM/camera.png")).toBeUndefined();
    expect(fileKeyFromUrl("https://lh3.googleusercontent.com/a/ACg8oc12345")).toBeUndefined();
    expect(fileKeyFromUrl("https://images.unsplash.com/photo-1234")).toBeUndefined();
    expect(fileKeyFromUrl("data:image/png;base64,abc")).toBeUndefined();
    expect(fileKeyFromUrl("file:///data/local/temp.jpg")).toBeUndefined();
    expect(fileKeyFromUrl(null)).toBeUndefined();
    expect(fileKeyFromUrl("")).toBeUndefined();
  });
});
