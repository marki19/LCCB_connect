/**
 * LCCB Connect Brand Design System
 * Exclusively based on the official seal of La Consolacion College Bacolod (Est. 1919)
 */

export const LCCB_THEME = {
  // Primary Institutional Blue (from the circular field & ring)
  primary: {
    main: "#0038A8",     // Rich academic sapphire/royal blue
    dark: "#0A2558",     // Deep navy for headers & dark surfaces
    deep: "#061838",     // Midnight navy
    light: "#1E5CD6",    // Interactive & hover state
    subtle: "#EBF3FC",   // Very soft blue tint for active chips & containers
    border: "#CBE0F8",   // Blue outline & border tint
  },

  // Accent Red (from the sacred heart)
  accent: {
    main: "#E52521",     // Vivid heart red for Call-To-Action (CTA) buttons & alerts
    hover: "#C81E1A",    // Pressed/hover red
    light: "#FEF2F2",    // Subtle red background for alert pills
    border: "#FECACA",   // Subtle red border
  },

  // Secondary Gold / Yellow (from the ribbon banner, open book, and flame)
  secondary: {
    main: "#F5B700",     // Warm ribbon gold/yellow
    amber: "#B45309",    // Dark amber for legible typography on light gold
    light: "#FEF9C3",    // Subtle gold tint for featured badges
    border: "#FDE68A",   // Golden accent border
  },

  // Neutrals & Surfaces (derived from clean logo tints & whites)
  neutral: {
    background: "#F4F7FB", // Light blue-grey foundation
    surface: "#FFFFFF",    // Crisp white card surface
    surfaceAlt: "#F8FAFD", // Slightly elevated surface
    cardBorder: "#E2E8F0", // Slate border
    cardBorderBlue: "#DBEAFE", // Blue-tinted card border
    textPrimary: "#0F172A", // Deep slate primary text
    textSecondary: "#475569", // Supporting text
    textMuted: "#94A3B8",   // Subtle text & icons
  },
} as const;

export default LCCB_THEME;
