import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { LogOut, ShieldAlert } from "lucide-react-native";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";

function formatUntil(value?: string | null) {
  if (!value) return "Until an administrator restores the account";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `Until ${date.toLocaleString()}`;
}

export default function SuspendedScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { colors } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfacePage,
        padding: 24,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 560,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: 32,
          shadowColor: colors.shadowStrong,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 16,
          elevation: 4,
        }}
      >
        <View
          style={{
            marginBottom: 20,
            height: 56,
            width: 56,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 16,
            backgroundColor: colors.destructiveSurface,
          }}
        >
          <ShieldAlert size={28} color={colors.destructiveText} />
        </View>
        <Text style={{ fontSize: 24, fontWeight: "900", letterSpacing: -0.5, color: colors.textPrimary }}>
          Account suspended
        </Text>
        <Text style={{ marginTop: 8, fontSize: 15, lineHeight: 22, color: colors.textSecondary }}>
          This account cannot use LCCB Connect while the suspension is active.
        </Text>

        <View
          style={{
            marginTop: 24,
            borderRadius: 16,
            backgroundColor: colors.surfaceSunken,
            padding: 16,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
            Reason
          </Text>
          <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: colors.textPrimary }}>
            {profile?.suspension_reason || "No reason was recorded."}
          </Text>
          <Text style={{ marginTop: 16, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.textTertiary }}>
            Duration
          </Text>
          <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: colors.textPrimary }}>
            {formatUntil(profile?.suspended_until)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => void handleSignOut()}
          style={{
            marginTop: 24,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <LogOut size={18} color={colors.textSecondary} />
          <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: "700", color: colors.textSecondary }}>
            Sign out
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

