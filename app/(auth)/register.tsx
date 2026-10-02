import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions, ScrollView } from "react-native";
import { useState, useEffect } from "react";
import { supabase } from "../../src/lib/supabase";
import { Link, useRouter } from "expo-router";
import { Eye, EyeOff, AlertCircle, ChevronDown, CheckCircle2 } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isWeb, setIsWeb] = useState(false);
  const [role, setRole] = useState("student"); 
  const [agreed, setAgreed] = useState(false);

  // Validation States
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const isValidEmailDomain = email.trim().toLowerCase().endsWith("@lccb.edu.ph");
  const showEmailFormatError = email.length > 0 && !isValidEmailDomain && role !== "industry_partner";

  useEffect(() => {
    const handleResize = () => setIsWeb(Dimensions.get("window").width > 768);
    handleResize(); 
    const subscription = Dimensions.addEventListener("change", handleResize);
    return () => subscription?.remove();
  }, []);

  // Clear errors when typing
  useEffect(() => {
    if (fullName) setNameError("");
    if (email) setEmailError("");
    if (password) setPasswordError("");
    if (confirmPassword) setConfirmError("");
    setGeneralError("");
  }, [fullName, email, password, confirmPassword]);

  async function signUpWithEmail() {
    let hasError = false;
    
    if (!fullName.trim()) {
      setNameError("Full Name is required");
      hasError = true;
    }
    
    if (!email.trim()) {
      setEmailError("Email is required");
      hasError = true;
    } else if (!isValidEmailDomain && role !== "industry_partner") {
      setEmailError("Must be an @lccb.edu.ph address");
      hasError = true;
    }
    
    if (!password) {
      setPasswordError("Password is required");
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      hasError = true;
    }

    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match");
      hasError = true;
    }

    if (!agreed) {
      setGeneralError("Please agree to the Terms & Conditions");
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: fullName.trim(), role: role } },
    });
    
    if (error) {
      setGeneralError(error.message);
    } else {
      // Fallback: manually insert profile in case Postgres trigger isn't set up yet
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
          role: role,
        }, { onConflict: 'id' });
      }
      router.replace("/(auth)/login");
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-[#F1F5F9]">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false}>
        <View className={isWeb ? "flex-1 justify-center items-center p-8" : "flex-1 bg-white pt-10"}>
          <View className={isWeb ? "w-full max-w-[450px] bg-white rounded-[32px] shadow-2xl overflow-hidden py-4" : "w-full flex-1"}>
            
            <View className="w-full max-w-md mx-auto py-8 px-6 sm:px-10">
              
              {/* Header */}
              <Animated.View entering={FadeInDown.duration(600).springify()} className="flex-row items-center mb-8">
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity className="mr-4">
                    <Text className="text-slate-800 text-2xl font-light">←</Text>
                  </TouchableOpacity>
                </Link>
                <Text className="text-slate-900 text-2xl font-medium tracking-tight">Create Account</Text>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(100).duration(600).springify()} className="space-y-5">
                
                {generalError ? (
                  <View className="bg-red-50 rounded-2xl p-4 flex-row items-center mb-2">
                    <AlertCircle color="#EF4444" size={20} />
                    <Text className="text-red-600 font-medium ml-3 flex-1">{generalError}</Text>
                  </View>
                ) : null}

                {/* Full Name */}
                <View>
                  <Text className="text-slate-800 font-semibold mb-2 ml-1">Full Name</Text>
                  <View className={`bg-[#F4F6F8] rounded-full px-5 py-4 flex-row items-center border ${nameError ? 'border-red-400' : 'border-transparent focus:border-blue-500'} transition-colors`}>
                    <TextInput
                      className="flex-1 text-slate-900 text-base font-medium outline-none"
                      placeholder="Juan Dela Cruz"
                      placeholderTextColor="#94A3B8"
                      value={fullName}
                      onChangeText={setFullName}
                    />
                  </View>
                  {nameError ? (
                    <View className="flex-row items-center mt-2 ml-2">
                      <AlertCircle color="#F97316" size={14} />
                      <Text className="text-orange-500 text-xs ml-1 font-medium">{nameError}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Email */}
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
                    />
                  </View>
                  {(emailError || showEmailFormatError) && (
                    <View className="flex-row items-center mt-2 ml-2">
                      <AlertCircle color="#F97316" size={14} />
                      <Text className="text-orange-500 text-xs ml-1 font-medium">{emailError || "Please use your professional email address"}</Text>
                    </View>
                  )}
                </View>

                {/* Role Selection (Simplified mock up like reference) */}
                <View>
                  <Text className="text-slate-800 font-semibold mb-2 ml-1">Role</Text>
                  <View className="bg-white rounded-full px-5 py-4 flex-row items-center border border-[#1D4ED8]">
                    <Text className="flex-1 text-slate-900 text-base font-medium">Student</Text>
                    <ChevronDown color="#1D4ED8" size={20} />
                  </View>
                </View>

                {/* Password */}
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
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-1">
                      {showPassword ? <EyeOff color="#94A3B8" size={20} /> : <Eye color="#94A3B8" size={20} />}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password */}
                <View>
                  <Text className="text-slate-800 font-semibold mb-2 ml-1">Confirm Password</Text>
                  <View className={`bg-[#F4F6F8] rounded-full px-5 py-4 flex-row items-center border ${confirmError ? 'border-red-400' : 'border-transparent focus:border-blue-500'} transition-colors`}>
                    <TextInput
                      className="flex-1 text-slate-900 text-base font-medium outline-none pr-2"
                      placeholder="••••••••••••"
                      placeholderTextColor="#94A3B8"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                    />
                  </View>
                  {confirmError && (
                    <View className="flex-row items-center mt-2 ml-2">
                      <AlertCircle color="#F97316" size={14} />
                      <Text className="text-orange-500 text-xs ml-1 font-medium">{confirmError}</Text>
                    </View>
                  )}
                </View>

                {/* Terms Agreement */}
                <TouchableOpacity 
                  className="flex-row items-center mt-4 mb-2" 
                  onPress={() => setAgreed(!agreed)}
                  activeOpacity={0.7}
                >
                  {agreed ? (
                    <CheckCircle2 color="#1D4ED8" size={20} />
                  ) : (
                    <View className="w-5 h-5 rounded-full border border-slate-300 bg-[#F4F6F8]" />
                  )}
                  <Text className="ml-3 text-slate-600 text-sm">
                    I agree to the <Text className="text-[#1D4ED8] font-medium">Terms & Conditions</Text> and <Text className="text-[#1D4ED8] font-medium">Privacy Policy</Text>
                  </Text>
                </TouchableOpacity>

                {/* Submit Button */}
                <View className="mt-6 mb-8">
                  <TouchableOpacity 
                    className={`w-full py-4 rounded-full flex-row justify-center items-center shadow-lg ${loading ? 'bg-blue-400' : 'bg-[#1D4ED8] shadow-blue-600/30'}`}
                    onPress={signUpWithEmail}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Text className="text-white font-semibold text-lg">
                      {loading ? "Creating Account..." : "Create Account"}
                    </Text>
                  </TouchableOpacity>
                </View>

              </Animated.View>
            </View>

          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}