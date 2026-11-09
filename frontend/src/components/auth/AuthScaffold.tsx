import type { ReactNode } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { BookOpen, ShieldCheck, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import Card from "../ui/Card";
import { RADIUS, SPACE } from "../../lib/tokens";

type AuthScaffoldProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

const VALUE_PROPS = [
  { icon: Users, title: "Stay connected", body: "Follow classmates, faculty, and department updates." },
  { icon: BookOpen, title: "Discover research", body: "Browse theses, capstones, and student projects." },
  { icon: ShieldCheck, title: "Campus only", body: "Institutional accounts keep the network trusted." },
];

export default function AuthScaffold({ title, subtitle, children, footer }: AuthScaffoldProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 960;

  const form = (
    <View style={{ width: "100%", maxWidth: 440 }}>
      {!isDesktop ? (
        <View style={{ alignItems: "center", marginBottom: SPACE.x6 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: RADIUS.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: SPACE.x3,
            }}
          >
            <Image
              source={require("../../../assets/images/logo-seal.png")}
              style={{ width: 40, height: 40 }}
              resizeMode="contain"
            />
          </View>
          <Text style={{ fontSize: 18, fontWeight: "600", letterSpacing: -0.3, color: colors.textPrimary }}>
            LCCB Connect
          </Text>
          <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>
            La Consolacion College Bacolod
          </Text>
        </View>
      ) : null}

      <Card padding={isDesktop ? SPACE.x8 : SPACE.x6} elevated={isDesktop}>
        <Text
          style={{
            fontSize: isDesktop ? 26 : 24,
            lineHeight: isDesktop ? 32 : 30,
            fontWeight: "600",
            letterSpacing: -0.5,
            color: colors.textPrimary,
          }}
        >
          {title}
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginTop: SPACE.x1, marginBottom: SPACE.x6 }}>
          {subtitle}
        </Text>
        {children}
      </Card>

      {footer ? <View style={{ marginTop: SPACE.x5 }}>{footer}</View> : null}
    </View>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.surfacePage }}>
        <View
          style={{
            width: "44%",
            maxWidth: 620,
            backgroundColor: colors.brandDeep,
            paddingHorizontal: SPACE.x12,
            paddingVertical: SPACE.x12,
            justifyContent: "space-between",
            overflow: "hidden",
          }}
        >
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x3 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: RADIUS.md,
                  backgroundColor: "rgba(255,255,255,0.10)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.18)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Image
                  source={require("../../../assets/images/logo-seal.png")}
                  style={{ width: 32, height: 32 }}
                  resizeMode="contain"
                />
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: "600", color: "#FFFFFF", letterSpacing: -0.3 }}>
                  LCCB Connect
                </Text>
                <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.62)", marginTop: 2 }}>
                  Campus network
                </Text>
              </View>
            </View>

            <Text
              style={{
                fontSize: 40,
                lineHeight: 46,
                fontWeight: "600",
                letterSpacing: -1,
                color: "#FFFFFF",
                marginTop: SPACE.x16,
                maxWidth: 420,
              }}
            >
              The campus network for LCCB.
            </Text>
            <Text
              style={{
                fontSize: 15,
                lineHeight: 24,
                color: "rgba(255,255,255,0.74)",
                marginTop: SPACE.x4,
                maxWidth: 400,
              }}
            >
              Share your work, discover research, and stay close to the people building things on campus.
            </Text>

            <View style={{ marginTop: SPACE.x10, gap: SPACE.x5 }}>
              {VALUE_PROPS.map(({ icon: Icon, title: itemTitle, body }) => (
                <View key={itemTitle} style={{ flexDirection: "row", alignItems: "flex-start", gap: SPACE.x3 }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: RADIUS.md,
                      backgroundColor: "rgba(255,255,255,0.10)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={17} color="#BFDBFE" strokeWidth={2.1} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}>{itemTitle}</Text>
                    <Text style={{ fontSize: 13, lineHeight: 20, color: "rgba(255,255,255,0.62)", marginTop: 1 }}>
                      {body}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.46)" }}>
            La Consolacion College Bacolod
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: SPACE.x8,
            paddingVertical: SPACE.x10,
          }}
          showsVerticalScrollIndicator={false}
        >
          {form}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: insets.top + SPACE.x6,
          paddingBottom: insets.bottom + SPACE.x6,
          paddingHorizontal: SPACE.x5,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {form}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
