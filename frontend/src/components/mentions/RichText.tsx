import React from "react";
import { Text, TextStyle, StyleProp, Linking } from "react-native";
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
              key={`mention-${idx}`}
              style={{
                color: colors.primary,
                fontWeight: "600",
              }}
              onPress={(e) => {
                e?.stopPropagation?.();
                if (targetId) {
                  router.push(`/profile/${targetId}` as any);
                }
              }}
            >
              {seg.text}
            </Text>
          );
        }

        if (seg.url) {
          return (
            <Text
              key={`link-${idx}`}
              style={{
                color: colors.action,
                textDecorationLine: "underline",
                fontWeight: "500",
              }}
              onPress={(e) => {
                e?.stopPropagation?.();
                Linking.openURL(seg.url!).catch((err) => {
                  console.error("Failed to open link:", err);
                });
              }}
            >
              {seg.text}
            </Text>
          );
        }

        return <Text key={`text-${idx}`}>{seg.text}</Text>;
      })}
    </Text>
  );
}

export default RichText;
