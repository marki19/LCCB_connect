import React from "react";
import { View, Text, TouchableOpacity, Linking, StyleSheet } from "react-native";
import { FileText, ExternalLink, Download } from "lucide-react-native";
import { useTheme } from "../contexts/ThemeContext";
import type { PostAttachment } from "../types";

type Props = {
  attachments?: PostAttachment[] | null;
};

function formatSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentStrip({ attachments }: Props) {
  const { colors } = useTheme();

  if (!attachments || attachments.length === 0) return null;

  // Filter for document attachments (non-image files)
  const docs = attachments.filter(
    (att) => att.mime_type && !att.mime_type.startsWith("image/")
  );

  if (docs.length === 0) return null;

  const handleOpenDoc = (url?: string) => {
    if (url) {
      Linking.openURL(url).catch((err) => {
        console.error("Failed to open document URL:", err);
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.header, { color: colors.textTertiary }]}>
        Attachments ({docs.length})
      </Text>
      <View style={styles.list}>
        {docs.map((doc, idx) => {
          const formattedSize = formatSize(doc.size_bytes);
          const hasUrl = Boolean(doc.url);

          return (
            <TouchableOpacity
              key={doc.id || doc.storage_key || idx}
              onPress={() => handleOpenDoc(doc.url)}
              disabled={!hasUrl}
              activeOpacity={0.75}
              style={[
                styles.chip,
                {
                  backgroundColor: colors.surfaceSunken,
                  borderColor: colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Open document ${doc.file_name}`}
            >
              <View style={[styles.iconWrap, { backgroundColor: colors.actionSurface }]}>
                <FileText size={16} color={colors.action} />
              </View>

              <View style={styles.info}>
                <Text
                  style={[styles.fileName, { color: colors.textPrimary }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {doc.file_name}
                </Text>
                {formattedSize ? (
                  <Text style={[styles.size, { color: colors.textTertiary }]}>
                    {formattedSize}
                  </Text>
                ) : null}
              </View>

              {hasUrl && (
                <ExternalLink size={14} color={colors.textTertiary} style={styles.openIcon} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 14,
    marginBottom: 12,
  },
  header: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  list: {
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  info: {
    flex: 1,
    marginRight: 6,
  },
  fileName: {
    fontSize: 13,
    fontWeight: "600",
  },
  size: {
    fontSize: 11,
    marginTop: 1,
  },
  openIcon: {
    marginLeft: 4,
  },
});
