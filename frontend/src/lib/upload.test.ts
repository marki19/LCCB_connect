import { describe, it, expect } from "vitest";
import { extensionForMime } from "./upload";

describe("extensionForMime", () => {
  it("maps every allowed document mime to its extension", () => {
    expect(extensionForMime("application/pdf")).toBe(".pdf");
    expect(extensionForMime("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(".docx");
    expect(extensionForMime("application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe(".pptx");
    expect(extensionForMime("application/msword")).toBe(".doc");
    expect(extensionForMime("application/vnd.ms-powerpoint")).toBe(".ppt");
  });

  it("maps image and video mimes correctly", () => {
    expect(extensionForMime("image/png")).toBe(".png");
    expect(extensionForMime("image/jpeg")).toBe(".jpg");
    expect(extensionForMime("image/webp")).toBe(".webp");
    expect(extensionForMime("video/mp4")).toBe(".mp4");
    expect(extensionForMime("video/webm")).toBe(".webm");
  });
});
