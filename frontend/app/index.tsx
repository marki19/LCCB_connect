import { useEffect } from "react";
import { View, Text, Image, useWindowDimensions, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../src/contexts/AuthContext";
import { DARK_TOKENS, RADIUS, SPACE, TYPE } from "../src/lib/tokens";
import Reveal from "../src/components/ui/Reveal";

/**
 * Brand splash. Deliberately fixed to the dark institutional palette so the
 * first paint is identical regardless of the user's saved theme, and so the
 * seal has the contrast it was designed for.
 */
export default function SplashScreen() {
  const { session, initialized } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = width > 768;

  useEffect(() => {
    // Wait for the auth provider to initialize
    if (!initialized) return;

    // Minimum delay of 1800ms so the user sees the crisp institutional branding
    const timer = setTimeout(() => {
      if (session) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(auth)/login");
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, [initialized, session, router]);

  const t = DARK_TOKENS;
  const sealSize = isWeb ? 156 : 124;

  return (
    <View style={{ flex: 1, backgroundColor: t.surfacePage, alignItems: "center", justifyContent: "center" }}>
      <LinearGradient
        colors={[t.heroFrom, t.navBg, t.surfacePage]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
      />

      <Reveal style={{ alignItems: "center", paddingHorizontal: SPACE.x6 }} distance={16}>
        {/* Seal */}
        <View
          style={{
            width: sealSize,
            height: sealSize,
            borderRadius: sealSize / 2,
            backgroundColor: t.navHoverBg,
            borderWidth: 1.5,
            borderColor: t.navLine,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: SPACE.x6,
            padding: SPACE.x2,
            shadowColor: t.heroGlow,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.45,
            shadowRadius: 28,
            elevation: 12,
          }}
        >
          <Image
            source={require("../assets/images/logo-seal.png")}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        </View>

        {/* Institution badge */}
        <View
          style={{
            paddingHorizontal: SPACE.x4,
            paddingVertical: 5,
            borderRadius: RADIUS.pill,
            backgroundColor: t.navHoverBg,
            borderWidth: 1,
            borderColor: t.navLine,
            marginBottom: SPACE.x3,
          }}
        >
          <Text
            style={{
              ...TYPE.micro,
              color: t.brandBright,
              letterSpacing: 2,
            }}
          >
            La Consolacion College Bacolod
          </Text>
        </View>

        {/* Wordmark */}
        <Text
          style={{
            fontSize: isWeb ? 46 : 34,
            lineHeight: isWeb ? 52 : 40,
            fontWeight: "900",
            color: t.inkOnDark,
            letterSpacing: 1.5,
            textAlign: "center",
          }}
        >
          LCCB <Text style={{ color: t.brandBright }}>CONNECT</Text>
        </Text>

        <Text
          style={{
            ...TYPE.caption,
            fontSize: isWeb ? 15 : 13,
            color: t.navText,
            fontWeight: "500",
            marginTop: SPACE.x2,
            letterSpacing: 1.2,
            textAlign: "center",
          }}
        >
          Founded 1919 • Academic Network & Repository
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.x2,
            marginTop: SPACE.x8,
          }}
        >
          <ActivityIndicator accessibilityLabel="Loading" size="small" color={t.brandBright} />
          <Text style={{ ...TYPE.caption, color: t.navText }}>Preparing your campus…</Text>
        </View>
      </Reveal>
    </View>
  );
}
