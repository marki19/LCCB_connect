import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Dimensions, ScrollView } from "react-native";
import { useState, useEffect } from "react";
import { supabase } from "../../src/lib/supabase";
import { Link, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Mail, Lock, User, Check, ArrowRight } from "lucide-react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isWeb, setIsWeb] = useState(false);
  const [role, setRole] = useState("student"); 

  useEffect(() => {
    const handleResize = () => setIsWeb(Dimensions.get("window").width > 850);
    handleResize(); 
    const subscription = Dimensions.addEventListener("change", handleResize);
    return () => subscription?.remove();
  }, []);

  async function signUpWithEmail() {
    if (!fullName || !email || !password) {
      Alert.alert("Required", "Please fill in all fields");
      return;
    }
    if (!email.includes("@lccb.edu.ph") && role !== "industry_partner") {
      Alert.alert("Invalid Email", "Please use your LCCB institutional email.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: role } },
    });
    if (error) {
      Alert.alert("Registration Error", error.message);
    } else {
      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: fullName,
          role: role,
        });
      }
      Alert.alert("Success", "Account created! You can now log in.");
      router.back();
    }
    setLoading(false);
  }

  const LeftPanelContent = () => (
    <View className="flex-1 justify-between p-12">
      <View>
        <Animated.View entering={FadeInDown.duration(600).springify()} className="flex-row items-center mb-16">
          <View className="w-8 h-8 rounded-lg bg-white/20 items-center justify-center mr-3">
             <Text className="text-white font-bold text-xl">L</Text>
          </View>
          <Text className="text-white font-bold text-xl tracking-widest">LCCB CONNECT</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(600).springify()} className="bg-white/20 self-start px-4 py-2 rounded-full mb-6 flex-row items-center">
          <Text className="text-white font-medium mr-2">Join Us to Build</Text>
          <Text>🚀</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(600).springify()}>
          <Text className="text-5xl font-bold text-white mb-4">Start your Journey</Text>
          <Text className="text-blue-100 text-lg">Follow these simple steps to set up your account and start connecting.</Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInUp.delay(400).duration(800).springify()} className="flex-row space-x-4 mt-12 w-full">
        <View className="flex-1 bg-white p-5 rounded-3xl shadow-xl shadow-blue-900/20">
          <View className="w-8 h-8 rounded-full bg-blue-600 items-center justify-center mb-4">
            <Text className="text-white font-bold">1</Text>
          </View>
          <Text className="font-bold text-slate-800">Register account</Text>
        </View>
        
        <View className="flex-1 bg-white/10 border border-white/20 p-5 rounded-3xl">
          <View className="w-8 h-8 rounded-full bg-white/20 items-center justify-center mb-4">
            <Text className="text-white font-bold">2</Text>
          </View>
          <Text className="font-medium text-white/70">Setup profile</Text>
        </View>

        <View className="flex-1 bg-white/10 border border-white/20 p-5 rounded-3xl">
          <View className="w-8 h-8 rounded-full bg-white/20 items-center justify-center mb-4">
            <Text className="text-white font-bold">3</Text>
          </View>
          <Text className="font-medium text-white/70">Verify identity</Text>
        </View>
      </Animated.View>
    </View>
  );

  const FormContent = () => (
    <View className="flex-1 justify-center px-8 sm:px-12 w-full max-w-lg mx-auto py-10">
      <Animated.View entering={FadeInDown.duration(600).springify()} className="mb-10 items-center">
        <View className="w-16 h-16 bg-blue-50 rounded-2xl items-center justify-center mb-6">
          <User color="#1D4ED8" size={32} />
        </View>
        <Text className="text-3xl font-black text-slate-900 tracking-tight">Create Account</Text>
        <Text className="text-slate-500 font-medium mt-2">Join the LCCB Connect community</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(600).springify()} className="space-y-4">
        <View>
          <Text className="text-sm font-bold text-slate-700 mb-2 ml-1">Full Name</Text>
          <View className="flex-row items-center bg-[#F8FAFC] border border-slate-200 rounded-2xl px-5 py-4 focus:border-blue-500">
            <User color="#94A3B8" size={20} className="mr-3" />
            <TextInput
              className="flex-1 text-slate-900 text-base font-medium outline-none"
              placeholder="Juan Dela Cruz"
              placeholderTextColor="#94A3B8"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>
        </View>

        <View>
          <Text className="text-sm font-bold text-slate-700 mb-2 ml-1">Institutional Email</Text>
          <View className="flex-row items-center bg-[#F8FAFC] border border-slate-200 rounded-2xl px-5 py-4 focus:border-blue-500">
            <Mail color="#94A3B8" size={20} className="mr-3" />
            <TextInput
              className="flex-1 text-slate-900 text-base font-medium outline-none"
              placeholder="student@lccb.edu.ph"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {email.includes("@lccb.edu.ph") && <Check color="#10B981" size={20} />}
          </View>
        </View>

        <View>
          <Text className="text-sm font-bold text-slate-700 mb-2 ml-1">Password</Text>
          <View className="flex-row items-center bg-[#F8FAFC] border border-slate-200 rounded-2xl px-5 py-4 focus:border-blue-500">
            <Lock color="#94A3B8" size={20} className="mr-3" />
            <TextInput
              className="flex-1 text-slate-900 text-base font-medium outline-none"
              placeholder="••••••••••••"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
          <Text className="text-xs text-slate-400 mt-2 ml-1">Must be at least 6 characters.</Text>
        </View>

        <TouchableOpacity 
          className={`w-full py-4 rounded-2xl flex-row justify-center items-center mt-6 shadow-md ${loading ? 'bg-[#3B82F6]/70' : 'bg-[#1D4ED8]'}`}
          onPress={signUpWithEmail}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text className="text-white font-bold text-lg mr-2">
            {loading ? "Creating Account..." : "Create Account"}
          </Text>
          {!loading && <ArrowRight color="#FFFFFF" size={20} />}
        </TouchableOpacity>
        
        <View className="flex-row justify-center mt-6">
          <Text className="text-slate-500 font-medium">Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text className="text-[#1D4ED8] font-bold">Log in</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </Animated.View>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-[#1A1A1A]">
      {isWeb ? (
        <View className="flex-1 justify-center items-center p-8 bg-[#F1F5F9]">
          <View className="flex-row w-full max-w-[1100px] h-full max-h-[750px] bg-white rounded-[32px] shadow-2xl p-2 overflow-hidden">
            <LinearGradient
              colors={['#1D4ED8', '#1E3A8A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="flex-[1.1] rounded-[24px] overflow-hidden shadow-lg shadow-blue-500/20"
            >
              <LeftPanelContent />
            </LinearGradient>
            
            <View className="flex-1 justify-center bg-white rounded-r-[24px]">
              <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false}>
                <FormContent />
              </ScrollView>
            </View>
          </View>
        </View>
      ) : (
        <View className="flex-1 bg-white">
          <LinearGradient
            colors={['#1D4ED8', '#1E3A8A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="h-[45%] w-full justify-end px-8 pb-16 absolute top-0"
          >
            <Animated.View entering={FadeInDown.duration(600).springify()}>
              <View className="bg-white/20 self-start px-3 py-1.5 rounded-full mb-4 flex-row items-center">
                <Text className="text-white font-medium text-xs mr-2">Join Us to Build</Text>
                <Text className="text-xs">🚀</Text>
              </View>
              <Text className="text-4xl font-black text-white mb-2">Start your Journey</Text>
              <Text className="text-blue-100 font-medium text-base">Set up your account and start connecting.</Text>
            </Animated.View>
          </LinearGradient>
          
          <View className="flex-1 mt-[60%] bg-white rounded-t-[40px] overflow-hidden shadow-2xl pt-2">
            <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
              <FormContent />
            </ScrollView>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}