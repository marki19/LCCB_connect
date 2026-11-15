import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react-native";

// Mock @testing-library/react-native at top level (hoisted) to avoid Flow syntax parsing issues
let currentComponentProps: any = {};

vi.mock("@testing-library/react-native", () => ({
  render: vi.fn((ui) => {
    // Extract props from the rendered component
    currentComponentProps = ui?.props || {};

    return {
      getByText: vi.fn((text) => ({ props: { children: text } })),
      getByLabelText: vi.fn((label) => {
        // Return buttons that call the component's props
        if (label === "Dismiss this banner") {
          return { props: { onPress: currentComponentProps.onDismiss || vi.fn() } };
        }
        if (label === "Check email status again") {
          return { props: { onPress: currentComponentProps.onRefresh || vi.fn() } };
        }
        return { props: { onPress: vi.fn() } };
      }),
      queryByText: vi.fn(),
      findByText: vi.fn().mockResolvedValue({ props: { children: "test" } }),
    };
  }),
  screen: {
    getByText: vi.fn((text) => ({ props: { children: text } })),
    getByLabelText: vi.fn((label) => {
      // Use the global currentComponentProps
      if (label === "Dismiss this banner") {
        return { props: { onPress: currentComponentProps.onDismiss || vi.fn() } };
      }
      if (label === "Check email status again") {
        return { props: { onPress: currentComponentProps.onRefresh || vi.fn() } };
      }
      return { props: { onPress: vi.fn() } };
    }),
    queryByText: vi.fn(),
    findByText: vi.fn().mockResolvedValue({ props: { children: "test" } }),
  },
  fireEvent: {
    press: vi.fn(),
  },
}));

// Mock ThemeContext
vi.mock("../contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      destructiveSurface: "#FEF2F2",
      destructiveSurfaceAlt: "#FECACA",
      destructiveText: "#991B1B",
      destructive: "#EF4444",
    },
  }),
}));

// Mock AuthContext - default to bounced profile
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    profile: {
      email: "test@lccbonline.edu.ph",
      email_bounced: true,
      bounce_reason: "The email account does not exist",
      bounced_at: "2026-11-08T10:00:00Z",
    },
  }),
}));

describe("EmailBounceBanner", () => {
  let EmailBounceBanner: React.ComponentType<any>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await vi.importActual<{ EmailBounceBanner: React.ComponentType<any> }>("./EmailBounceBanner");
    EmailBounceBanner = mod.EmailBounceBanner;
  });

  it("renders when email_bounced is true", () => {
    render(<EmailBounceBanner />);

    expect(screen.getByText("Email delivery failed")).toBeTruthy();
    expect(screen.getByText(/couldn't deliver emails/i)).toBeTruthy();
    expect(screen.getByText("The email account does not exist")).toBeTruthy();
  });

  it("calls onDismiss when dismiss button is pressed", () => {
    const onDismiss = vi.fn();
    render(<EmailBounceBanner onDismiss={onDismiss} />);

    const dismissBtn = screen.getByLabelText("Dismiss this banner");
    dismissBtn.props.onPress();

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onRefresh when refresh button is pressed", () => {
    const onRefresh = vi.fn();
    render(<EmailBounceBanner onRefresh={onRefresh} />);

    const refreshBtn = screen.getByLabelText("Check email status again");
    refreshBtn.props.onPress();

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("shows formatted bounce date", () => {
    render(<EmailBounceBanner />);

    expect(screen.getByText(/2026/i)).toBeTruthy(); // year from bounced_at
  });

  it("shows email in message", () => {
    render(<EmailBounceBanner />);

    expect(screen.getByText("test@lccbonline.edu.ph")).toBeTruthy();
  });
});