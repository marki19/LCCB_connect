import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions, ScrollView, Image } from "react-native";
import { useState, useEffect } from "react";
import { supabase } from "../../src/lib/supabase";
import { Link, useRouter } from "expo-router";
import { Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isWeb, setIsWeb] = useState(false);

  // Validation States
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameError, setNameError] = useState("");
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
    if (fullName) setNameError("");
    setGeneralError("");
  }, [email, password, fullName]);

  async function signUpWithEmail() {
    let hasError = false;

    if (!fullName.trim()) {
      setNameError("Full Name is required");
      hasError = true;
    }

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
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);
    
    const { error, data } = await supabase.auth.signUp({ 
      email: email.trim().toLowerCase(), 
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        }
      }
    });
    
    if (error) {
      setGeneralError(error.message);
    } else {
      router.replace("/(auth)/login");
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <LinearGradient colors={["#EEF2FF", "#E0E7FF", "#FFFFFF"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }} showsVerticalScrollIndicator={false}>
          
          <View style={{ width: '100%', maxWidth: 450, padding: 24 }}>
            <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 32, padding: 32, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 5 }}>
              
              {/* Header */}
              <View style={{ alignItems: 'center', marginBottom: 32 }}>
                <View style={{ width: 64, height: 64, backgroundColor: 'white', borderRadius: 32, alignItems: 'center', justifyContent: 'center', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 3, marginBottom: 16 }}>
                  <Image source={require("../../assets/images/logo.jpg")} style={{ width: 44, height: 44, borderRadius: 22 }} resizeMode="cover" />
                </View>
                <Text style={{ color: '#1E1B4B', fontSize: 26, fontWeight: '800', textAlign: 'center' }}>Create account</Text>
                <Text style={{ color: '#64748B', fontSize: 13, marginTop: 8, textAlign: 'center' }}>Join LCCB Connect and showcase your academic portfolio.</Text>
              </View>

              {generalError ? (
                <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <AlertCircle color="#EF4444" size={20} />
                  <Text style={{ color: '#DC2626', fontWeight: '600', marginLeft: 12, flex: 1 }}>{generalError}</Text>
                </View>
              ) : null}

              {/* Name Input */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#334155', fontWeight: '700', fontSize: 12, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Full Name</Text>
                <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, paddingHorizontal: 16, height: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: nameError ? '#F87171' : '#E2E8F0' }}>
                  <TextInput
                    style={{ flex: 1, color: '#0F172A', fontSize: 16, fontWeight: '500', outlineStyle: 'none' } as any}
                    placeholder="Juan Dela Cruz"
                    placeholderTextColor="#94A3B8"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                </View>
                {nameError ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 4 }}>
                    <AlertCircle color="#F97316" size={14} />
                    <Text style={{ color: '#F97316', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>{nameError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Email Input */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#334155', fontWeight: '700', fontSize: 12, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Institutional Email</Text>
                <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, paddingHorizontal: 16, height: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: (showEmailFormatError || emailError) ? '#F87171' : '#E2E8F0' }}>
                  <TextInput
                    style={{ flex: 1, color: '#0F172A', fontSize: 16, fontWeight: '500', outlineStyle: 'none' } as any}
                    placeholder="student@lccb.edu.ph"
                    placeholderTextColor="#94A3B8"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                {(emailError || showEmailFormatError) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 4 }}>
                    <AlertCircle color="#F97316" size={14} />
                    <Text style={{ color: '#F97316', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>{emailError || "Must use an @lccb.edu.ph address"}</Text>
                  </View>
                ) : null}
              </View>

              {/* Password Input */}
              <View style={{ marginBottom: 32 }}>
                <Text style={{ color: '#334155', fontWeight: '700', fontSize: 12, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Password</Text>
                <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, paddingHorizontal: 16, height: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: passwordError ? '#F87171' : '#E2E8F0' }}>
                  <TextInput
                    style={{ flex: 1, color: '#0F172A', fontSize: 16, fontWeight: '500', outlineStyle: 'none' } as any}
                    placeholder="••••••••••••"
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                    {showPassword ? <EyeOff color="#94A3B8" size={20} /> : <Eye color="#94A3B8" size={20} />}
                  </TouchableOpacity>
                </View>
                {passwordError ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 4 }}>
                    <AlertCircle color="#F97316" size={14} />
                    <Text style={{ color: '#F97316', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>{passwordError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Sign Up Button */}
              <TouchableOpacity 
                style={{ backgroundColor: (loading || showEmailFormatError) ? '#818CF8' : '#4F46E5', height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                onPress={signUpWithEmail}
                disabled={loading || showEmailFormatError}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, marginRight: 8 }}>
                  {loading ? "Creating account..." : "Sign Up"}
                </Text>
                {!loading ? <ArrowRight color="#FFFFFF" size={20} /> : null}
              </TouchableOpacity>

              {/* Footer Link */}
              <View style={{ flexDirection: 'row', justifyItems: 'center', justifyContent: 'center', marginTop: 24 }}>
                <Text style={{ color: '#64748B', fontWeight: '500', fontSize: 14 }}>Already have an account? </Text>
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity>
                    <Text style={{ color: '#4F46E5', fontWeight: '700', fontSize: 14 }}>Sign in</Text>
                  </TouchableOpacity>
                </Link>
              </View>

            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}