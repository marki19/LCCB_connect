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
  
  // We determine if it's web just for layout scaling
  const isWeb = width > 768;

  useEffect(() => {
    // Wait for the auth provider to initialize
    if (!initialized) return;

    // Minimum delay of 2000ms (2 seconds) so the user actually sees the splash screen
    const timer = setTimeout(() => {
      if (session) {
        // Later we will route to specific role home screens here if needed
        router.replace("/(tabs)");
      } else {
        router.replace("/(auth)/login");
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [initialized, session, router]);

  return (
    <View className="flex-1 bg-white items-center justify-center">
      <LinearGradient
        colors={['#1F2023', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />
      
      <Animated.View 
        entering={FadeIn.duration(800).easing(Easing.out(Easing.exp))} 
        exiting={FadeOut.duration(400)}
        className="items-center"
      >
        <View className={`bg-white rounded-3xl items-center justify-center shadow-2xl mb-8 overflow-hidden ${isWeb ? 'w-48 h-48' : 'w-36 h-36'}`}>
          <Image 
            source={require("../assets/images/logo.jpg")} 
            className="w-full h-full"
            resizeMode="cover"
          />
        </View>
        <Text className={`${isWeb ? 'text-6xl' : 'text-4xl'} font-black text-white tracking-widest`}>
          LCCB
        </Text>
        <Text className={`${isWeb ? 'text-2xl' : 'text-lg'} text-blue-300 font-medium mt-2 tracking-[0.2em]`}>
          CONNECT
        </Text>
      </Animated.View>
    </View>
  );
}
