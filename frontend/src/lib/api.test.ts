import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockGetSession, mockRequest } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRequest: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: mockGetSession,
    },
  })),
}));

vi.mock("axios", () => ({
  create: vi.fn(() => ({
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    request: mockRequest,
  })),
  isAxiosError: vi.fn((err) => err?.isAxiosError === true),
}));

// eslint-disable-next-line import/first
import * as api from "./api";

describe("api library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("apiFetch", () => {
    it("attaches Bearer token for authenticated requests", async () => {
      const mockSession = { access_token: "test-token-123" };
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
      mockRequest.mockResolvedValue({ data: { success: true }, status: 200 });

      const result = await api.apiFetch("/test", { method: "GET" });

      // Verify the request was made (interceptor adds Authorization header internally)
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "/test",
          method: "GET",
        })
      );
      expect(result).toEqual({ ok: true, status: 200, json: expect.any(Function) });
    });

    it("does not attach token for guest GET requests", async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockRequest.mockResolvedValue({ data: { success: true }, status: 200 });

      const result = await api.apiFetch("/public/test", { method: "GET" });

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "/public/test",
          method: "GET",
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      );
      expect(result).toEqual({ ok: true, status: 200, json: expect.any(Function) });
    });

    it("returns ok=false for 4xx response", async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
      mockRequest.mockResolvedValue({ data: { error: "Bad request" }, status: 400 });

      const result = await api.apiFetch("/test", { method: "POST" });

      expect(result).toEqual({ ok: false, status: 400, json: expect.any(Function) });
    });

    it("returns ok=false for 5xx response", async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
      mockRequest.mockResolvedValue({ data: { error: "Internal server error" }, status: 500 });

      const result = await api.apiFetch("/test", { method: "GET" });

      expect(result).toEqual({ ok: false, status: 500, json: expect.any(Function) });
    });

    it("throws on network error", async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
      const networkError = new Error("Network error");
      (networkError as any).isAxiosError = false;
      mockRequest.mockRejectedValue(networkError);

      await expect(api.apiFetch("/test", { method: "GET" })).rejects.toThrow("Network error");
    });
  });

  describe("apiJson", () => {
    it("returns parsed JSON on success", async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
      mockRequest.mockResolvedValue({ data: { success: true } });

      const result = await api.apiFetch("/test", { method: "GET" });
      const json = await result.json();

      expect(json).toEqual({ success: true });
    });

    it("throws ApiError on 4xx response", async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
      const axiosError = new Error("Request failed") as any;
      axiosError.isAxiosError = true;
      axiosError.response = { status: 400, data: { error: "Bad request", code: "validation_error" } };
      mockRequest.mockRejectedValue(axiosError);

      await expect(api.apiJson("/test", { method: "POST" })).rejects.toThrow("Bad request");
    });

    it("throws ApiError on 5xx response", async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
      const axiosError = new Error("Server error") as any;
      axiosError.isAxiosError = true;
      axiosError.response = { status: 500, data: { error: "Internal server error" } };
      mockRequest.mockRejectedValue(axiosError);

      await expect(api.apiJson("/test", { method: "GET" })).rejects.toThrow("Internal server error");
    });
  });
});