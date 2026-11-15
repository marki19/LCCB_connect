import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { useRouter, usePathname, useLocalSearchParams } from "expo-router";

export type FeedCategory = "all" | "websites" | "theses" | "projects" | "discussions";

interface FeedFilterContextType {
  activeCategory: FeedCategory;
  setCategory: (category: FeedCategory) => void;
}

const FeedFilterContext = createContext<FeedFilterContextType>({
  activeCategory: "all",
  setCategory: () => {},
});

export function FeedFilterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useLocalSearchParams<{ feed?: string }>();

  // Determine initial from search params if present
  const initialCategory: FeedCategory =
    searchParams.feed &&
    ["all", "websites", "theses", "projects", "discussions"].includes(searchParams.feed)
      ? (searchParams.feed as FeedCategory)
      : "all";

  const [activeCategory, setActiveCategory] = useState<FeedCategory>(initialCategory);

  const setCategory = useCallback(
    (newCategory: FeedCategory) => {
      setActiveCategory(newCategory);
      // If user is not on the home feed, navigate to home feed with filter
      if (pathname !== "/" && pathname !== "/(tabs)" && pathname !== "/(tabs)/") {
        router.push(newCategory === "all" ? "/(tabs)/" : (`/(tabs)/?feed=${newCategory}` as any));
      } else {
        // If already on home feed, update query param without page reload
        router.setParams({ feed: newCategory === "all" ? "" : newCategory });
      }
    },
    [pathname, router]
  );

  const value = useMemo(
    () => ({ activeCategory, setCategory }),
    [activeCategory, setCategory]
  );

  return (
    <FeedFilterContext.Provider value={value}>
      {children}
    </FeedFilterContext.Provider>
  );
}

export function useFeedFilter() {
  return useContext(FeedFilterContext);
}

