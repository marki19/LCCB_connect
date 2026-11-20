import { describe, it, expect, vi } from "vitest";
import React from "react";
import AttachmentStrip from "./AttachmentStrip";

vi.mock("../contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      action: "#0284C7",
      actionSurface: "#E0F2FE",
      surfaceSunken: "#1E293B",
      border: "#334155",
      textPrimary: "#F8FAFC",
      textSecondary: "#94A3B8",
      textTertiary: "#64748B",
    },
  }),
}));

describe("AttachmentStrip", () => {
  it("renders a chip per document attachment", () => {
    const element = React.createElement(AttachmentStrip, {
      attachments: [
        {
          storage_key: "documents/a.pdf",
          file_name: "thesis.pdf",
          mime_type: "application/pdf",
          size_bytes: 1024,
        },
      ],
    });
    expect(element).toBeTruthy();
    expect(element.props.attachments).toHaveLength(1);
    expect(element.props.attachments?.[0]?.file_name).toBe("thesis.pdf");
  });

  it("handles null or empty attachments gracefully", () => {
    const elementNull = React.createElement(AttachmentStrip, { attachments: null });
    expect(elementNull).toBeTruthy();

    const elementEmpty = React.createElement(AttachmentStrip, { attachments: [] });
    expect(elementEmpty).toBeTruthy();
  });
});
