import { View, Text, Image, Dimensions } from "react-native";
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeOut, Easing, withTiming } from "react-native-reanimated";

const { width } = Dimensions.get("window");

export default function SplashScreen() {
  const { session, initialized } = useAuth();
  const router = useRouter();
  
  // Layout scaling
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

  return (
    <View style={{ flex: 1, backgroundColor: "#061329", alignItems: "center", justifyContent: "center" }}>
      <LinearGradient
        colors={["#0A255C", "#061329", "#030A17"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
      />
      
      <Animated.View 
        entering={FadeIn.duration(800).easing(Easing.out(Easing.exp))} 
        exiting={FadeOut.duration(350)}
        style={{ alignItems: "center", paddingHorizontal: 24 }}
      >
        {/* Seal Container */}
        <View 
          style={{
            width: isWeb ? 160 : 124,
            height: isWeb ? 160 : 124,
            borderRadius: isWeb ? 80 : 62,
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            borderWidth: 1.5,
            borderColor: "rgba(255, 255, 255, 0.18)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            shadowColor: "#0540B0",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.45,
            shadowRadius: 28,
            elevation: 12,
            padding: 8,
          }}
        >
          <Image 
            source={require("../assets/images/logo-seal.png")} 
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        </View>

        {/* Institution Badge */}
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 5,
            borderRadius: 20,
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.14)",
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: "#93C5FD",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            La Consolacion College Bacolod
          </Text>
        </View>

        {/* Brand Name */}
        <Text 
          style={{
            fontSize: isWeb ? 46 : 34,
            fontWeight: "900",
            color: "#FFFFFF",
            letterSpacing: 1.5,
            textAlign: "center",
          }}
        >
          LCCB <Text style={{ color: "#60A5FA" }}>CONNECT</Text>
        </Text>

        {/* Tagline */}
        <Text 
          style={{
            fontSize: isWeb ? 15 : 13,
            color: "#94A3B8",
            fontWeight: "500",
            marginTop: 8,
            letterSpacing: 1.2,
            textAlign: "center",
          }}
        >
          Founded 1919 • Academic Network & Repository
        </Text>
      </Animated.View>
    </View>
  );
}
