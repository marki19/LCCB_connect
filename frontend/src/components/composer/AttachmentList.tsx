import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { FileText, X } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import FilePreviewModal, { FilePreviewItem } from "../files/FilePreviewModal";

export type ComposerAttachmentItem = {
  id?: string;
  uri: string;
  name: string;
  mime: string;
  size?: number | null;
  category: "posts" | "documents";
  key?: string;
};

type Props = {
  attachments: ComposerAttachmentItem[];
  onRemove: (index: number) => void;
};

function formatSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentList({ attachments, onRemove }: Props) {
  const { colors } = useTheme();
  const [previewDoc, setPreviewDoc] = useState<FilePreviewItem | null>(null);

  if (!attachments || attachments.length === 0) return null;

  return (
    <View style={styles.container}>
      {attachments.map((item, index) => {
        const isImage = item.category === "posts" || item.mime.startsWith("image/");
        const formattedSize = formatSize(item.size);

        return (
          <TouchableOpacity
            key={`${item.uri}-${index}`}
            activeOpacity={0.75}
            onPress={() =>
              setPreviewDoc({
                url: item.uri,
                storage_key: item.key,
                file_name: item.name,
                mime_type: item.mime,
                size_bytes: item.size,
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`Preview ${item.name}`}
            style={[
              styles.item,
              {
                backgroundColor: colors.surfaceSunken,
                borderColor: colors.border,
              },
            ]}
          >
            {isImage ? (
              <Image source={{ uri: item.uri }} style={styles.thumbnail} />
            ) : (
              <View style={[styles.docIcon, { backgroundColor: colors.actionSurface }]}>
                <FileText size={18} color={colors.action} />
              </View>
            )}

            <View style={styles.info}>
              <Text
                style={[styles.name, { color: colors.textPrimary }]}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {item.name}
              </Text>
              {formattedSize ? (
                <Text style={[styles.size, { color: colors.textTertiary }]}>
                  {formattedSize}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                onRemove(index);
              }}
              style={[styles.removeButton, { backgroundColor: colors.surface }]}
              accessibilityLabel={`Remove ${item.name}`}
            >
              <X size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}

      <FilePreviewModal
        visible={Boolean(previewDoc)}
        file={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginVertical: 10,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 10,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 13,
    fontWeight: "500",
  },
  size: {
    fontSize: 11,
    marginTop: 2,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
