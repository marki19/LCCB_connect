import React, { createContext, useContext, useState, useCallback } from "react";

interface SettingsSidebarContextType {
  isSettingsSidebarOpen: boolean;
  openSettingsSidebar: () => void;
  closeSettingsSidebar: () => void;
  toggleSettingsSidebar: () => void;
}

const SettingsSidebarContext = createContext<SettingsSidebarContextType | undefined>(undefined);

export function SettingsSidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openSettingsSidebar = useCallback(() => setIsOpen(true), []);
  const closeSettingsSidebar = useCallback(() => setIsOpen(false), []);
  const toggleSettingsSidebar = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <SettingsSidebarContext.Provider
      value={{
        isSettingsSidebarOpen: isOpen,
        openSettingsSidebar,
        closeSettingsSidebar,
        toggleSettingsSidebar,
      }}
    >
      {children}
    </SettingsSidebarContext.Provider>
  );
}

export function useSettingsSidebar() {
  const context = useContext(SettingsSidebarContext);
  if (!context) {
    throw new Error("useSettingsSidebar must be used within a SettingsSidebarProvider");
  }
  return context;
}

