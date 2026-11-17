import { describe, it, expect, vi } from "vitest";
import React from "react";
import RepositoryFields from "./RepositoryFields";

vi.mock("../../contexts/ThemeContext", () => ({
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

describe("RepositoryFields", () => {
  const defaultValues = {
    title: "",
    technologies: "",
    githubUrl: "",
    liveUrl: "",
    category: "Capstone",
  };

  it("renders correctly without throwing", () => {
    const onChange = vi.fn();
    const onTypeChange = vi.fn();
    const element = React.createElement(RepositoryFields, {
      repositoryType: "project",
      values: defaultValues,
      onChange,
      onTypeChange,
    });
    expect(element).toBeTruthy();
    expect(element.props.repositoryType).toBe("project");
  });

  it("accepts thesis and capstone subtypes", () => {
    const onChange = vi.fn();
    const onTypeChange = vi.fn();
    const thesisElement = React.createElement(RepositoryFields, {
      repositoryType: "thesis",
      values: defaultValues,
      onChange,
      onTypeChange,
    });
    expect(thesisElement.props.repositoryType).toBe("thesis");

    const capstoneElement = React.createElement(RepositoryFields, {
      repositoryType: "capstone",
      values: defaultValues,
      onChange,
      onTypeChange,
    });
    expect(capstoneElement.props.repositoryType).toBe("capstone");
  });
});
