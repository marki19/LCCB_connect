/**
 * Popover positioning utility
 * Calculates optimal position for popovers/dropdowns based on anchor and viewport
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useWindowDimensions, Platform } from "react-native";

export type PopoverPosition = 
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-start"
  | "top-end"
  | "bottom-start"
  | "bottom-end"
  | "left-start"
  | "left-end"
  | "right-start"
  | "right-end";

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportRect {
  width: number;
  height: number;
}

export interface PopoverSize {
  width: number;
  height: number;
}

export interface PositionResult {
  top: number;
  left: number;
  /** Arrow position for tooltips/dropdowns with arrows */
  arrowPosition?: "top" | "bottom" | "left" | "right";
  /** Arrow offset from edge */
  arrowOffset?: number;
  /** Actual position used (may differ from preferred) */
  actualPosition: PopoverPosition;
}

/**
 * Default padding from viewport edges
 */
const VIEWPORT_PADDING = 12;

/**
 * Gap between anchor and popover
 */
const ANCHOR_GAP = 8;

/**
 * Calculate the best position for a popover
 */
export function calculatePopoverPosition(
  anchor: AnchorRect,
  popoverSize: PopoverSize,
  viewport: ViewportRect,
  preferredPosition: PopoverPosition = "bottom-start",
  padding = VIEWPORT_PADDING
): PositionResult {
  const { width: popoverWidth, height: popoverHeight } = popoverSize;
  const { width: viewportWidth, height: viewportHeight } = viewport;

  // All possible positions with their coordinate calculations
  const positions: Record<PopoverPosition, { top: number; left: number; arrowPosition: PositionResult["arrowPosition"]; arrowOffset: number }> = {
    // Bottom positions (anchor above popover)
    "bottom-start": {
      top: anchor.y + anchor.height + ANCHOR_GAP,
      left: anchor.x,
      arrowPosition: "top",
      arrowOffset: Math.min(anchor.width / 2, 16),
    },
    "bottom-end": {
      top: anchor.y + anchor.height + ANCHOR_GAP,
      left: anchor.x + anchor.width - popoverWidth,
      arrowPosition: "top",
      arrowOffset: popoverWidth - Math.min(anchor.width / 2, 16),
    },
    "bottom": {
      top: anchor.y + anchor.height + ANCHOR_GAP,
      left: anchor.x + anchor.width / 2 - popoverWidth / 2,
      arrowPosition: "top",
      arrowOffset: popoverWidth / 2,
    },

    // Top positions (anchor below popover)
    "top-start": {
      top: anchor.y - popoverHeight - ANCHOR_GAP,
      left: anchor.x,
      arrowPosition: "bottom",
      arrowOffset: Math.min(anchor.width / 2, 16),
    },
    "top-end": {
      top: anchor.y - popoverHeight - ANCHOR_GAP,
      left: anchor.x + anchor.width - popoverWidth,
      arrowPosition: "bottom",
      arrowOffset: popoverWidth - Math.min(anchor.width / 2, 16),
    },
    "top": {
      top: anchor.y - popoverHeight - ANCHOR_GAP,
      left: anchor.x + anchor.width / 2 - popoverWidth / 2,
      arrowPosition: "bottom",
      arrowOffset: popoverWidth / 2,
    },

    // Right positions (anchor left of popover)
    "right-start": {
      top: anchor.y,
      left: anchor.x + anchor.width + ANCHOR_GAP,
      arrowPosition: "left",
      arrowOffset: Math.min(anchor.height / 2, 16),
    },
    "right-end": {
      top: anchor.y + anchor.height - popoverHeight,
      left: anchor.x + anchor.width + ANCHOR_GAP,
      arrowPosition: "left",
      arrowOffset: popoverHeight - Math.min(anchor.height / 2, 16),
    },
    "right": {
      top: anchor.y + anchor.height / 2 - popoverHeight / 2,
      left: anchor.x + anchor.width + ANCHOR_GAP,
      arrowPosition: "left",
      arrowOffset: popoverHeight / 2,
    },

    // Left positions (anchor right of popover)
    "left-start": {
      top: anchor.y,
      left: anchor.x - popoverWidth - ANCHOR_GAP,
      arrowPosition: "right",
      arrowOffset: Math.min(anchor.height / 2, 16),
    },
    "left-end": {
      top: anchor.y + anchor.height - popoverHeight,
      left: anchor.x - popoverWidth - ANCHOR_GAP,
      arrowPosition: "right",
      arrowOffset: popoverHeight - Math.min(anchor.height / 2, 16),
    },
    "left": {
      top: anchor.y + anchor.height / 2 - popoverHeight / 2,
      left: anchor.x - popoverWidth - ANCHOR_GAP,
      arrowPosition: "right",
      arrowOffset: popoverHeight / 2,
    },
  };

  // Check if a position fits within viewport
  const fits = (pos: typeof positions[PopoverPosition]): boolean => {
    return (
      pos.left >= padding &&
      pos.left + popoverWidth <= viewportWidth - padding &&
      pos.top >= padding &&
      pos.top + popoverHeight <= viewportHeight - padding
    );
  };

  // Try preferred position first
  if (positions[preferredPosition] && fits(positions[preferredPosition])) {
    const pos = positions[preferredPosition];
    return {
      top: pos.top,
      left: pos.left,
      arrowPosition: pos.arrowPosition,
      arrowOffset: pos.arrowOffset,
      actualPosition: preferredPosition,
    };
  }

  // Priority order for fallback positions based on preferred
  const fallbackOrder: PopoverPosition[] = getFallbackOrder(preferredPosition);

  for (const fallback of fallbackOrder) {
    if (positions[fallback] && fits(positions[fallback])) {
      const pos = positions[fallback];
      return {
        top: pos.top,
        left: pos.left,
        arrowPosition: pos.arrowPosition,
        arrowOffset: pos.arrowOffset,
        actualPosition: fallback,
      };
    }
  }

  // If nothing fits, use preferred but clamp to viewport
  const pos = positions[preferredPosition];
  const clampedTop = Math.max(padding, Math.min(pos.top, viewportHeight - popoverHeight - padding));
  const clampedLeft = Math.max(padding, Math.min(pos.left, viewportWidth - popoverWidth - padding));

  return {
    top: clampedTop,
    left: clampedLeft,
    arrowPosition: pos.arrowPosition,
    arrowOffset: pos.arrowOffset,
    actualPosition: preferredPosition,
  };
}

/**
 * Get fallback position order based on preferred position
 */
function getFallbackOrder(preferred: PopoverPosition): PopoverPosition[] {
  const vertical = preferred.startsWith("top") || preferred.startsWith("bottom");
  const horizontal = preferred.startsWith("left") || preferred.startsWith("right");
  const start = preferred.endsWith("-start");
  const end = preferred.endsWith("-end");
  const center = !start && !end && (preferred === "top" || preferred === "bottom" || preferred === "left" || preferred === "right");

  if (vertical) {
    // Prefer opposite vertical, then same horizontal alignment
    const oppositeVertical = preferred.startsWith("top") ? "bottom" : "top";
    const sameHorizontal = start ? "-start" : end ? "-end" : "";
    
    const base = `${oppositeVertical}${sameHorizontal}`;
    const centerBase = `${oppositeVertical}${center ? "" : sameHorizontal}`;
    
    const order: PopoverPosition[] = [];
    if (positionsList.includes(base)) order.push(base as PopoverPosition);
    if (positionsList.includes(centerBase)) order.push(centerBase as PopoverPosition);
    
    // Then try horizontal positions
    if (start) {
      order.push("right-start", "left-start");
    } else if (end) {
      order.push("right-end", "left-end");
    } else {
      order.push("right", "left");
    }
    
    // Then same vertical opposite horizontal
    const sameVerticalOpposite = preferred.startsWith("top") 
      ? (start ? "top-end" : end ? "top-start" : "top")
      : (start ? "bottom-end" : end ? "bottom-start" : "bottom");
    if (positionsList.includes(sameVerticalOpposite)) order.push(sameVerticalOpposite as PopoverPosition);
    
    return order;
  } else {
    // Horizontal preferred - try opposite horizontal first
    const oppositeHorizontal = preferred.startsWith("left") ? "right" : "left";
    const sameVertical = start ? "-start" : end ? "-end" : "";
    
    const base = `${oppositeHorizontal}${sameVertical}`;
    const centerBase = `${oppositeHorizontal}${center ? "" : sameVertical}`;
    
    const order: PopoverPosition[] = [];
    if (positionsList.includes(base)) order.push(base as PopoverPosition);
    if (positionsList.includes(centerBase)) order.push(centerBase as PopoverPosition);
    
    // Then try vertical positions
    if (start) {
      order.push("bottom-start", "top-start");
    } else if (end) {
      order.push("bottom-end", "top-end");
    } else {
      order.push("bottom", "top");
    }
    
    // Then same horizontal opposite vertical
    const sameHorizontalOpposite = preferred.startsWith("left")
      ? (start ? "right-start" : end ? "right-end" : "right")
      : (start ? "left-start" : end ? "left-end" : "left");
    if (positionsList.includes(sameHorizontalOpposite)) order.push(sameHorizontalOpposite as PopoverPosition);
    
    return order;
  }
}

const positionsList: string[] = [
  "top", "bottom", "left", "right",
  "top-start", "top-end", "bottom-start", "bottom-end",
  "left-start", "left-end", "right-start", "right-end",
];

/**
 * Hook for React Native to measure anchor and calculate position
 */
export interface UsePopoverPositionOptions {
  preferredPosition?: PopoverPosition;
  popoverWidth: number;
  popoverHeight: number;
  enabled?: boolean;
}

export interface UsePopoverPositionResult {
  position: { top: number; left: number } | null;
  arrowPosition?: "top" | "bottom" | "left" | "right";
  arrowOffset?: number;
  anchorRef: React.RefObject<any>;
  updatePosition: () => void;
}

export function usePopoverPosition(
  options: UsePopoverPositionOptions,
  externalAnchorRef?: React.RefObject<any>
): UsePopoverPositionResult {
  const { preferredPosition = "bottom-start", popoverWidth, popoverHeight, enabled = true } = options;
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const internalAnchorRef = useRef<any>(null);
  const anchorRef = externalAnchorRef ?? internalAnchorRef;
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [arrowPosition, setArrowPosition] = useState<"top" | "bottom" | "left" | "right">();
  const [arrowOffset, setArrowOffset] = useState<number>();

  const updatePosition = useCallback(() => {
    if (!enabled || !anchorRef.current) return;

    const measureAnchor = (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
      const anchor: AnchorRect = {
        x: pageX,
        y: pageY,
        width,
        height,
      };

      const result = calculatePopoverPosition(
        anchor,
        { width: popoverWidth, height: popoverHeight },
        { width: viewportWidth, height: viewportHeight },
        preferredPosition
      );

      setPosition({ top: result.top, left: result.left });
      setArrowPosition(result.arrowPosition);
      setArrowOffset(result.arrowOffset);
    };

    const node = anchorRef.current as any;
    if (!node) return;

    // Web: use getBoundingClientRect for accurate page coordinates.
    if (Platform.OS === "web" && typeof node.getBoundingClientRect === "function") {
      const rect = node.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      measureAnchor(rect.left, rect.top, rect.width, rect.height, rect.left + scrollX, rect.top + scrollY);
      return;
    }

    // Native: measure callback
    node.measure?.(measureAnchor);
  }, [enabled, popoverWidth, popoverHeight, viewportWidth, viewportHeight, preferredPosition]);

  // Update on viewport change
  useEffect(() => {
    if (enabled) {
      updatePosition();
    }
  }, [viewportWidth, viewportHeight, enabled, updatePosition]);

  return {
    position,
    arrowPosition,
    arrowOffset,
    anchorRef,
    updatePosition,
  };
}

/**
 * Get arrow style for positioning
 */
export function getArrowStyle(
  arrowPosition: "top" | "bottom" | "left" | "right" | undefined,
  arrowOffset: number | undefined,
  backgroundColor: string,
  borderColor?: string
) {
  if (!arrowPosition || arrowOffset === undefined) return null;

  const size = 12;
  const halfSize = size / 2;

  const baseStyle: any = {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: halfSize,
    borderRightWidth: halfSize,
    borderTopWidth: halfSize,
    borderBottomWidth: halfSize,
    borderStyle: "solid",
  };

  switch (arrowPosition) {
    case "top":
      return {
        ...baseStyle,
        top: -halfSize,
        left: arrowOffset - halfSize,
        borderTopColor: "transparent",
        borderBottomColor: backgroundColor,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
      };
    case "bottom":
      return {
        ...baseStyle,
        bottom: -halfSize,
        left: arrowOffset - halfSize,
        borderBottomColor: "transparent",
        borderTopColor: backgroundColor,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
      };
    case "left":
      return {
        ...baseStyle,
        left: -halfSize,
        top: arrowOffset - halfSize,
        borderLeftColor: "transparent",
        borderRightColor: backgroundColor,
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
      };
    case "right":
      return {
        ...baseStyle,
        right: -halfSize,
        top: arrowOffset - halfSize,
        borderRightColor: "transparent",
        borderLeftColor: backgroundColor,
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
      };
  }
}

/**
 * Border arrow style (for arrow with border)
 */
export function getBorderArrowStyle(
  arrowPosition: "top" | "bottom" | "left" | "right" | undefined,
  arrowOffset: number | undefined,
  borderColor: string
) {
  if (!arrowPosition || arrowOffset === undefined) return null;

  const size = 13; // 1px larger than content arrow
  const halfSize = size / 2;

  const baseStyle: any = {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: halfSize,
    borderRightWidth: halfSize,
    borderTopWidth: halfSize,
    borderBottomWidth: halfSize,
    borderStyle: "solid",
  };

  switch (arrowPosition) {
    case "top":
      return {
        ...baseStyle,
        top: -halfSize,
        left: arrowOffset - halfSize,
        borderTopColor: "transparent",
        borderBottomColor: borderColor,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
      };
    case "bottom":
      return {
        ...baseStyle,
        bottom: -halfSize,
        left: arrowOffset - halfSize,
        borderBottomColor: "transparent",
        borderTopColor: borderColor,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
      };
    case "left":
      return {
        ...baseStyle,
        left: -halfSize,
        top: arrowOffset - halfSize,
        borderLeftColor: "transparent",
        borderRightColor: borderColor,
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
      };
    case "right":
      return {
        ...baseStyle,
        right: -halfSize,
        top: arrowOffset - halfSize,
        borderRightColor: "transparent",
        borderLeftColor: borderColor,
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
      };
  }
}