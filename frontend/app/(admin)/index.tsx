import { useState, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Users, FileText, Activity } from "lucide-react-native";
import { apiFetch } from "../../src/lib/api";

export default function AdminOverviewScreen() {
  const [stats, setStats] = useState({ users: 0, theses: 0, posts: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, thesesRes, postsRes] = await Promise.all([
          apiFetch(`/users`).then(r => r.ok ? r.json() : []),
          apiFetch(`/theses`).then(r => r.ok ? r.json() : []),
          apiFetch(`/posts`).then(r => r.ok ? r.json() : []),
        ]);
        setStats({
          users: Array.isArray(usersRes) ? usersRes.length : 0,
          theses: Array.isArray(thesesRes) ? thesesRes.length : 0,
          posts: Array.isArray(postsRes) ? postsRes.length : 0,
        });
      } catch (err) {
        console.error("Failed to load admin stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <View className="bg-white p-6 rounded-2xl border border-slate-100 flex-1 min-w-[200px] shadow-sm">
      <View className="flex-row justify-between items-start mb-4">
        <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon color={color} size={24} />
        </View>
      </View>
      <Text className="text-3xl font-black text-slate-800 tracking-tight">{loading ? "-" : value}</Text>
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
        <StatCard title="Total Users" value={stats.users} icon={Users} color="#1D4ED8" />
        <StatCard title="Theses Deposited" value={stats.theses} icon={FileText} color="#10B981" />
        <StatCard title="Broadcasts & Posts" value={stats.posts} icon={Activity} color="#F59E0B" />
      </View>

      <View className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm min-h-[300px]">
        <Text className="text-lg font-bold text-slate-800 mb-4">Database Health</Text>
        <Text className="text-slate-600 text-sm">
          Connected directly to PostgreSQL Raw SQL Express API. Zero ORM.
        </Text>
      </View>
    </ScrollView>
  );
}
