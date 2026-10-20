import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions, ScrollView, Image } from "react-native";
import { useState, useEffect } from "react";
import { supabase } from "../../src/lib/supabase";
import { Link, useRouter } from "expo-router";
import { Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";

export default function LoginScreen() {
  const router = useRouter();
  const { signInAsGuest } = useAuth();
  const { colors, isDark } = useTheme();
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
      setGeneralError(error.message);
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <LinearGradient colors={isDark ? ["hsl(215, 30%, 10%)", "hsl(215, 28%, 13%)", "hsl(215, 25%, 9%)"] : ["#EEF2FF", "#E0E7FF", "#FFFFFF"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }} showsVerticalScrollIndicator={false}>
          
          <View style={{ width: '100%', maxWidth: 450, padding: 24 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 32, padding: 32, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: isDark ? 0.3 : 0.08, shadowRadius: 20, elevation: 5 }}>
              
              {/* Header Logo & App Name */}
              <View style={{ alignItems: 'center', marginBottom: 32 }}>
                <View style={{ width: 80, height: 80, backgroundColor: colors.actionSurfaceAlt, borderRadius: 40, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 3, marginBottom: 16 }}>
                  <Image source={require("../../assets/images/logo.jpg")} style={{ width: 60, height: 60, borderRadius: 30 }} resizeMode="cover" />
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: 28, fontWeight: '800' }}>Welcome back</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 8, textAlign: 'center' }}>Sign in to LCCB Connect to continue to your academic portfolio.</Text>
              </View>

              {generalError ? (
                <View style={{ backgroundColor: isDark ? 'hsl(0, 30%, 15%)' : '#FEF2F2', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <AlertCircle color="#EF4444" size={20} />
                  <Text style={{ color: isDark ? 'hsl(0, 80%, 80%)' : '#DC2626', fontWeight: '600', marginLeft: 12, flex: 1 }}>{generalError}</Text>
                </View>
              ) : null}

              {/* Email Input */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Institutional Email</Text>
                <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: 16, paddingHorizontal: 16, height: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: (showEmailFormatError || emailError) ? '#F87171' : colors.border }}>
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: '500', outlineStyle: 'none' } as any}
                    placeholder="student@lccb.edu.ph"
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={(text) => { setEmail(text); if (text) setEmailError(""); setGeneralError(""); }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                {(emailError || showEmailFormatError) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 4 }}>
                    <AlertCircle color="#F97316" size={14} />
                    <Text style={{ color: '#F97316', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>{emailError || "Please use your institutional email"}</Text>
                  </View>
                ) : null}
              </View>

              {/* Password Input */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Password</Text>
                <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: 16, paddingHorizontal: 16, height: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: passwordError ? '#F87171' : colors.border }}>
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: '500', outlineStyle: 'none' } as any}
                    placeholder="••••••••••••"
                    placeholderTextColor={colors.textTertiary}
                    value={password}
                    onChangeText={(text) => { setPassword(text); if (text) setPasswordError(""); setGeneralError(""); }}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                    {showPassword ? <EyeOff color={colors.textTertiary} size={20} /> : <Eye color={colors.textTertiary} size={20} />}
                  </TouchableOpacity>
                </View>
                {passwordError ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 4 }}>
                    <AlertCircle color="#F97316" size={14} />
                    <Text style={{ color: '#F97316', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>{passwordError}</Text>
                  </View>
                ) : null}
                <TouchableOpacity style={{ alignSelf: 'flex-end', marginTop: 12 }}>
                  <Text style={{ color: colors.action, fontWeight: '700', fontSize: 13 }}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              {/* Sign In Button */}
              <TouchableOpacity 
                style={{ backgroundColor: loading ? colors.surfaceSunken : colors.action, height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: colors.action, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                onPress={signInWithEmail}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, marginRight: 8 }}>
                  {loading ? "Authenticating..." : "Sign In"}
                </Text>
                {!loading ? <ArrowRight color="#FFFFFF" size={20} /> : null}
              </TouchableOpacity>

              {/* Divider */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 16 }}>Or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>

              {/* Guest Button */}
              <TouchableOpacity 
                style={{ backgroundColor: colors.surfaceSunken, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
                onPress={signInAsGuest}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15 }}>Explore as Guest</Text>
              </TouchableOpacity>
              
              {/* Footer Link */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
                <Text style={{ color: colors.textTertiary, fontWeight: '500', fontSize: 14 }}>Don&apos;t have an account? </Text>
                <Link href="/(auth)/register" asChild>
                  <TouchableOpacity>
                    <Text style={{ color: colors.action, fontWeight: '700', fontSize: 14 }}>Create one</Text>
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