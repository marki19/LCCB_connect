import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LogOut, ShieldAlert } from "lucide-react-native";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { RADIUS, SPACE, TYPE } from "../src/lib/tokens";
import Button from "../src/components/ui/Button";
import Card from "../src/components/ui/Card";
import Reveal from "../src/components/ui/Reveal";

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }} edges={["top"]}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: SPACE.x6 }}>
        <Reveal style={{ width: "100%", maxWidth: 520, alignSelf: "center" }}>
          <Card style={{ padding: SPACE.x8 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: RADIUS.lg,
                backgroundColor: colors.coralWash,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: SPACE.x5,
              }}
            >
              <ShieldAlert size={28} color={colors.coralText} />
            </View>

            <Text style={{ ...TYPE.h1, color: colors.ink }}>Account suspended</Text>
            <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
              This account cannot use LCCB Connect while the suspension is active.
            </Text>

            <View
              style={{
                marginTop: SPACE.x6,
                borderRadius: RADIUS.md,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.panelInset,
                padding: SPACE.x4,
              }}
            >
              <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>Reason</Text>
              <Text style={{ ...TYPE.body, color: colors.ink, marginTop: SPACE.x1 }}>
                {profile?.suspension_reason || "No reason was recorded."}
              </Text>
              <Text
                style={{
                  ...TYPE.micro,
                  color: colors.inkFaint,
                  marginTop: SPACE.x4,
                }}
              >
                Duration
              </Text>
              <Text style={{ ...TYPE.body, color: colors.ink, marginTop: SPACE.x1 }}>
                {formatUntil(profile?.suspended_until)}
              </Text>
            </View>

            <View style={{ marginTop: SPACE.x6 }}>
              <Button
                label="Sign out"
                icon={LogOut}
                variant="secondary"
                fullWidth
                onPress={() => void handleSignOut()}
              />
            </View>
          </Card>
        </Reveal>
      </View>
    </SafeAreaView>
  );
}
