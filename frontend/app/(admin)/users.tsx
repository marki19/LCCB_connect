import { useState, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { apiFetch } from "../../src/lib/api";

export default function AdminUsersScreen() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await apiFetch(`/users`);
        if (res.ok) {
          const data = await res.json();
          setUsers(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to load users:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  return (
    <ScrollView className="flex-1 p-8" showsVerticalScrollIndicator={false}>
      <View className="mb-8">
        <Text className="text-3xl font-black text-slate-900 tracking-tight">Users & Roles</Text>
        <Text className="text-slate-500 text-lg mt-1">Manage students, faculty, and administrators directly in PostgreSQL.</Text>
      </View>

      <View className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm min-h-[500px]">
        {loading ? (
          <ActivityIndicator size="large" color="#1D4ED8" />
        ) : users.length === 0 ? (
          <Text className="text-slate-500 text-sm italic">No users found in database.</Text>
        ) : (
          <View>
            <View className="flex-row border-b border-slate-200 pb-3 mb-3">
              <Text className="flex-2 font-bold text-slate-700 w-48">Name</Text>
              <Text className="flex-2 font-bold text-slate-700 w-48">Username</Text>
              <Text className="flex-1 font-bold text-slate-700 w-32">Role</Text>
              <Text className="flex-1 font-bold text-slate-700 w-32">Department</Text>
            </View>
            {users.map((u) => (
              <View key={u.id} className="flex-row items-center py-3 border-b border-slate-100">
                <Text className="text-slate-800 font-medium w-48">{u.full_name || "—"}</Text>
                <Text className="text-slate-500 text-sm w-48">{u.username || "—"}</Text>
                <Text className="text-blue-600 font-semibold text-xs w-32 uppercase">{u.role || "student"}</Text>
                <Text className="text-slate-500 text-sm w-32">{u.department_name || "—"}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
