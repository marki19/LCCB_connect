import { type ReactNode } from "react";
import { Text, View } from "react-native";
import { AlertCircle, CheckCircle2, Info } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";

type AlertTone = "error" | "success" | "info";

type AlertProps = {
  tone?: AlertTone;
  message: string;
  /** Optional trailing action (e.g. a retry link). */
  action?: ReactNode;
};

/** Inline status banner used by forms for validation and result feedback. */
export default function Alert({ tone = "error", message, action }: AlertProps) {
  const { colors } = useTheme();

  const palette =
    tone === "success"
      ? {
          bg: colors.successSurface,
          border: colors.successSurfaceAlt,
          icon: colors.success,
          text: colors.successText,
        }
      : tone === "info"
      ? {
          bg: colors.infoSurface,
          border: colors.border,
          icon: colors.info,
          text: colors.infoText,
        }
      : {
          bg: colors.destructiveSurface,
          border: colors.destructiveSurfaceAlt,
          icon: colors.destructive,
          text: colors.destructiveText,
        };

  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;

  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: palette.bg,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: palette.border,
        paddingHorizontal: SPACE.x3,
        paddingVertical: SPACE.x3,
        marginBottom: SPACE.x4,
      }}
    >
      <Icon size={18} color={palette.icon} strokeWidth={2.2} />
      <Text style={{ flex: 1, marginLeft: SPACE.x2, fontSize: 13, lineHeight: 18, fontWeight: "600", color: palette.text }}>
        {message}
      </Text>
      {action ? <View style={{ marginLeft: SPACE.x2 }}>{action}</View> : null}
    </View>
  );
}
