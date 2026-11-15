import { describe, it, expect, vi, beforeEach } from "vitest";

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

const { mockApiJson, mockSetSession } = vi.hoisted(() => ({
  mockApiJson: vi.fn(),
  mockSetSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
}));

vi.mock("./api", () => ({
  apiJson: mockApiJson,
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      setSession: mockSetSession,
    },
  },
}));

// eslint-disable-next-line import/first
import * as auth from "./auth";

describe("auth library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signInWithIdentifier", () => {
    it("signs in with email and password", async () => {
      const mockTokens = { access_token: "test-token", refresh_token: "refresh-token" };
      mockApiJson.mockResolvedValue(mockTokens);

      await auth.signInWithIdentifier("test@lccbonline.edu.ph", "password123");

      expect(mockApiJson).toHaveBeenCalledWith("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier: "test@lccbonline.edu.ph", password: "password123" }),
      });
    });

    it("signs in with student ID", async () => {
      const mockTokens = { access_token: "test-token", refresh_token: "refresh-token" };
      mockApiJson.mockResolvedValue(mockTokens);

      await auth.signInWithIdentifier("2023-12345", "password123");

      expect(mockApiJson).toHaveBeenCalledWith("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier: "2023-12345", password: "password123" }),
      });
    });

    it("signs in with username", async () => {
      const mockTokens = { access_token: "test-token", refresh_token: "refresh-token" };
      mockApiJson.mockResolvedValue(mockTokens);

      await auth.signInWithIdentifier("johndoe", "password123");

      expect(mockApiJson).toHaveBeenCalledWith("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier: "johndoe", password: "password123" }),
      });
    });

    it("throws on invalid credentials", async () => {
      mockApiJson.mockRejectedValue(new ApiError("Invalid login credentials", 401));

      await expect(auth.signInWithIdentifier("test@lccbonline.edu.ph", "wrong")).rejects.toThrow(
        "Invalid login credentials"
      );
    });

    it("throws on network error", async () => {
      mockApiJson.mockRejectedValue(new Error("Network error"));

      await expect(auth.signInWithIdentifier("test@lccbonline.edu.ph", "password123")).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("verifySignupCode", () => {
    it("sends the code with the password and installs the session", async () => {
      const mockTokens = { access_token: "test-token", refresh_token: "refresh-token" };
      mockApiJson.mockResolvedValue(mockTokens);

      await auth.verifySignupCode("Test@lccbonline.edu.ph", "123456", "password123");

      expect(mockApiJson).toHaveBeenCalledWith("/auth/verify-signup", {
        method: "POST",
        body: JSON.stringify({
          email: "test@lccbonline.edu.ph",
          token: "123456",
          password: "password123",
        }),
      });
      expect(mockSetSession).toHaveBeenCalledWith({
        access_token: "test-token",
        refresh_token: "refresh-token",
      });
    });
  });

  describe("requestSignup", () => {
    it("posts the trimmed signup fields", async () => {
      mockApiJson.mockResolvedValue({ message: "sent" });

      await auth.requestSignup("Test@lccbonline.edu.ph", "password123", "  Ana Cruz  ");

      expect(mockApiJson).toHaveBeenCalledWith("/auth/request-signup", {
        method: "POST",
        body: JSON.stringify({
          email: "test@lccbonline.edu.ph",
          password: "password123",
          full_name: "Ana Cruz",
        }),
      });
    });
  });

  describe("signInWithGoogle", () => {
    it("signs in with Google ID token", async () => {
      const mockTokens = { access_token: "test-token", refresh_token: "refresh-token" };
      mockApiJson.mockResolvedValue(mockTokens);

      await auth.signInWithGoogle("google-id-token-123");

      expect(mockApiJson).toHaveBeenCalledWith("/auth/google", {
        method: "POST",
        body: JSON.stringify({ id_token: "google-id-token-123" }),
      });
    });

    it("throws on Google sign-in failure", async () => {
      mockApiJson.mockRejectedValue(new ApiError("Google sign-in failed", 401));

      await expect(auth.signInWithGoogle("invalid-token")).rejects.toThrow("Google sign-in failed");
    });
  });
});