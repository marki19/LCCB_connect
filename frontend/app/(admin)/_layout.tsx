import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Stack, useRouter, usePathname } from "expo-router";
import {
  LayoutDashboard,
  Users,
  FileText,
  Megaphone,
  Building2,
  Settings,
  ScrollText,
  LogOut,
  ExternalLink,
  ShieldCheck,
} from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { isAdminRole, isSuperAdminRole } from "../../src/lib/roles";
import { setAdminAppPreview } from "../../src/lib/panelMode";

type NavItemProps = {
  icon: any;
  label: string;
  path: string;
  active: boolean;
  onPress: () => void;
};

function NavItem({ icon: Icon, label, path, active, onPress }: NavItemProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`mb-1 flex-row items-center rounded-xl px-4 py-3 ${
        active ? "bg-[#1D4ED8]" : "hover:bg-slate-100"
      }`}
    >
      <Icon color={active ? "#FFFFFF" : "#64748B"} size={19} />
      <Text
        className={`ml-3 text-sm font-semibold ${
          active ? "text-white" : "text-slate-600"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { signOut, profile } = useAuth();
  const isDesktop = Platform.OS === "web" && width >= 768;
  const adminUser = isAdminRole(profile?.role);

  if (!isDesktop || !adminUser) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <ShieldCheck size={32} color="#1D4ED8" />
        <Text className="mt-4 text-xl font-bold text-slate-800">
          {isDesktop ? "Admin access required" : "Desktop console"}
        </Text>
        <Text className="mt-2 max-w-[420px] text-center text-slate-500">
          {isDesktop
            ? "This account does not have access to the administration console."
            : "The admin console is available on desktop web. Use the normal app on this device."}
        </Text>
        <TouchableOpacity
          className="mt-6 rounded-full bg-[#1D4ED8] px-6 py-3"
          onPress={() => {
            setAdminAppPreview(true);
            router.replace("/(tabs)/");
          }}
        >
          <Text className="font-bold text-white">Go to App</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  const isActive = (path: string) => {
    const relative = pathname.replace(/^\/\(admin\)/, "") || "/";
    if (path === "/(admin)") return relative === "/";
    const target = path.replace("/(admin)", "");
    return relative === target || relative.startsWith(`${target}/`);
  };

  const nav = [
    { label: "Overview", path: "/(admin)", icon: LayoutDashboard },
    { label: "Users", path: "/(admin)/users", icon: Users },
    { label: "Reports & Content", path: "/(admin)/content", icon: FileText },
    { label: "Announcements", path: "/(admin)/announcements", icon: Megaphone },
    {
      label: "Departments & Courses",
      path: "/(admin)/departments",
      icon: Building2,
    },
    { label: "Settings", path: "/(admin)/settings", icon: Settings },
  ];

  if (isSuperAdminRole(profile.role)) {
    nav.push({ label: "Audit", path: "/(admin)/audit", icon: ScrollText });
  }

  return (
    <View className="flex-1 flex-row bg-[#F8FAFC]">
      <View className="h-full w-64 border-r border-slate-200 bg-white">
        <ScrollView
          className="flex-1 p-4"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between" }}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <View className="mb-8 flex-row items-center px-2">
              <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-[#1D4ED8]">
                <Text className="font-black text-white">L</Text>
              </View>
              <View>
                <Text className="text-lg font-black tracking-tight text-slate-800">
                  Admin Console
                </Text>
                <Text className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {isSuperAdminRole(profile.role) ? "Superadmin" : "Administrator"}
                </Text>
              </View>
            </View>

            {nav.map((item) => (
              <NavItem
                key={item.path}
                icon={item.icon}
                label={item.label}
                path={item.path}
                active={isActive(item.path)}
                onPress={() => router.push(item.path as any)}
              />
            ))}
          </View>

          <View className="border-t border-slate-100 pt-4">
            <View className="mb-4 flex-row items-center px-2">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Text className="font-bold text-blue-700">
                  {profile.full_name?.[0] || profile.username?.[0] || "A"}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-800" numberOfLines={1}>
                  {profile.full_name || profile.username || "Admin"}
                </Text>
                <Text className="text-xs text-slate-500">{profile.role}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                setAdminAppPreview(true);
                router.push("/(tabs)/");
              }}
              className="mb-1 flex-row items-center rounded-xl px-4 py-3 hover:bg-slate-100"
            >
              <ExternalLink size={18} color="#475569" />
              <Text className="ml-3 text-sm font-semibold text-slate-600">
                Back to App
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => void signOut()}
              className="flex-row items-center rounded-xl px-4 py-3 hover:bg-red-50"
            >
              <LogOut size={18} color="#EF4444" />
              <Text className="ml-3 text-sm font-semibold text-red-500">Sign Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      <View className="flex-1 overflow-hidden">
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
      </View>
    </View>
  );
}
