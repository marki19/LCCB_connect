import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions, ScrollView, Image } from "react-native";
import { useState, useEffect } from "react";
import { supabase } from "../../src/lib/supabase";
import { Link, useRouter } from "expo-router";
import { Eye, EyeOff, AlertCircle } from "lucide-react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useAuth } from "../../src/contexts/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { signInAsGuest } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isWeb, setIsWeb] = useState(false);

  // Validation States
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const isValidEmailDomain = email.trim().toLowerCase().endsWith("@lccb.edu.ph");
  const showEmailFormatError = email.length > 0 && !isValidEmailDomain;

  useEffect(() => {
    const handleResize = () => setIsWeb(Dimensions.get("window").width > 768);
    handleResize(); 
    const subscription = Dimensions.addEventListener("change", handleResize);
    return () => subscription?.remove();
  }, []);

  // Clear errors when user types
  useEffect(() => {
    if (email) setEmailError("");
    if (password) setPasswordError("");
    setGeneralError("");
  }, [email, password]);

  async function signInWithEmail() {
    let hasError = false;
    if (!email.trim()) {
      setEmailError("Email is required");
      hasError = true;
    } else if (!isValidEmailDomain) {
      setEmailError("Must be an @lccb.edu.ph address");
      hasError = true;
    }
    
    if (!password) {
      setPasswordError("Password is required");
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    
    if (error) {
      setGeneralError(error.message); // Show exact error from Supabase
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-[#F1F5F9]">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false}>
        <View className={isWeb ? "flex-1 justify-center items-center p-8" : "flex-1 bg-white pt-10"}>
          <View className={isWeb ? "w-full max-w-[450px] bg-white rounded-[32px] shadow-2xl overflow-hidden py-4" : "w-full flex-1"}>
            
            <View className="w-full max-w-md mx-auto py-8 px-6 sm:px-10">
              {/* Header Logo & App Name */}
              <Animated.View entering={FadeInDown.duration(600).springify()} className="flex-row items-center justify-between mb-12">
                <View className="w-14 h-14 bg-blue-50 rounded-full items-center justify-center">
                  <Image source={require("../../assets/images/logo.jpg")} className="w-8 h-8 rounded-full" resizeMode="cover" />
                </View>
                <Text className="text-slate-400 font-medium text-xs tracking-widest uppercase">LCCB Connect</Text>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(100).duration(600).springify()} className="space-y-6">
                
                {generalError ? (
                  <View className="bg-red-50 rounded-2xl p-4 flex-row items-center mb-2">
                    <AlertCircle color="#EF4444" size={20} />
                    <Text className="text-red-600 font-medium ml-3 flex-1">{generalError}</Text>
                  </View>
                ) : null}

                {/* Email Input */}
                <View>
                  <Text className="text-slate-800 font-semibold mb-2 ml-1">Institutional Email</Text>
                  <View className={`bg-[#F4F6F8] rounded-full px-5 py-4 flex-row items-center border ${(emailError || showEmailFormatError) ? 'border-red-400' : 'border-transparent focus:border-blue-500'} transition-colors`}>
                    <TextInput
                      className="flex-1 text-slate-900 text-base font-medium outline-none"
                      placeholder="student@lccb.edu.ph"
                      placeholderTextColor="#94A3B8"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      accessibilityLabel="Institutional Email Input"
                      autoComplete="email"
                    />
                  </View>
                  {(emailError || showEmailFormatError) && (
                    <View className="flex-row items-center mt-2 ml-2">
                      <AlertCircle color="#F97316" size={14} />
                      <Text className="text-orange-500 text-xs ml-1 font-medium">{emailError || "Please use your professional institutional email address"}</Text>
                    </View>
                  )}
                </View>

                {/* Password Input */}
                <View>
                  <Text className="text-slate-800 font-semibold mb-2 ml-1">Password</Text>
                  <View className={`bg-[#F4F6F8] rounded-full px-5 py-4 flex-row items-center border ${passwordError ? 'border-red-400' : 'border-transparent focus:border-blue-500'} transition-colors`}>
                    <TextInput
                      className="flex-1 text-slate-900 text-base font-medium outline-none pr-2"
                      placeholder="••••••••••••"
                      placeholderTextColor="#94A3B8"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      accessibilityLabel="Password Input"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} accessibilityLabel="Toggle password visibility" className="p-1">
                      {showPassword ? <EyeOff color="#94A3B8" size={20} /> : <Eye color="#94A3B8" size={20} />}
                    </TouchableOpacity>
                  </View>
                  {passwordError && (
                    <View className="flex-row items-center mt-2 ml-2">
                      <AlertCircle color="#F97316" size={14} />
                      <Text className="text-orange-500 text-xs ml-1 font-medium">{passwordError}</Text>
                    </View>
                  )}
                </View>

                {/* Sign In Button */}
                <View className="mt-8">
                  <TouchableOpacity 
                    className={`w-full py-4 rounded-full flex-row justify-center items-center shadow-lg ${loading ? 'bg-blue-400' : 'bg-[#1D4ED8] shadow-blue-600/30'}`}
                    onPress={signInWithEmail}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Text className="text-white font-semibold text-lg">
                      {loading ? "Authenticating..." : "Sign In"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity className="items-center mt-4">
                  <Text className="text-[#1D4ED8] font-semibold text-sm">Forgot Password?</Text>
                </TouchableOpacity>

                {/* Divider */}
                <View className="flex-row items-center my-6">
                  <View className="flex-1 h-[1px] bg-slate-200" />
                  <Text className="mx-4 text-slate-400 font-medium text-sm">Or</Text>
                  <View className="flex-1 h-[1px] bg-slate-200" />
                </View>

                {/* Guest Button */}
                <TouchableOpacity 
                  className="w-full py-4 rounded-full flex-row justify-center items-center bg-[#F4F6F8] mb-4"
                  onPress={signInAsGuest}
                  activeOpacity={0.7}
                >
                  <Text className="text-slate-700 font-semibold text-base">
                    Continue as Guest
                  </Text>
                </TouchableOpacity>
                
                {/* Footer Link */}
                <View className="flex-row justify-center mt-4 mb-8">
                  <Text className="text-slate-600 font-medium text-sm">Don't have an account? </Text>
                  <Link href="/(auth)/register" asChild>
                    <TouchableOpacity>
                      <Text className="text-[#1D4ED8] font-semibold text-sm">Sign up</Text>
                    </TouchableOpacity>
                  </Link>
                </View>

                <View className="items-center mt-8">
                  <Text className="text-slate-400 text-xs">© 2026 LCCB Connect.Inc</Text>
                </View>
              </Animated.View>
            </View>

          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}