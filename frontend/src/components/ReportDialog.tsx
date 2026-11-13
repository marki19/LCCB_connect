import { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, ScrollView } from "react-native";
import { X, Flag, AlertTriangle } from "lucide-react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { RADIUS, SPACE } from "../lib/tokens";
import { createReport } from "../lib/api";

interface ReportDialogProps {
  targetType: "post" | "repost" | "comment" | "thesis" | "message" | "profile";
  targetId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const REPORT_REASONS = [
  { value: "spam", label: "Spam", description: "Unwanted commercial content or repetitive posts" },
  { value: "harassment", label: "Harassment", description: "Targeted abuse, threats, or bullying" },
  { value: "inappropriate", label: "Inappropriate", description: "Sexual, violent, or offensive content" },
  { value: "misinformation", label: "Misinformation", description: "False or misleading information" },
  { value: "copyright", label: "Copyright", description: "Unauthorized use of copyrighted material" },
  { value: "other", label: "Other", description: "Something else not listed above" },
] as const;

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACE.x4,
    paddingTop: SPACE.x4,
    paddingBottom: SPACE.x5,
    maxHeight: "90%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: SPACE.x4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACE.x3,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  closeButton: {
    padding: SPACE.x1,
  },
  reasonList: {
    maxHeight: 300,
  },
  reasonItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: SPACE.x3,
    paddingHorizontal: SPACE.x2,
    borderRadius: RADIUS.md,
    marginBottom: SPACE.x2,
  },
  reasonItemSelected: {
    backgroundColor: colors.warningSurface,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  reasonRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textTertiary,
    marginRight: SPACE.x3,
    marginTop: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  reasonRadioSelected: {
    borderColor: colors.warning,
    backgroundColor: colors.warning,
  },
  reasonRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textOnPrimary,
  },
  reasonContent: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  reasonDescription: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: SPACE.x3,
  },
  noteLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: SPACE.x2,
  },
  noteInput: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x3,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: "right",
    marginTop: SPACE.x1,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.destructive,
    paddingVertical: SPACE.x3,
    borderRadius: RADIUS.md,
    marginTop: SPACE.x3,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textOnPrimary,
    marginLeft: SPACE.x2,
  },
});

export default function ReportDialog({ targetType, targetId, isOpen, onClose, onSuccess }: ReportDialogProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = createStyles(colors);

  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert("Select a reason", "Please choose a reason for reporting this content.");
      return;
    }
    if (loading) return;

    setLoading(true);
    try {
      await createReport(targetType, targetId, selectedReason, note.trim() || undefined);
      showToast({
        message: "Report submitted. Thank you for keeping our community safe.",
        tone: "success",
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      if (e.code === "DUPLICATE_REPORT") {
        Alert.alert("Already reported", "You've already reported this content.");
      } else {
        Alert.alert("Error", e.message || "Failed to submit report. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity style={styles.overlay} onPress={onClose} accessible={false}>
      <TouchableOpacity style={styles.container} onPress={() => {}} accessible={false}>
        <View style={styles.handle} />
        
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <AlertTriangle size={22} color={colors.warning} style={{ marginRight: SPACE.x3 }} />
            <Text style={styles.title}>Report Content</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
            <X size={22} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginBottom: SPACE.x2 }}>
          Why are you reporting this?
        </Text>

        <ScrollView style={styles.reasonList} showsVerticalScrollIndicator={false}>
          {REPORT_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.value}
              style={[
                styles.reasonItem,
                selectedReason === reason.value && styles.reasonItemSelected,
              ]}
              onPress={() => setSelectedReason(reason.value)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.reasonRadio,
                  selectedReason === reason.value && styles.reasonRadioSelected,
                ]}
              >
                {selectedReason === reason.value && <View style={styles.reasonRadioInner} />}
              </View>
              <View style={styles.reasonContent}>
                <Text style={styles.reasonLabel}>{reason.label}</Text>
                <Text style={styles.reasonDescription}>{reason.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.divider} />

        <Text style={styles.noteLabel}>Additional details (optional)</Text>
        <TextInput
          style={styles.noteInput}
          multiline
          placeholder="Add any context that helps us understand the issue..."
          value={note}
          onChangeText={setNote}
          maxLength={500}
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.charCount}>{note.length}/500</Text>

        <TouchableOpacity
          style={[
            styles.submitButton,
            !selectedReason || loading ? styles.submitButtonDisabled : {},
          ]}
          onPress={handleSubmit}
          disabled={!selectedReason || loading}
          activeOpacity={0.8}
        >
          <Flag size={18} color={colors.textOnPrimary} />
          <Text style={styles.submitButtonText}>
            {loading ? "Submitting..." : "Submit Report"}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}