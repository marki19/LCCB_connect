import React, { useEffect, useRef, type ReactNode } from "react";
import { View, StyleSheet, Platform, Pressable, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { elevation, RADIUS, SPACE } from "../../lib/tokens";

type PopoverProps = {
  /** Ref to the anchor element */
  anchorRef: React.RefObject<any> | null;
  /** Content to render in the popover */
  children: ReactNode;
  /** Whether the popover is visible */
  visible: boolean;
  /** Callback when popover should close */
  onClose: () => void;
  /** Preferred position relative to anchor */
  placement?: "top" | "bottom" | "left" | "right" | "bottom-start" | "bottom-end" | "top-start" | "top-end";
  /** Maximum width */
  maxWidth?: number;
  /** Minimum width */
  minWidth?: number;
  /** Offset from anchor */
  offset?: number;
  /** Close on outside click */
  closeOnOutsideClick?: boolean;
  /** Accessible label */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export default function Popover({
  anchorRef,
  children,
  visible,
  onClose,
  placement = "bottom-end",
  maxWidth = 280,
  minWidth = 200,
  offset = 8,
  closeOnOutsideClick = true,
  accessibilityLabel = "Popover menu",
  style,
}: PopoverProps) {
  const { colors } = useTheme();
  const contentRef = useRef<any>(null);
  const outsideClickRef = useRef<any>(null);

  useEffect(() => {
    if (!visible || !closeOnOutsideClick || Platform.OS !== "web") return;

    const handleOutsideClick = (event: any) => {
      const target = event.target;
      const content = contentRef.current;
      const anchor = anchorRef?.current;

      if (
        content &&
        anchor &&
        !content.contains(target) &&
        !anchor.contains(target)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [visible, closeOnOutsideClick, anchorRef, onClose]);

  if (!visible) return null;

  // On native, we render as a simple dropdown; on web we position absolutely
  const isWeb = Platform.OS === "web";

  return (
    <View style={{ position: "relative", zIndex: 100 }}>
      {isWeb && closeOnOutsideClick && (
        <Pressable
          ref={outsideClickRef}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Close popover"
        />
      )}
      <View
        ref={contentRef}
        style={[
          {
            position: "absolute",
            top: placement.startsWith("top") ? undefined : 0,
            bottom: placement.startsWith("top") ? 0 : undefined,
            right: placement.endsWith("end") ? 0 : undefined,
            left: placement.endsWith("start") ? 0 : undefined,
            maxWidth,
            minWidth,
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: RADIUS.lg,
            paddingVertical: SPACE.x1,
            ...elevation("lg", colors),
            zIndex: 101,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
            elevation: 12,
          },
          style,
        ]}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </View>
    </View>
  );
}