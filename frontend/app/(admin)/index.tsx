import { View, Text, ScrollView } from "react-native";
import { Users, FileText, Activity } from "lucide-react-native";

export default function AdminOverviewScreen() {
  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <View className="bg-white p-6 rounded-2xl border border-slate-100 flex-1 min-w-[200px] shadow-sm">
      <View className="flex-row justify-between items-start mb-4">
        <View className={`w-12 h-12 rounded-full items-center justify-center`} style={{ backgroundColor: `${color}15` }}>
          <Icon color={color} size={24} />
        </View>
      </View>
      <Text className="text-3xl font-black text-slate-800 tracking-tight">{value}</Text>
      <Text className="text-slate-500 font-medium mt-1">{title}</Text>
    </View>
  );

  return (
    <ScrollView className="flex-1 p-8" showsVerticalScrollIndicator={false}>
      <View className="mb-8">
        <Text className="text-3xl font-black text-slate-900 tracking-tight">Overview</Text>
        <Text className="text-slate-500 text-lg mt-1">Welcome to the LCCB Connect admin dashboard.</Text>
      </View>

      <View className="flex-row gap-6 flex-wrap mb-8">
        <StatCard title="Total Users" value="1,248" icon={Users} color="#1D4ED8" />
        <StatCard title="Active Portfolios" value="842" icon={FileText} color="#10B981" />
        <StatCard title="Daily Activity" value="8.4k" icon={Activity} color="#F59E0B" />
      </View>

      <View className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm min-h-[300px]">
        <Text className="text-lg font-bold text-slate-800 mb-4">Recent Activity</Text>
        <Text className="text-slate-500 text-sm italic">Activity graph and logs will be implemented here.</Text>
      </View>
    </ScrollView>
  );
}
