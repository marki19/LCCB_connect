import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { LogOut, Shield, ChevronDown } from "lucide-react-native";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { RADIUS, SPACE, TYPE } from "../src/lib/tokens";
import Button from "../src/components/ui/Button";
import Card from "../src/components/ui/Card";
import { declareGuest, type AffiliationType } from "../src/lib/verification";

const AFFILIATION_OPTIONS: { value: AffiliationType; label: string; desc: string }[] = [
  {
    value: "student_elsewhere",
    label: "Student at another institution",
    desc: "Enrolled in an external college or university.",
  },
  {
    value: "faculty_elsewhere",
    label: "Faculty / Educator",
    desc: "Teaching or academic staff from another institution.",
  },
  {
    value: "researcher",
    label: "Researcher",
    desc: "Conducting academic, institutional, or scientific research.",
  },
  {
    value: "professional",
    label: "Industry Professional / Partner",
    desc: "Working in industry, community partner, or collaborator.",
  },
  {
    value: "other",
    label: "Other",
    desc: "Other purpose or external affiliation.",
  },
];

export default function GuestDeclarationScreen() {
  const router = useRouter();
  const { profile, signOut, refreshProfile } = useAuth();
  const { colors } = useTheme();

  const [affiliationType, setAffiliationType] = useState<AffiliationType>("researcher");
  const [affiliationName, setAffiliationName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const trimmedAffiliation = affiliationName.trim();
    const trimmedPurpose = purpose.trim();
    const trimmedLocation = location.trim();

    if (!trimmedAffiliation) {
      setError("Please specify your school, company, or organization.");
      return;
    }
    if (!trimmedPurpose) {
      setError("Please describe your purpose for requesting guest access.");
      return;
    }

    try {
      setLoading(true);
      await declareGuest({
        affiliation_type: affiliationType,
        affiliation_name: trimmedAffiliation,
        purpose: trimmedPurpose,
        location: trimmedLocation || undefined,
      });

      await refreshProfile();
      router.replace("/pending-review" as any);
    } catch (err: any) {
      console.error("Guest declaration failed:", err);
      setError(err?.message || "Failed to submit request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surfacePage }]}>
      <View style={[styles.topBar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.topBarTitleRow}>
          <Shield size={20} color={colors.brand} />
          <Text style={[styles.topBarTitle, { color: colors.ink }]}>LCCB Connect</Text>
        </View>
        <Pressable
          onPress={() => signOut()}
          style={styles.signOutBtn}
          accessibilityLabel="Sign out"
        >
          <LogOut size={16} color={colors.inkFaint} />
          <Text style={[styles.signOutText, { color: colors.inkFaint }]}>Sign Out</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.ink }]}>Request Guest Access</Text>
          <Text style={[styles.subtitle, { color: colors.inkFaint }]}>
            Since your account is not an @lccbonline.edu.ph address, you can request read-only guest
            access to view campus repositories, capstones, and publications.
          </Text>
        </View>

        {error && (
          <View style={[styles.errorBanner, { backgroundColor: (colors as any).dangerLight || "#FEE2E2" }]}>
            <Text style={[styles.errorText, { color: (colors as any).dangerText || "#DC2626" }]}>{error}</Text>
          </View>
        )}

        <Card style={styles.card}>
          {/* Affiliation Type */}
          <Text style={[styles.label, { color: colors.ink }]}>Affiliation Type</Text>
          <View style={styles.optionsWrap}>
            {AFFILIATION_OPTIONS.map((opt) => {
              const selected = affiliationType === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setAffiliationType(opt.value)}
                  style={[
                    styles.optionCard,
                    {
                      borderColor: selected ? colors.brand : colors.border,
                      backgroundColor: selected ? ((colors as any).brandMuted || "rgba(29, 78, 216, 0.08)") : colors.surface,
                    },
                  ]}
                >
                  <View style={styles.radioRow}>
                    <View
                      style={[
                        styles.radioCircle,
                        { borderColor: selected ? colors.brand : colors.inkFaint },
                      ]}
                    >
                      {selected && <View style={[styles.radioDot, { backgroundColor: colors.brand }]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, { color: colors.ink }]}>{opt.label}</Text>
                      <Text style={[styles.optionDesc, { color: colors.inkFaint }]}>{opt.desc}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Affiliation / Institution Name */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.ink }]}>
              Institution / Organization Name <Text style={{ color: (colors as any).dangerText || "#DC2626" }}>*</Text>
            </Text>
            <TextInput
              value={affiliationName}
              onChangeText={setAffiliationName}
              placeholder="e.g. University of the Philippines, DOST, Tech Corp"
              placeholderTextColor={colors.inkFaint}
              style={[
                styles.input,
                {
                  color: colors.ink,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSunken,
                },
              ]}
              maxLength={200}
            />
          </View>

          {/* Purpose */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.ink }]}>
              Purpose of Access <Text style={{ color: (colors as any).dangerText || "#DC2626" }}>*</Text>
            </Text>
            <TextInput
              value={purpose}
              onChangeText={setPurpose}
              placeholder="Please describe why you need access to LCCB research and repositories..."
              placeholderTextColor={colors.inkFaint}
              multiline
              numberOfLines={4}
              style={[
                styles.textArea,
                {
                  color: colors.ink,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSunken,
                },
              ]}
              maxLength={500}
            />
            <Text style={[styles.charCount, { color: colors.inkFaint }]}>
              {purpose.length}/500
            </Text>
          </View>

          {/* Location (optional) */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.ink }]}>
              Location <Text style={[styles.optionalText, { color: colors.inkFaint }]}>— optional</Text>
            </Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Bacolod City, Philippines"
              placeholderTextColor={colors.inkFaint}
              style={[
                styles.input,
                {
                  color: colors.ink,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSunken,
                },
              ]}
              maxLength={200}
            />
          </View>

          <Button
            label={loading ? "Submitting Request…" : "Submit Access Request"}
            variant="primary"
            size="lg"
            onPress={handleSubmit}
            disabled={loading}
            style={styles.submitBtn}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  topBar: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  topBarTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  signOutText: {
    fontSize: 13,
    fontWeight: "500",
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: "center",
  },
  header: {
    maxWidth: 620,
    width: "100%",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    maxWidth: 620,
    width: "100%",
    padding: 24,
  },
  errorBanner: {
    maxWidth: 620,
    width: "100%",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  optionalText: {
    fontSize: 12,
    fontWeight: "400",
  },
  optionsWrap: {
    gap: 10,
    marginBottom: 20,
  },
  optionCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  optionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 18,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    height: 96,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },
  submitBtn: {
    marginTop: 8,
  },
});
