import React, { useState, useEffect, useRef, useCallback, type ComponentRef } from "react";
import {
  View,
  TextInput,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputProps,
  type TextInputSelectionChangeEvent,
  type StyleProp,
  type ViewStyle,
  Platform,
} from "react-native";
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
}

interface MentionInputProps extends TextInputProps {
  containerStyle?: StyleProp<ViewStyle>;
  onMentionsChange?: (mentions: MentionToken[]) => void;
  knownMentions?: MentionToken[];
}

const MentionInput = React.forwardRef<ComponentRef<typeof TextInput>, MentionInputProps>(function MentionInput(
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
  const { colors } = useTheme();
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
    // On text change, caret will be updated by selection event, but check immediately with new length
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

  const showSuggestions = Boolean(queryState && (suggestions.length > 0 || loading));

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

      {showSuggestions && (
        <View
          style={[
            styles.popover,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {loading && suggestions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Searching...
              </Text>
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="always"
              style={styles.scrollList}
              nestedScrollEnabled
            >
              {suggestions.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => selectUser(item)}
                    style={[
                      styles.suggestionItem,
                      isSelected && {
                        backgroundColor: colors.primarySurface,
                      },
                    ]}
                  >
                    <Avatar
                      avatarUrl={item.avatar_url}
                      name={item.full_name}
                      size={28}
                    />
                    <View style={styles.textContainer}>
                      <Text
                        style={[styles.nameText, { color: colors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {item.full_name}
                      </Text>
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
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: "100%",
  },
  popover: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    right: 0,
    maxHeight: 200,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: SPACE.x1,
    zIndex: 1000,
    overflow: "hidden",
  },
  scrollList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    gap: SPACE.x2,
  },
  textContainer: {
    flex: 1,
  },
  nameText: {
    fontSize: 13,
    fontWeight: "600",
  },
  handleText: {
    fontSize: 12,
  },
  emptyContainer: {
    padding: SPACE.x3,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 12,
  },
});

export default MentionInput;
