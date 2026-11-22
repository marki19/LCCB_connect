import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, useWindowDimensions } from "react-native";
import { Trash2, Flag, UserX, Share2, Settings, Edit3, Bookmark } from "lucide-react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { RADIUS, SPACE, elevation } from "../lib/tokens";
import { useRouter } from "expo-router";
import type { Post } from "../types";

interface PostMenuProps {
  post: Post;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onRepost?: (caption?: string) => void;
  onReport: () => void;
  onBlock: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  /** Anchor position from trigger element */
  anchorX?: number;
  anchorY?: number;
  /** Preferred position relative to anchor */
  preferredPosition?: "top-right" | "bottom-right" | "top-left" | "bottom-left";
}

const MENU_WIDTH = 220;
const MENU_PADDING = 12;

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 1000,
    width: MENU_WIDTH,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menu: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...elevation("lg", colors),
  },
  section: {},
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x3,
  },
  itemText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: SPACE.x3,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginHorizontal: SPACE.x3,
  },
  destructiveText: {
    color: colors.destructive,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x2,
    color: colors.textTertiary,
  },
  arrow: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: colors.surfaceElevated,
  },
  arrowTop: {
    top: -12,
    borderBottomWidth: 12,
    borderTopWidth: 0,
    borderBottomColor: colors.surfaceElevated,
  },
  arrowBottom: {
    bottom: -12,
    borderTopWidth: 12,
    borderBottomWidth: 0,
    borderTopColor: colors.surfaceElevated,
  },
  arrowBorder: {
    borderBottomColor: colors.border,
    borderTopColor: colors.border,
  },
});

export default function PostMenu({
  post,
  onClose,
  onEdit,
  onDelete,
  onRepost,
  onReport,
  onBlock,
  onSave,
  isSaved,
  anchorX = 0,
  anchorY = 0,
  preferredPosition = "bottom-right",
}: PostMenuProps) {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const router = useRouter();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const menuRef = useRef<any>(null);
  const previouslyFocused = useRef<any>(null);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; right?: number; bottom?: number }>({
    top: anchorY,
    left: anchorX,
  });
  const [arrowPosition, setArrowPosition] = useState<"top" | "bottom" | "none">("none");
  const [arrowLeft, setArrowLeft] = useState(0);

  const isOwner = !!profile?.id && profile.id === post.author.id;

  const styles = createStyles(colors);

  // Calculate menu position to stay within viewport
  useEffect(() => {
    const calculatePosition = () => {
      const menuWidth = MENU_WIDTH;
      const menuHeight = isOwner ? 380 : 300; // approximate heights
      
      let top = anchorY;
      let left = anchorX;
      let right: number | undefined;
      let arrowPos: "top" | "bottom" | "none" = "none";
      let arrowLeftPos = 0;

      // Determine vertical position
      const spaceBelow = viewportHeight - anchorY;
      const spaceAbove = anchorY;

      if (preferredPosition.includes("bottom") && spaceBelow >= menuHeight + MENU_PADDING) {
        // Place below anchor
        top = anchorY + 8;
        arrowPos = "top";
      } else if (preferredPosition.includes("top") && spaceAbove >= menuHeight + MENU_PADDING) {
        // Place above anchor
        top = anchorY - menuHeight - 8;
        arrowPos = "bottom";
      } else if (spaceBelow >= menuHeight + MENU_PADDING) {
        // Default to below if space
        top = anchorY + 8;
        arrowPos = "top";
      } else if (spaceAbove >= menuHeight + MENU_PADDING) {
        // Place above if no space below
        top = anchorY - menuHeight - 8;
        arrowPos = "bottom";
      } else {
        // No space either way, center vertically
        top = Math.max(MENU_PADDING, (viewportHeight - menuHeight) / 2);
        arrowPos = "none";
      }

      // Determine horizontal position
      if (preferredPosition.includes("right")) {
        // Align right edge with anchor
        left = anchorX - menuWidth;
        arrowLeftPos = menuWidth - 16; // Arrow near right edge
        
        // Check if menu goes off left edge
        if (left < MENU_PADDING) {
          left = MENU_PADDING;
          arrowLeftPos = anchorX - left - 8;
        }
      } else {
        // Align left edge with anchor
        left = anchorX;
        arrowLeftPos = 8; // Arrow near left edge
        
        // Check if menu goes off right edge
        if (left + menuWidth > viewportWidth - MENU_PADDING) {
          left = viewportWidth - menuWidth - MENU_PADDING;
          arrowLeftPos = anchorX - left - 8;
        }
      }

      // Clamp arrow position
      arrowLeftPos = Math.max(8, Math.min(menuWidth - 16, arrowLeftPos));

      setMenuStyle({ top, left, right, bottom: undefined });
      setArrowPosition(arrowPos);
      setArrowLeft(arrowLeftPos);
    };

    calculatePosition();
  }, [anchorX, anchorY, preferredPosition, viewportWidth, viewportHeight, isOwner]);

  // Focus management for accessibility
  useEffect(() => {
    if (Platform.OS === "web") {
      const doc: any = (globalThis as any).document;
      previouslyFocused.current = doc?.activeElement ?? null;
    }

    const timeout = setTimeout(() => {
      menuRef.current?.focus?.();
    }, 50);

    return () => {
      clearTimeout(timeout);
      if (Platform.OS === "web" && previouslyFocused.current) {
        try {
          previouslyFocused.current.focus?.();
        } catch {}
      }
    };
  }, []);

  // Escape key handler
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleRepost = (caption?: string) => {
    onClose();
    if (onRepost) {
      onRepost(caption);
    }
  };

  const handlePostSettings = () => {
    onClose();
    router.push({
      pathname: "/post-settings",
      params: { postId: String(post.id) },
    });
  };

  const handleShare = () => {
    onClose();
    const shareUrl = `https://lccbconnect.app/post/${post.id}`;
    if (navigator.share) {
      navigator.share({
        title: post.title || "Post",
        text: post.description || "",
        url: shareUrl,
      }).catch(() => {});
    } else {
      Alert.alert("Share", `Copy link: ${shareUrl}`);
    }
  };

  // Backdrop press handler
  const handleBackdropPress = () => {
    onClose();
  };

  const renderMenuItem = (
    icon: React.ReactNode,
    label: string,
    onPress: () => void,
    options?: {
      destructive?: boolean;
      selected?: boolean;
      accessibilityHint?: string;
    }
  ) => (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      accessibilityHint={options?.accessibilityHint}
      accessibilityState={{ selected: options?.selected }}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <View style={{ width: 24, alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <Text style={[{ ...styles.itemText, color: options?.destructive ? colors.destructive : colors.textPrimary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <TouchableOpacity
      style={styles.backdrop}
      onPress={handleBackdropPress}
      accessible={false}
      accessibilityRole="button"
      accessibilityLabel="Close menu"
    >
      <View
        ref={menuRef}
        style={[styles.container, menuStyle]}
        accessibilityViewIsModal
        accessibilityRole="menu"
        accessibilityLabel={isOwner ? "Your post options" : "Post options"}
        importantForAccessibility="yes"
      >
        {/* Arrow indicator */}
        {arrowPosition !== "none" && (
          <View
            style={[
              styles.arrow,
              arrowPosition === "top" ? styles.arrowTop : styles.arrowBottom,
              { left: arrowLeft },
            ]}
            accessible={false}
            accessibilityElementsHidden={true}
            importantForAccessibility="no-hide-descendants"
          />
        )}

        <View style={styles.menu}>
          {isOwner && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">Your Post</Text>
                {onSave && (
                  renderMenuItem(
                    <Bookmark size={16} color={isSaved ? colors.brand : colors.action} />,
                    isSaved ? "Remove from Saved" : "Save Post",
                    () => { onClose(); onSave?.(); },
                    { selected: Boolean(isSaved), accessibilityHint: isSaved ? "Removes post from your saved items" : "Saves post to your bookmarks" }
                  )
                )}
                {onEdit && (
                  renderMenuItem(
                    <Edit3 size={16} color={colors.action} />,
                    "Edit Post",
                    () => { onClose(); onEdit?.(); },
                    { accessibilityHint: "Opens the post editor" }
                  )
                )}
                {onRepost && (
                  renderMenuItem(
                    <Share2 size={16} color={colors.action} strokeWidth={2} />,
                    "Repost",
                    () => { onClose(); handleRepost(); },
                    { accessibilityHint: "Share this post to your feed with optional caption" }
                  )
                )}
                <TouchableOpacity
                  style={styles.item}
                  onPress={handlePostSettings}
                  activeOpacity={0.7}
                  accessibilityRole="menuitem"
                  accessibilityLabel="Post Settings"
                  accessibilityHint="Manage visibility and repost permissions"
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <View style={{ width: 24, alignItems: "center", justifyContent: "center" }}>
                    <Settings size={16} color={colors.textSecondary} />
                  </View>
                  <Text style={styles.itemText}>Post Settings</Text>
                </TouchableOpacity>
                <View style={styles.divider} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" />
                {onDelete && (
                  renderMenuItem(
                    <Trash2 size={16} color={colors.destructive} />,
                    "Delete Post",
                    () => { onClose(); onDelete?.(); },
                    { destructive: true, accessibilityHint: "Permanently deletes this post" }
                  )
                )}
              </View>
            </>
          )}

          {!isOwner && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">Actions</Text>
                {onSave && (
                  renderMenuItem(
                    <Bookmark size={16} color={isSaved ? colors.brand : colors.action} />,
                    isSaved ? "Remove from Saved" : "Save Post",
                    () => { onClose(); onSave?.(); },
                    { selected: Boolean(isSaved), accessibilityHint: isSaved ? "Removes post from your saved items" : "Saves post to your bookmarks" }
                  )
                )}
                {onRepost && (
                  renderMenuItem(
                    <Share2 size={16} color={colors.action} strokeWidth={2} />,
                    "Repost",
                    () => { onClose(); handleRepost(); },
                    { accessibilityHint: "Share this post to your feed with optional caption" }
                  )
                )}
                <TouchableOpacity
                  style={styles.item}
                  onPress={handleShare}
                  activeOpacity={0.7}
                  accessibilityRole="menuitem"
                  accessibilityLabel="Share"
                  accessibilityHint="Share this post via system share sheet"
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <View style={{ width: 24, alignItems: "center", justifyContent: "center" }}>
                    <Share2 size={16} color={colors.textSecondary} strokeWidth={2} />
                  </View>
                  <Text style={styles.itemText}>Share</Text>
                </TouchableOpacity>
                <View style={styles.divider} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" />
                {onReport && (
                  renderMenuItem(
                    <Flag size={16} color={colors.warning} />,
                    "Report",
                    () => { onClose(); onReport(); },
                    { accessibilityHint: "Report this post for violating community guidelines" }
                  )
                )}
                {onBlock && (
                  renderMenuItem(
                    <UserX size={16} color={colors.destructive} />,
                    `Block @${post.author.username || post.author.name}`,
                    () => { onClose(); onBlock(); },
                    { destructive: true, accessibilityHint: `Blocks ${post.author.name} - they won't see your posts and you won't see theirs` }
                  )
                )}
              </View>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}