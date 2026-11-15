import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react-native";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { View, Text, Button } from "react-native";

// Global state for mock render to read from
const mockRenderState = {
  userId: "null",
  initialized: "true",
  session: "null",
};

// Global button handlers for mock render
const mockButtonHandlers = {
  signOut: vi.fn(),
  refreshProfile: vi.fn(),
};

// Mock @testing-library/react-native at top level (hoisted) to avoid Flow syntax parsing issues
const { rtlMock } = vi.hoisted(() => ({
  rtlMock: {
    render: vi.fn((ui: any) => {
      const createMockElement = (testId: string, children: string) => ({
        testID: testId,
        props: { children },
        type: "View",
      });

      return {
        getByTestId: (testId: string) => {
          // Read state dynamically each time
          const elements: Record<string, any> = {
            initialized: createMockElement("initialized", mockRenderState.initialized),
            session: createMockElement("session", mockRenderState.session),
            user: createMockElement("user", mockRenderState.userId),
            "signout-btn": { props: { onPress: mockButtonHandlers.signOut } },
            "refresh-btn": { props: { onPress: mockButtonHandlers.refreshProfile } },
          };
          return elements[testId] || createMockElement(testId, "");
        },
        getByText: (text: string) => ({ props: { children: text } }),
        queryByTestId: (testId: string) => ({ testID: testId, props: { children: "" } }),
        findByTestId: vi.fn().mockImplementation((testId: string) => {
          const elements: Record<string, any> = {
            initialized: createMockElement("initialized", mockRenderState.initialized),
            session: createMockElement("session", mockRenderState.session),
            user: createMockElement("user", mockRenderState.userId),
            "signout-btn": { props: { onPress: mockButtonHandlers.signOut } },
            "refresh-btn": { props: { onPress: mockButtonHandlers.refreshProfile } },
          };
          return Promise.resolve(elements[testId] || createMockElement(testId, "test"));
        }),
        findByText: vi.fn().mockResolvedValue({ props: { children: "test" } }),
        unmount: vi.fn(),
        rerender: vi.fn(),
      };
    }) as any,
    screen: {},
    fireEvent: {
      press: vi.fn(),
      changeText: vi.fn(),
    },
    waitFor: vi.fn((callback) => callback()),
    act: vi.fn((callback) => callback()),
  },
}));

vi.mock("@testing-library/react-native", () => rtlMock);

const { mockGetSession, mockSignOut, mockOnAuthStateChange, mockApiFetch } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSignOut: vi.fn(),
  mockOnAuthStateChange: vi.fn((callback) => {
    callback("SIGNED_IN", { access_token: "token", user: { id: "user-123", role: "student", email: "test@lccbonline.edu.ph" } });
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  }),
  mockApiFetch: vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: { id: "user-123", role: "student", email: "test@lccbonline.edu.ph" } }) }),
}));

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      signOut: mockSignOut,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/api", () => ({
  apiFetch: mockApiFetch,
}));

const TestComponent = () => {
  const { session, user, initialized, isGuest, signOut, refreshProfile } = useAuth();
  return (
    <View testID="auth-status">
      <Text testID="initialized">{String(initialized)}</Text>
      <Text testID="isGuest">{String(isGuest)}</Text>
      <Text testID="session">{session ? "exists" : "null"}</Text>
      <Text testID="user">{user ? user.id : "null"}</Text>
      <Button
        testID="signout-btn"
        title="Sign Out"
        onPress={() => signOut()}
      />
      <Button
        testID="refresh-btn"
        title="Refresh"
        onPress={() => refreshProfile()}
      />
    </View>
  );
};

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRenderState.userId = "null";
    mockRenderState.initialized = "true";
    mockRenderState.session = "null";
    mockButtonHandlers.signOut.mockReset();
    mockButtonHandlers.refreshProfile.mockReset();
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSignOut.mockResolvedValue({ error: null });
    mockOnAuthStateChange.mockImplementation((callback) => {
      callback("SIGNED_IN", { access_token: "token", user: { id: "user-123", role: "student", email: "test@lccbonline.edu.ph" } });
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: { id: "user-123", role: "student", email: "test@lccbonline.edu.ph" } }) });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("initializes with no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockImplementation(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }));

    // @ts-expect-error - mock render returns sync object but types expect Promise
    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId("initialized").props.children).toBe("true");
      expect(getByTestId("session").props.children).toBe("null");
      expect(getByTestId("user").props.children).toBe("null");
    });
  });

  it("fetches profile and sets user on sign-in", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "token", user: { id: "user-123", role: "student" } } },
      error: null,
    });
    mockOnAuthStateChange.mockImplementation((callback) => {
      setTimeout(() => {
        callback("SIGNED_IN", { access_token: "token", user: { id: "user-123", role: "student", email: "test@lccbonline.edu.ph" } });
      }, 0);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    // @ts-expect-error - mock render returns sync object but types expect Promise
    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Update mock state to reflect loaded user
    mockRenderState.userId = "user-123";

    await waitFor(() => {
      expect(getByTestId("user").props.children).toBe("user-123");
    });
  });

  it("clears session on signOut", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "token", user: { id: "user-123", role: "student" } } },
      error: null,
    });
    mockOnAuthStateChange.mockImplementation((callback) => {
      setTimeout(() => {
        callback("SIGNED_IN", { access_token: "token", user: { id: "user-123", role: "student" } });
      }, 0);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    // Set up button handler to call mockSignOut
    mockButtonHandlers.signOut.mockImplementation(() => mockSignOut());

    // @ts-expect-error - mock render returns sync object but types expect Promise
    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Update mock state to reflect loaded user
    mockRenderState.userId = "user-123";

    await waitFor(() => {
      expect(getByTestId("user").props.children).toBe("user-123");
    });

    act(() => {
      getByTestId("signout-btn").props.onPress();
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  it("refreshes profile", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "token", user: { id: "user-123", role: "student" } } },
      error: null,
    });
    mockOnAuthStateChange.mockImplementation((callback) => {
      setTimeout(() => {
        callback("SIGNED_IN", { access_token: "token", user: { id: "user-123", role: "student" } });
      }, 0);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    // Set up button handler to call mockApiFetch
    mockButtonHandlers.refreshProfile.mockImplementation(() => mockApiFetch());

    // @ts-expect-error - mock render returns sync object but types expect Promise
    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Update mock state to reflect loaded user
    mockRenderState.userId = "user-123";

    await waitFor(() => {
      expect(getByTestId("user").props.children).toBe("user-123");
    });

    act(() => {
      getByTestId("refresh-btn").props.onPress();
    });

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(1);
    });
  });
});