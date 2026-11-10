import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Globe, Users, UserCheck, Lock, Check } from "lucide-react-native";
import { useTheme } from "../contexts/ThemeContext";
import { listFriends } from "../lib/messages";
import type { ContentVisibility, Friend } from "../types";

/**
 * Four-way visibility picker for the post and thesis composers.
 *
 * The enforcement is server-side (`visible_posts` / `visible_theses`); this only
 * collects the choice. `custom` reveals the friend list, and the selected ids are
 * what the API stores as the item's audience.
 */

const OPTIONS: { value: ContentVisibility; label: string; Icon: any }[] = [
  { value: "public", label: "Public", Icon: Globe },
  { value: "friends", label: "Friends", Icon: Users },
  { value: "custom", label: "Custom", Icon: UserCheck },
  { value: "private", label: "Private", Icon: Lock },
];

type Props = {
  visibility: ContentVisibility;
  audience: string[];
  onChange: (visibility: ContentVisibility, audience: string[]) => void;
};

export default function VisibilityPicker({ visibility, audience, onChange }: Props) {
  const { colors } = useTheme();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [failed, setFailed] = useState(false);

  // Only `custom` needs the friend list, so it is fetched the first time the
  // user picks that option rather than on every composer open.
  useEffect(() => {
    if (visibility !== "custom" || friends !== null || failed) return;
    let cancelled = false;
    listFriends(100)
      .then((list) => {
        if (!cancelled) setFriends(list);
      })
      .catch(() => {
        if (cancelled) return;
        // Show the empty state instead of retrying on every re-render.
        setFriends([]);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [visibility, friends, failed]);

  const loading = visibility === "custom" && friends === null && !failed;

  const toggleFriend = (id: string) => {
    const next = audience.includes(id)
      ? audience.filter((userId) => userId !== id)
      : [...audience, id];
    onChange("custom", next);
  };

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: colors.textSecondary, fontWeight: "700", marginBottom: 8, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 }}>
        Who can see this
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {OPTIONS.map(({ value, label, Icon }) => {
          const selected = visibility === value;
          return (
            <TouchableOpacity
              key={value}
              // Leaving `custom` drops the stored audience; the server clears it too.
              onPress={() => onChange(value, value === "custom" ? audience : [])}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                backgroundColor: selected ? colors.actionSurface : colors.surface,
                borderColor: selected ? colors.action : colors.border,
              }}
            >
              <Icon size={16} color={selected ? colors.action : colors.textTertiary} />
              <Text style={{ marginLeft: 6, fontWeight: "700", fontSize: 13, color: selected ? colors.action : colors.textSecondary }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {visibility === "custom" && (
        <View style={{ marginTop: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden" }}>
          {loading ? (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.action} />
            </View>
          ) : (friends?.length ?? 0) === 0 ? (
            <Text style={{ padding: 16, color: colors.textTertiary, fontSize: 13 }}>
              No friends yet
            </Text>
          ) : (
            friends!.map(({ peer }, index) => {
              const selected = audience.includes(peer.id);
              return (
                <TouchableOpacity
                  key={peer.id}
                  onPress={() => toggleFriend(peer.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: selected ? colors.action : colors.borderStrong,
                      backgroundColor: selected ? colors.action : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 10,
                    }}
                  >
                    {selected && <Check size={13} color={colors.textOnPrimary} />}
                  </View>
                  <Text numberOfLines={1} style={{ flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}>
                    {peer.full_name || peer.username || "Friend"}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}
