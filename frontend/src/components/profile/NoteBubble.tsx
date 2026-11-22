import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
} from "react-native";
import { Plus, Trash2, X } from "lucide-react-native";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { updateNote, deleteNote } from "../../lib/api";
import { RADIUS, SPACE } from "../../lib/tokens";

interface NoteBubbleProps {
  note?: string | null;
  isSelf?: boolean;
  onNoteUpdated?: (newNote: string | null) => void;
  /** Size variant: "large" for profile header, "compact" for messaging avatar */
  variant?: "large" | "compact";
}

export default function NoteBubble({
  note,
  isSelf,
  onNoteUpdated,
  variant = "large",
}: NoteBubbleProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [noteInput, setNoteInput] = useState(note || "");
  const [saving, setSaving] = useState(false);

  const hasNote = Boolean(note && note.trim().length > 0);

  // If not owner and has no note, don't render anything
  if (!isSelf && !hasNote) {
    return null;
  }

  const handleOpenModal = () => {
    if (!isSelf) return;
    setNoteInput(note || "");
    setModalOpen(true);
  };

  const handleCloseModal = useCallback(() => {
    if (!saving) setModalOpen(false);
  }, [saving]);

  const handleSaveNote = async () => {
    const clean = noteInput.trim();
    if (!clean && !hasNote) return;
    setSaving(true);
    try {
      if (clean.length === 0) {
        await deleteNote();
        onNoteUpdated?.(null);
        setNoteInput("");
        showToast({ message: "Note removed", tone: "info" });
      } else {
        await updateNote(clean);
        onNoteUpdated?.(clean);
        showToast({ message: "Note shared!", tone: "success" });
      }
      setModalOpen(false);
    } catch (err: any) {
      showToast({ message: err?.message || "Failed to update note", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async () => {
    setSaving(true);
    try {
      await deleteNote();
      onNoteUpdated?.(null);
      setNoteInput("");
      showToast({ message: "Note deleted", tone: "info" });
      setModalOpen(false);
    } catch (err: any) {
      showToast({ message: err?.message || "Failed to delete note", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const isCompact = variant === "compact";

  return (
    <>
      <Pressable
        onPress={isSelf ? handleOpenModal : undefined}
        accessibilityRole={isSelf ? "button" : undefined}
        accessibilityLabel={hasNote ? `Note: ${note}` : "Add a note"}
        style={({ pressed, hovered }: any) => [
          styles.bubbleWrapper,
          isCompact && styles.bubbleWrapperCompact,
          {
            cursor: (isSelf ? "pointer" : "auto") as any,
            opacity: isSelf ? (pressed ? 0.8 : hovered ? 0.95 : 1) : 1,
            transform: [{ scale: isSelf && pressed ? 0.96 : 1 }],
          },
        ]}
      >
        <View
          style={[
            styles.bubbleBox,
            isCompact && styles.bubbleBoxCompact,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {hasNote ? (
            <Text
              style={[
                styles.bubbleText,
                isCompact && styles.bubbleTextCompact,
                { color: colors.ink },
              ]}
              numberOfLines={2}
            >
              {note}
            </Text>
          ) : isSelf ? (
            <View style={styles.addNotePrompt}>
              <Plus size={11} color={colors.inkSoft} style={{ marginRight: 2 }} />
              <Text style={[styles.bubblePromptText, { color: colors.inkSoft }]}>
                Share a thought...
              </Text>
            </View>
          ) : null}
        </View>
        {/* Tail indicator pointing to avatar */}
        <View
          style={[
            styles.tail,
            isCompact && styles.tailCompact,
            {
              borderTopColor: colors.surface,
            },
          ]}
        />
      </Pressable>

      {/* Note Editor Modal */}
      {isSelf && (
        <Modal visible={modalOpen} onClose={handleCloseModal} maxWidth={420} sheetOnMobile={false}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.ink }]}>
                {hasNote ? "Edit Note" : "Share a Thought"}
              </Text>
              <Pressable
                onPress={handleCloseModal}
                disabled={saving}
                style={({ pressed, hovered }: any) => [
                  styles.closeBtn,
                  {
                    backgroundColor: colors.surfaceSunken,
                    opacity: pressed ? 0.7 : hovered ? 0.9 : 1,
                  },
                ]}
              >
                <X size={16} color={colors.ink} />
              </Pressable>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.inkSoft }]}>
              Notes appear as a speech bubble above your avatar across your profile and messages.
            </Text>

            <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surfaceSunken }]}>
              <TextInput
                value={noteInput}
                onChangeText={setNoteInput}
                placeholder="What's on your mind? (e.g. meet?? pass ako jn)"
                placeholderTextColor={colors.inkFaint}
                maxLength={60}
                autoFocus
                returnKeyType="send"
                onSubmitEditing={handleSaveNote}
                style={[
                  styles.textInput,
                  {
                    color: colors.ink,
                    outlineStyle: "none" as any,
                  },
                ]}
              />
              <Text style={[styles.charCount, { color: colors.inkFaint }]}>
                {noteInput.length}/60
              </Text>
            </View>

            <View style={styles.modalActions}>
              {hasNote && (
                <Pressable
                  onPress={handleDeleteNote}
                  disabled={saving}
                  style={({ pressed, hovered }: any) => [
                    styles.deleteBtn,
                    {
                      borderColor: colors.destructive + "40",
                      backgroundColor: colors.destructive + "12",
                      opacity: pressed ? 0.7 : hovered ? 0.9 : 1,
                    },
                  ]}
                >
                  <Trash2 size={15} color={colors.destructive} />
                  <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>
                    Clear
                  </Text>
                </Pressable>
              )}

              <View style={{ flex: 1 }} />

              <Button
                label="Cancel"
                variant="ghost"
                onPress={handleCloseModal}
                disabled={saving}
              />
              <Button
                label={saving ? "Saving..." : "Share"}
                variant="primary"
                loading={saving}
                onPress={handleSaveNote}
                disabled={saving || (!hasNote && noteInput.trim().length === 0)}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bubbleWrapper: {
    alignItems: "center",
    zIndex: 10,
    maxWidth: 160,
  },
  bubbleWrapperCompact: {
    maxWidth: 110,
  },
  bubbleBox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
      } as any,
      default: {
        elevation: 3,
      },
    }),
  },
  bubbleBoxCompact: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.lg,
    minHeight: 20,
  },
  bubbleText: {
    fontSize: 12.5,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 16,
  },
  bubbleTextCompact: {
    fontSize: 10.5,
    lineHeight: 13,
  },
  addNotePrompt: {
    flexDirection: "row",
    alignItems: "center",
  },
  bubblePromptText: {
    fontSize: 11,
    fontWeight: "500",
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    alignSelf: "center",
    marginTop: -1,
  },
  tailCompact: {
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
  },
  modalCard: {
    padding: SPACE.x5,
    width: "100%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACE.x2,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: SPACE.x4,
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    marginBottom: SPACE.x4,
  },
  textInput: {
    fontSize: 15,
    minHeight: 38,
  },
  charCount: {
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x2,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACE.x3,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
