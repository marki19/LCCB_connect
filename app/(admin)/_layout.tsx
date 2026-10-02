import { View, Text, TouchableOpacity, Dimensions } from "react-native";
import { Stack, useRouter, usePathname } from "expo-router";
import { LayoutDashboard, Users, FileText, Settings, LogOut } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useAuth } from "../../src/contexts/AuthContext";

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut, profile } = useAuth();
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const handleResize = () => setIsDesktop(Dimensions.get("window").width > 768);
    handleResize(); 
    const subscription = Dimensions.addEventListener("change", handleResize);
    return () => subscription?.remove();
  }, []);

  const NavItem = ({ icon: Icon, label, path }: { icon: any, label: string, path: string }) => {
    const isActive = pathname === path;
    return (
      <TouchableOpacity 
        onPress={() => router.push(path as any)}
        className={`flex-row items-center px-4 py-3 mb-2 rounded-xl transition-colors ${isActive ? 'bg-[#1D4ED8]' : 'hover:bg-slate-100'}`}
      >
        <Icon color={isActive ? "#FFFFFF" : "#64748B"} size={20} />
        <Text className={`ml-3 font-semibold ${isActive ? 'text-white' : 'text-slate-600'}`}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  if (!isDesktop) {
    // On mobile, just render a regular stack (or tell them to use desktop)
    return (
      <View className="flex-1 bg-white items-center justify-center p-6">
        <Text className="text-xl font-bold text-slate-800 text-center mb-2">Desktop Only</Text>
        <Text className="text-slate-500 text-center mb-6">The Admin Dashboard is only available on desktop web browsers.</Text>
        <TouchableOpacity 
          className="bg-[#1D4ED8] px-6 py-3 rounded-full"
          onPress={() => router.replace("/(tabs)/")}
        >
          <Text className="text-white font-bold">Go to Mobile App</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 flex-row bg-[#F8FAFC]">
      {/* Sidebar */}
      <View className="w-64 bg-white border-r border-slate-200 h-full p-4 justify-between">
        <View>
          <View className="mb-8 px-2 flex-row items-center">
            <View className="w-8 h-8 bg-[#1D4ED8] rounded-lg items-center justify-center mr-3">
              <Text className="text-white font-black">L</Text>
            </View>
            <Text className="text-xl font-black text-slate-800 tracking-tight">Admin Portal</Text>
          </View>
          
          <NavItem icon={LayoutDashboard} label="Overview" path="/(admin)" />
          <NavItem icon={Users} label="Users & Roles" path="/(admin)/users" />
          <NavItem icon={FileText} label="Content Moderation" path="/(admin)/content" />
          <NavItem icon={Settings} label="Settings" path="/(admin)/settings" />
        </View>

        <View className="border-t border-slate-100 pt-4">
          <View className="flex-row items-center px-2 mb-4">
            <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
              <Text className="text-blue-700 font-bold">{profile?.full_name?.[0] || "A"}</Text>
            </View>
            <View>
              <Text className="font-bold text-slate-800 text-sm">{profile?.full_name || "Admin User"}</Text>
              <Text className="text-slate-500 text-xs">{profile?.role || "superadmin"}</Text>
            </View>
          </View>

          <TouchableOpacity 
            onPress={() => signOut()}
            className="flex-row items-center px-4 py-3 rounded-xl hover:bg-red-50 transition-colors"
          >
            <LogOut color="#EF4444" size={20} />
            <Text className="ml-3 font-semibold text-red-500">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <View className="flex-1 overflow-hidden">
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="users" />
          <Stack.Screen name="content" />
          <Stack.Screen name="settings" />
        </Stack>
      </View>
    </View>
  );
}
