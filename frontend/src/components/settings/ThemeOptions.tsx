import { Text, View } from "react-native";
import { Palette } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import {
  colorSchemeLabel,
  type ColorSchemePreference,
} from "../../lib/theme";
import { SPACE, TYPE } from "../../lib/tokens";
import RadioOption from "../ui/RadioOption";

/**
 * Presentation order: the two explicit choices first, the automatic one last —
 * "what will I get?" reads better before "let the device decide".
 */
const OPTION_ORDER: readonly ColorSchemePreference[] = ["light", "dark", "system"];

const OPTION_DESCRIPTION: Record<ColorSchemePreference, string> = {
  light: "Always use the light palette.",
  dark: "Always use the dark palette.",
  system: "Follow your device's appearance.",
};

/**
 * The appearance picker. Reads and writes the same persisted preference as the
 * theme toggle in the header, so every entry point stays in sync.
 */
export default function ThemeOptions() {
  const { colors, preference, resolved, setColorScheme } = useTheme();

  const descriptionFor = (value: ColorSchemePreference) =>
    value === "system"
      ? `${OPTION_DESCRIPTION.system} Currently ${resolved}.`
      : OPTION_DESCRIPTION[value];

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Theme"
      style={{ paddingHorizontal: SPACE.x2, paddingBottom: SPACE.x3 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: SPACE.x3,
          paddingHorizontal: SPACE.x2,
          paddingVertical: SPACE.x2,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySurface,
          }}
        >
          <Palette size={16} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...TYPE.bodyStrong, fontWeight: "700", color: colors.ink }}>
            Appearance
          </Text>
          <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 2 }}>
            Choose the palette LCCB Connect uses.
          </Text>
        </View>
      </View>

      {OPTION_ORDER.map((value) => (
        <RadioOption
          key={value}
          label={colorSchemeLabel(value)}
          description={descriptionFor(value)}
          selected={preference === value}
          onPress={() => void setColorScheme(value)}
        />
      ))}
    </View>
  );
}
