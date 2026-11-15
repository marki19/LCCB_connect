import { useState } from "react";
import { View } from "react-native";
import { MessagesSquare } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { SPACE } from "../../lib/tokens";
import { safeBack } from "../../lib/navigation";
import EmptyState from "../admin/EmptyState";
import InboxPane from "./InboxPane";
import ThreadPane from "./ThreadPane";

/**
 * Desktop messaging layout: the conversation list stays put on the left while
 * the open thread fills the right pane (the pattern people expect from every
 * web messenger). Picking a chat swaps the pane instead of pushing a route, so
 * the list keeps its scroll position and never refetches mid-conversation.
 *
 * Phones and tablets never mount this: the routes fall back to the single-pane
 * inbox → thread flow.
 */

const LIST_WIDTH = 360;

type MessagesSplitProps = {
  /** Thread to open on mount, for `/messages/:id` deep links. */
  initialId?: string | null;
};

export default function MessagesSplit({ initialId = null }: MessagesSplitProps) {
  const { colors } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(initialId);

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.surfacePage }}>
      <View
        style={{
          width: LIST_WIDTH,
          borderRightWidth: 1,
          borderRightColor: colors.line,
          backgroundColor: colors.surfacePage,
        }}
      >
        <InboxPane
          onSelect={setSelectedId}
          activeId={selectedId}
          showBack={true}
          onBack={() => safeBack("/(tabs)")}
        />
      </View>

      <View style={{ flex: 1, minWidth: 0, backgroundColor: colors.surfacePage }}>
        {selectedId ? (
          <ThreadPane key={selectedId} conversationId={selectedId} />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: SPACE.x8,
            }}
          >
            <EmptyState
              icon={MessagesSquare}
              title="Select a conversation"
              body="Pick a chat from the list to read and reply without leaving the page."
              compact
            />
          </View>
        )}
      </View>
    </View>
  );
}
