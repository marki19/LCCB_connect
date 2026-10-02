import { View, Text, ScrollView } from "react-native";

export default function AdminUsersScreen() {
  return (
    <ScrollView className="flex-1 p-8" showsVerticalScrollIndicator={false}>
      <View className="mb-8">
        <Text className="text-3xl font-black text-slate-900 tracking-tight">Users & Roles</Text>
        <Text className="text-slate-500 text-lg mt-1">Manage students, faculty, and administrators.</Text>
      </View>

      <View className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm min-h-[500px]">
        <Text className="text-slate-500 text-sm italic">Data table for user management will be implemented here.</Text>
      </View>
    </ScrollView>
  );
}
