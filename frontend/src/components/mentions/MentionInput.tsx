import React, { useState, useEffect, useRef, useCallback, type ComponentRef } from "react";
import {
  View,
  TextInput,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
  type TextInputProps,
  type TextInputSelectionChangeEvent,
  type StyleProp,
  type ViewStyle,
  Platform,
} from "react-native";
import { X, AtSign } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";
import { apiFetch } from "../../lib/api";
import { mentionQueryAt, type MentionToken } from "../../lib/mentions";
import Avatar from "../Avatar";

export interface MentionUser {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string | null;
  is_friend?: boolean;
  is_dept_mate?: boolean;
}

interface MentionInputProps extends TextInputProps {
  containerStyle?: StyleProp<ViewStyle>;
  onMentionsChange?: (mentions: MentionToken[]) => void;
  knownMentions?: MentionToken[];
}

export const MentionInput = React.forwardRef<ComponentRef<typeof TextInput>, MentionInputProps>(function MentionInput(
  {
    value = "",
    onChangeText,
    onMentionsChange,
    knownMentions = [],
    containerStyle,
    style,
    onSelectionChange,
    ...rest
  }: MentionInputProps,
  ref
) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;

  const [caret, setCaret] = useState<number>(value.length);
  const [queryState, setQueryState] = useState<{ query: string; start: number } | null>(null);
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [mentions, setMentions] = useState<MentionToken[]>(knownMentions);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSelectionChange = (
    e: TextInputSelectionChangeEvent
  ) => {
    const pos = e.nativeEvent.selection.start;
    setCaret(pos);
    const active = mentionQueryAt(value, pos);
    setQueryState(active);
    onSelectionChange?.(e);
  };

  const handleTextChange = (text: string) => {
    onChangeText?.(text);
    // Check caret immediately on text update
    const active = mentionQueryAt(text, caret);
    setQueryState(active);
  };

  // Fetch mention suggestions when queryState changes
  useEffect(() => {
    if (!queryState) {
      setSuggestions([]);
      setSelectedIndex(0);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/users/mentionable?q=${encodeURIComponent(queryState.query)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.users || []);
          setSelectedIndex(0);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [queryState?.query]);

  const selectUser = useCallback(
    (user: MentionUser) => {
      if (!queryState) return;

      const beforeAt = value.slice(0, queryState.start);
      // after the query token: queryState.start + 1 ('@') + queryState.query.length
      const tokenEnd = queryState.start + 1 + queryState.query.length;
      const afterToken = value.slice(tokenEnd);

      const replacement = `@${user.username} `;
      const nextText = beforeAt + replacement + afterToken;

      onChangeText?.(nextText);

      const updatedMentions = [
        ...mentions.filter((m) => m.username !== user.username),
        { username: user.username, user_id: user.id, id: user.id, full_name: user.full_name },
      ];
      setMentions(updatedMentions);
      onMentionsChange?.(updatedMentions);

      setQueryState(null);
      setSuggestions([]);
    },
    [value, queryState, mentions, onChangeText, onMentionsChange]
  );

  // Web keyboard navigation
  const handleKeyDown = (e: any) => {
    if (!queryState || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (suggestions[selectedIndex]) {
        e.preventDefault();
        selectUser(suggestions[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQueryState(null);
      setSuggestions([]);
    }
  };

  const showSuggestions = Boolean(queryState);

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={handleTextChange}
        onSelectionChange={handleSelectionChange}
        style={style}
        // @ts-ignore - web-only keydown prop
        onKeyDown={Platform.OS === "web" ? handleKeyDown : undefined}
        {...rest}
      />

      {/* Responsive Bottom Sheet / Pop-Up Modal for Mentions */}
      <Modal
        visible={showSuggestions}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setQueryState(null);
          setSuggestions([]);
        }}
      >
        <View style={styles.modalBackdrop}>
          {/* Dimmed backdrop - taps dismiss */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setQueryState(null);
              setSuggestions([]);
            }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss mention picker"
          />

          {/* Bottom sheet card */}
          <View
            style={[
              styles.sheetCard,
              isDesktop && styles.desktopSheetCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Grab handle indicator */}
            <View style={styles.dragBarWrap}>
              <View style={[styles.dragBar, { backgroundColor: colors.border }]} />
            </View>

            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.headerTitleRow}>
                <View style={[styles.atIconWrap, { backgroundColor: colors.actionSurface }]}>
                  <AtSign size={16} color={colors.action} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                    Mention a Contact
                  </Text>
                  <Text style={[styles.sheetSubtitle, { color: colors.textTertiary }]} numberOfLines={1}>
                    {queryState?.query
                      ? `Searching for "${queryState.query}"`
                      : "Department mates & friends"}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  setQueryState(null);
                  setSuggestions([]);
                }}
                accessibilityRole="button"
                accessibilityLabel="Close mention picker"
                style={({ pressed }: any) => [
                  styles.closeBtn,
                  {
                    backgroundColor: colors.surfaceSunken,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <X size={16} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Suggestions List */}
            {loading && suggestions.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.action} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Finding classmates and friends...
                </Text>
              </View>
            ) : suggestions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No matching friends or department mates found.
                </Text>
              </View>
            ) : (
              <ScrollView
                keyboardShouldPersistTaps="always"
                style={styles.scrollList}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator
              >
                {suggestions.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  const badgeLabel = item.is_friend
                    ? "Friend"
                    : item.is_dept_mate
                    ? "Department"
                    : "Classmate";

                  const badgeColor = item.is_friend
                    ? { bg: isDark ? "#064E3B" : "#D1FAE5", text: isDark ? "#6EE7B7" : "#059669" }
                    : item.is_dept_mate
                    ? { bg: isDark ? "#1E3A8A" : "#DBEAFE", text: isDark ? "#93C5FD" : "#2563EB" }
                    : { bg: colors.surfaceSunken, text: colors.textSecondary };

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => selectUser(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Mention ${item.full_name}`}
                      style={({ pressed, hovered }: any) => [
                        styles.suggestionItem,
                        {
                          backgroundColor:
                            isSelected || pressed || hovered
                              ? colors.surfaceSunken
                              : "transparent",
                          borderRadius: RADIUS.md,
                        },
                      ]}
                    >
                      <Avatar
                        avatarUrl={item.avatar_url}
                        name={item.full_name}
                        size={38}
                      />
                      <View style={styles.textContainer}>
                        <View style={styles.nameRow}>
                          <Text
                            style={[styles.nameText, { color: colors.textPrimary }]}
                            numberOfLines={1}
                          >
                            {item.full_name}
                          </Text>
                          <View
                            style={[
                              styles.badge,
                              { backgroundColor: badgeColor.bg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                { color: badgeColor.text },
                              ]}
                            >
                              {badgeLabel}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={[styles.handleText, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          @{item.username}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: "100%",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  sheetCard: {
    width: "100%",
    maxHeight: "65%",
    borderTopLeftRadius: RADIUS.xl || 20,
    borderTopRightRadius: RADIUS.xl || 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 8,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 20,
  },
  desktopSheetCard: {
    maxWidth: 520,
    alignSelf: "center",
    marginBottom: 20,
    borderRadius: RADIUS.lg,
    borderBottomWidth: 1,
    paddingBottom: 16,
  },
  dragBarWrap: {
    alignItems: "center",
    paddingVertical: 4,
  },
  dragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x2,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128, 128, 128, 0.15)",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x2,
    flex: 1,
  },
  atIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  scrollList: {
    maxHeight: 280,
  },
  scrollContent: {
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    gap: 4,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    gap: SPACE.x3,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  nameText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  handleText: {
    fontSize: 12.5,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  loadingContainer: {
    padding: SPACE.x6,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.x2,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyContainer: {
    padding: SPACE.x6,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
  },
});

export default MentionInput;
