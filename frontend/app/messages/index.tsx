import { useEffect } from "react";
import { useRouter } from "expo-router";
import ChatsTabScreen from "../(tabs)/messages";

/**
 * Legacy /messages route: delegates to the primary (tabs)/messages screen.
 */
export default function MessagesScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/(tabs)/messages" as any);
  }, [router]);

  return <ChatsTabScreen />;
}
