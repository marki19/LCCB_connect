import React from "react";
import { Text, TextStyle, StyleProp } from "react-native";
import { useRouter } from "expo-router";
import { renderMentions, type MentionToken } from "../../lib/mentions";
import { useTheme } from "../../contexts/ThemeContext";

interface RichTextProps {
  text: string;
  mentions?: MentionToken[];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export function RichText({ text, mentions, style, numberOfLines }: RichTextProps) {
  const router = useRouter();
  const { colors } = useTheme();

  if (!text) return null;

  const segments = renderMentions(text, mentions);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((seg, idx) => {
        if (seg.username) {
          const targetId = seg.user_id;
          return (
            <Text
              key={idx}
              style={{
                color: colors.primary,
                fontWeight: "600",
              }}
              onPress={() => {
                if (targetId) {
                  router.push(`/profile/${targetId}` as any);
                }
              }}
            >
              {seg.text}
            </Text>
          );
        }
        return <Text key={idx}>{seg.text}</Text>;
      })}
    </Text>
  );
}

export default RichText;
