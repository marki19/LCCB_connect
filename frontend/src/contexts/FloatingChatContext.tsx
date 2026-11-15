import React, { createContext, useContext, useState, useCallback } from "react";
import { openConversation } from "../lib/messages";

export interface ActiveChatPeer {
  conversationId?: string;
  peerId: string;
  peerName?: string;
  avatarUrl?: string;
}

export interface FloatingChatContextValue {
  activeChat: ActiveChatPeer | null;
  isMinimized: boolean;
  openChat: (peer: ActiveChatPeer) => void;
  closeChat: () => void;
  toggleMinimize: () => void;
}

const FloatingChatContext = createContext<FloatingChatContextValue | null>(null);

export function FloatingChatProvider({ children }: { children: React.ReactNode }) {
  const [activeChat, setActiveChat] = useState<ActiveChatPeer | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const openChat = useCallback(async (peer: ActiveChatPeer) => {
    setActiveChat(peer);
    setIsMinimized(false);

    if (!peer.conversationId && peer.peerId) {
      try {
        const conv = await openConversation(peer.peerId);
        setActiveChat((curr) =>
          curr?.peerId === peer.peerId ? { ...curr, conversationId: conv.id } : curr
        );
      } catch (err) {
        console.error("Failed to open conversation for floating chat:", err);
      }
    }
  }, []);

  const closeChat = useCallback(() => {
    setActiveChat(null);
    setIsMinimized(false);
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  return (
    <FloatingChatContext.Provider
      value={{
        activeChat,
        isMinimized,
        openChat,
        closeChat,
        toggleMinimize,
      }}
    >
      {children}
    </FloatingChatContext.Provider>
  );
}

export function useFloatingChat() {
  const ctx = useContext(FloatingChatContext);
  if (!ctx) {
    throw new Error("useFloatingChat must be used within a FloatingChatProvider");
  }
  return ctx;
}

