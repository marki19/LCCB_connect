import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { LogOut, ShieldAlert } from "lucide-react-native";
import { useAuth } from "../src/contexts/AuthContext";

function formatUntil(value?: string | null) {
  if (!value) return "Until an administrator restores the account";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `Until ${date.toLocaleString()}`;
}

export default function SuspendedScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  return (
    <View className="flex-1 items-center justify-center bg-slate-50 p-6">
      <View className="w-full max-w-[560px] rounded-3xl border border-red-100 bg-white p-8 shadow-sm">
        <View className="mb-5 h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <ShieldAlert size={28} color="#DC2626" />
        </View>
        <Text className="text-2xl font-black tracking-tight text-slate-900">
          Account suspended
        </Text>
        <Text className="mt-2 text-base leading-6 text-slate-500">
          This account cannot use LCCB Connect while the suspension is active.
        </Text>

        <View className="mt-6 rounded-2xl bg-slate-50 p-4">
          <Text className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Reason
          </Text>
          <Text className="mt-1 text-sm leading-5 text-slate-700">
            {profile?.suspension_reason || "No reason was recorded."}
          </Text>
          <Text className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">
            Duration
          </Text>
          <Text className="mt-1 text-sm leading-5 text-slate-700">
            {formatUntil(profile?.suspended_until)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => void handleSignOut()}
          className="mt-6 flex-row items-center justify-center rounded-xl border border-slate-200 px-4 py-3"
        >
          <LogOut size={18} color="#475569" />
          <Text className="ml-2 font-bold text-slate-700">Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
