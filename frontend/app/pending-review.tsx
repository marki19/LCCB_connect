import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Clock, Shield, LogOut, RefreshCw, CheckCircle2 } from "lucide-react-native";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { RADIUS, SPACE, TYPE } from "../src/lib/tokens";
import Button from "../src/components/ui/Button";
import Card from "../src/components/ui/Card";

export default function PendingReviewScreen() {
  const router = useRouter();
  const { profile, signOut, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const [checking, setChecking] = useState(false);

  // Poll status every 30 seconds or redirect if approved
  useEffect(() => {
    if (!profile) return;

    if (profile.role === "guest" && (profile.verification_status === "verified" || profile.verification_status === "approved")) {
      router.replace("/(tabs)/" as any);
      return;
    }

    if (profile.suspended_at) {
      router.replace("/suspended" as any);
      return;
    }

    const interval = setInterval(async () => {
      try {
        await refreshProfile();
      } catch (err) {
        // Best effort
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [profile, refreshProfile, router]);

  const handleManualCheck = async () => {
    try {
      setChecking(true);
      await refreshProfile();
      if (profile?.role === "guest" && (profile?.verification_status === "verified" || profile?.verification_status === "approved")) {
        router.replace("/(tabs)/" as any);
      }
    } catch {
      // Best effort
    } finally {
      setChecking(false);
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
        <Card style={styles.card}>
          <View style={styles.iconWrap}>
            <View style={[styles.iconCircle, { backgroundColor: "rgba(234, 179, 8, 0.15)" }]}>
              <Clock size={36} color="#CA8A04" />
            </View>
          </View>

          <Text style={[styles.title, { color: colors.ink }]}>Application Under Review</Text>
          <Text style={[styles.subtitle, { color: colors.inkFaint }]}>
            Your read-only guest access is currently being reviewed by a campus administrator.
          </Text>

          <View style={[styles.statusPill, { backgroundColor: "rgba(234, 179, 8, 0.12)", borderColor: "#CA8A04" }]}>
            <Clock size={14} color="#CA8A04" />
            <Text style={[styles.statusPillText, { color: "#A16207" }]}>Pending Admin Approval</Text>
          </View>

          {/* Details summary */}
          <View style={[styles.detailsBox, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
            <Text style={[styles.detailsHeader, { color: colors.ink }]}>Submitted Details</Text>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.inkFaint }]}>Account:</Text>
              <Text style={[styles.detailValue, { color: colors.ink }]}>{profile?.email || "—"}</Text>
            </View>

            {profile?.guest_affiliation_name && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.inkFaint }]}>Affiliation:</Text>
                <Text style={[styles.detailValue, { color: colors.ink }]}>
                  {profile.guest_affiliation_name}
                </Text>
              </View>
            )}

            {profile?.guest_affiliation_type && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.inkFaint }]}>Type:</Text>
                <Text style={[styles.detailValue, { color: colors.ink, textTransform: "capitalize" }]}>
                  {profile.guest_affiliation_type.replace(/_/g, " ")}
                </Text>
              </View>
            )}

            {profile?.guest_location && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.inkFaint }]}>Location:</Text>
                <Text style={[styles.detailValue, { color: colors.ink }]}>{profile.guest_location}</Text>
              </View>
            )}

            {profile?.guest_purpose && (
              <View style={[styles.detailRow, { alignItems: "flex-start" }]}>
                <Text style={[styles.detailLabel, { color: colors.inkFaint }]}>Purpose:</Text>
                <Text style={[styles.detailValue, { color: colors.ink, flex: 1 }]}>
                  {profile.guest_purpose}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <Button
              label={checking ? "Checking Status…" : "Check Status"}
              variant="secondary"
              size="md"
              onPress={handleManualCheck}
              disabled={checking}
              icon={RefreshCw}
              style={{ width: "100%", marginBottom: 10 }}
            />
            <Button
              label="Sign Out"
              variant="ghost"
              size="md"
              onPress={() => signOut()}
              icon={LogOut}
              style={{ width: "100%" }}
            />
          </View>
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
    paddingVertical: 40,
    alignItems: "center",
  },
  card: {
    maxWidth: 540,
    width: "100%",
    padding: 32,
    alignItems: "center",
  },
  iconWrap: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 16,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: "700",
  },
  detailsBox: {
    width: "100%",
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 24,
    gap: 8,
  },
  detailsHeader: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "600",
    width: 80,
  },
  detailValue: {
    fontSize: 13,
  },
  actions: {
    width: "100%",
  },
});
