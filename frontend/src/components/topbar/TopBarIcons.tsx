/**
 * TopBarIcons — Custom crafted SVG icons for DesktopTopBar center navigation.
 * Designed to match Facebook's desktop tab bar style:
 * Outlined when inactive, solid filled when active.
 */

import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

export interface NavIconProps {
  size?: number;
  color?: string;
  active?: boolean;
}

/**
 * Home Nav Icon — Facebook-style house icon.
 */
export function HomeNavIcon({
  size = 24,
  color = "currentColor",
  active = false,
}: NavIconProps) {
  if (active) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 2.2L1.8 10.7a1 1 0 0 0 .65 1.76H4v8a1.5 1.5 0 0 0 1.5 1.5h3.5a1 1 0 0 0 1-1v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5a1 1 0 0 0 1 1h3.5a1.5 1.5 0 0 0 1.5-1.5v-8h1.55a1 1 0 0 0 .65-1.76L12 2.2z"
          fill={color}
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10.8L12 3.3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 14 20v-5a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v5a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 3 20v-9.2z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Repository Nav Icon — Open academic archive & thesis manuscript book.
 */
export function RepositoryNavIcon({
  size = 24,
  color = "currentColor",
  active = false,
}: NavIconProps) {
  if (active) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M2.5 4.5A2 2 0 0 1 4.5 2.5H10a2 2 0 0 1 2 2v14.2a1.5 1.5 0 0 0-1.5-1.5H4.5A2 2 0 0 0 2.5 19.2V4.5zm19 0a2 2 0 0 0-2-2H14a2 2 0 0 0-2 2v14.2a1.5 1.5 0 0 1 1.5-1.5h5a2 2 0 0 1 2 2V4.5z"
          fill={color}
        />
        <Path
          d="M10.5 19.5H4.5A2.5 2.5 0 0 0 2 22h10v-2.5h-1.5zm3 0h6a2.5 2.5 0 0 1 2.5 2.5H12V19.5h1.5z"
          fill={color}
          opacity={0.8}
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 4.5A2.5 2.5 0 0 1 4.5 2H11v17H4.5A2.5 2.5 0 0 0 2 21.5V4.5zM22 4.5A2.5 2.5 0 0 0 19.5 2H13v17h6.5a2.5 2.5 0 0 1 2.5 2.5V4.5z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Capstones Nav Icon — Academic mortarboard cap with hanging tassel.
 */
export function CapstonesNavIcon({
  size = 24,
  color = "currentColor",
  active = false,
}: NavIconProps) {
  if (active) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {/* Diamond top */}
        <Path
          d="M12 2.8L1 8.8l11 6 8.8-4.8V17a1 1 0 0 0 2 0V9.8a1 1 0 0 0-.47-.85L12 2.8z"
          fill={color}
        />
        {/* Cap skull & band */}
        <Path
          d="M5 13.2v3.6c0 2.2 3.13 4.2 7 4.2s7-2 7-4.2v-3.6l-7 3.8-7-3.8z"
          fill={color}
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3L1 9l11 6 9-4.9V17h2V9L12 3z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M5 13.2v3.8c0 2.2 3.13 4 7 4s7-1.8 7-4v-3.8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Discussions Nav Icon — Community conversation and dialogue bubbles.
 */
export function DiscussionsNavIcon({
  size = 24,
  color = "currentColor",
  active = false,
}: NavIconProps) {
  if (active) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {/* Primary dialogue bubble */}
        <Path
          d="M14 3H5a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h1v3.5l4.2-3.5H14a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"
          fill={color}
        />
        {/* Secondary dialogue bubble */}
        <Path
          d="M18.5 8.5H18v4.5a3.5 3.5 0 0 1-3.5 3.5h-4.3l-.2.15 3.2 2.65V21h3.8a2.5 2.5 0 0 0 2.5-2.5v-1.2h.5a2.5 2.5 0 0 0 2.5-2.5V11a2.5 2.5 0 0 0-2.5-2.5z"
          fill={color}
          opacity={0.75}
        />
        {/* Internal dots in primary bubble */}
        <Circle cx="6.5" cy="9.5" r="1.1" fill="#FFFFFF" />
        <Circle cx="9.5" cy="9.5" r="1.1" fill="#FFFFFF" />
        <Circle cx="12.5" cy="9.5" r="1.1" fill="#FFFFFF" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 4H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1v3.5l4-3.5h4a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M18 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3.5-3H13"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

