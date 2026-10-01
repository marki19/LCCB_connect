import { useState, useCallback } from "react";
import { View, FlatList, RefreshControl, Text } from "react-native";
import HomeHeader from "../../src/components/HomeHeader";
import PostCard from "../../src/components/PostCard";
import SettingsSidebar from "../../src/components/SettingsSidebar";
import { PROTOTYPE_POSTS, type Post } from "../../src/data/prototype";

function shuffleArray<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function HomeScreen() {
  const [posts, setPosts] = useState<Post[]>(PROTOTYPE_POSTS);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setPosts(shuffleArray(PROTOTYPE_POSTS));
      setRefreshing(false);
    }, 800);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#F0F7FF" }}>
      <HomeHeader onMenuPress={() => setSidebarOpen(true)} />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 14,
              padding: 14,
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#DBEAFE",
              flexDirection: "row",
              alignItems: "center",
              shadowColor: "#1A56DB",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: "#BFDBFE",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 10,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#1E293B" }}>MS</Text>
            </View>
            <View
              style={{
                flex: 1,
                height: 38,
                backgroundColor: "#F0F7FF",
                borderRadius: 19,
                borderWidth: 1,
                borderColor: "#DBEAFE",
                justifyContent: "center",
                paddingHorizontal: 14,
              }}
            >
              <Text style={{ color: "#94A3B8", fontSize: 13 }}>
                Share your project or thesis...
              </Text>
            </View>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#1A56DB"]}
            tintColor="#1A56DB"
          />
        }
      />

      <SettingsSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </View>
  );
}
