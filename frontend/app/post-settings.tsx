import { useEffect, useState } from "react";
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { apiJson, updatePost } from "../src/lib/api";
import { useTheme } from "../src/contexts/ThemeContext";
import { safeBack } from "../src/lib/navigation";
import VisibilityPicker from "../src/components/VisibilityPicker";
import type { ContentVisibility } from "../src/types";

/**
 * Per-post settings reached from the post menu: who can see it, and whether
 * others may repost it. Visibility itself is enforced server-side.
 */
export default function PostSettings() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visibility, setVisibility] = useState<ContentVisibility>("public");
  const [audience, setAudience] = useState<string[]>([]);
  const [allowReposts, setAllowReposts] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiJson<any>(`/posts/${postId}`)
      .then((post) => {
        if (cancelled) return;
        setVisibility(post.visibility ?? "public");
        setAllowReposts(post.allow_reposts !== false);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePost(postId, {
        visibility,
        allow_reposts: allowReposts,
        ...(visibility === "custom" ? { audience } : {}),
      });
      safeBack("/(tabs)");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity onPress={() => safeBack("/(tabs)")} style={{ padding: 4 }}>
          <ChevronLeft color={colors.textPrimary} size={26} />
        </TouchableOpacity>
        <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 18, marginLeft: 8 }}>
          Post Settings
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.action} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <VisibilityPicker
            visibility={visibility}
            audience={audience}
            onChange={(nextVisibility, nextAudience) => {
              setVisibility(nextVisibility);
              setAudience(nextAudience);
            }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 14 }}>
              Allow reposts
            </Text>
            <Switch
              value={allowReposts}
              onValueChange={setAllowReposts}
              trackColor={{ true: colors.action, false: colors.border }}
              accessibilityLabel="Allow reposts"
            />
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{
              marginTop: 24,
              backgroundColor: saving ? colors.surfaceSunken : colors.action,
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>
              {saving ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
