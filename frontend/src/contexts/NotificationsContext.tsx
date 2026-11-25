import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { apiJson } from "../lib/api";
import { onNotification } from "../lib/realtime";
import type { NotificationItem } from "../types";

/**
 * Notifications — the single source of truth for the bell badge, the top-bar
 * popover, the Notifications screen and the mobile tab badge.
 *
 * Every surface used to keep its own copy of the unread count. Only the bell
 * popover's own "Mark all read" button knew how to clear the badge, so reading
 * notifications anywhere else (the inbox screen, one-by-one taps, another
 * device) left a stale red badge behind. One store fixes that class of bug.
 *
 * The server stays authoritative: the first page and its unread count come from
 * GET /api/notifications, local mutations update them optimistically, and
 * Realtime events trigger a debounced resync.
 */

/** Rows fetched at once; the popover and the inbox share this page. */
const PAGE_SIZE = 30;

/** Coalesces bursts of Realtime events (an announcement fans out to many). */
const SYNC_DEBOUNCE_MS = 400;

type NotificationsContextType = {
  notifications: NotificationItem[];
  unreadCount: number;
  /** True while the first page is loading. */
  loading: boolean;
  /** True during a user-initiated refresh (pull-to-refresh). */
  refreshing: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  refreshing: false,
  refresh: async () => {},
  markAllRead: async () => {},
  markRead: async () => {},
});

async function fetchPage() {
  const data = await apiJson<{
    unread?: number;
    notifications?: NotificationItem[];
  }>(`/notifications?limit=${PAGE_SIZE}`);

  const list = Array.isArray(data) ? data : data?.notifications ?? [];
  return {
    list,
    unread:
      typeof data?.unread === "number"
        ? data.unread
        : list.filter((notification) => !notification.is_read).length,
  };
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { session, isGuest } = useAuth();
  const userId = session?.user?.id ?? null;
  const enabled = Boolean(userId) && !isGuest;
  const activeUserId = enabled ? userId : null;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(Boolean(activeUserId));
  const [refreshing, setRefreshing] = useState(false);

  // Clear synchronously when the account changes (sign-out, user switch) so the
  // previous account's badge never flashes inside the next session. Deriving
  // this during render avoids an extra effect pass.
  const [trackedUserId, setTrackedUserId] = useState(activeUserId);
  if (trackedUserId !== activeUserId) {
    setTrackedUserId(activeUserId);
    setNotifications([]);
    setUnreadCount(0);
    setLoading(Boolean(activeUserId));
  }

  // Realtime handlers and action callbacks run outside render, so they read the
  // current list through a ref instead of capturing a stale copy.
  const notificationsRef = useRef(notifications);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // Pull the authoritative page + count. Shared by the initial load, the
  // pull-to-refresh path and Realtime resyncs.
  const load = useCallback(async () => {
    if (!enabled) return;
    const { list, unread } = await fetchPage();
    setNotifications(list);
    setUnreadCount(unread);
  }, [enabled]);

  // Load the first page whenever the signed-in user changes.
  useEffect(() => {
    if (!activeUserId) return;

    let cancelled = false;
    fetchPage()
      .then(({ list, unread }) => {
        if (cancelled) return;
        setNotifications(list);
        setUnreadCount(unread);
      })
      .catch((err) => {
        if (!cancelled) console.error("Failed to load notifications:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeUserId]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setRefreshing(true);
    try {
      await load();
    } catch (err) {
      console.error("Failed to refresh notifications:", err);
    } finally {
      setRefreshing(false);
    }
  }, [enabled, load]);

  const markRead = useCallback(async (id: string) => {
    const target = notificationsRef.current.find((n) => n.id === id);
    if (!target || target.is_read) return;

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((count) => Math.max(0, count - 1));

    try {
      await apiJson(`/notifications/${id}/read`, { method: "PUT" });
    } catch (err) {
      console.error("Failed to mark notification read:", err);
      // Put the row back and resync the badge with the server.
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: false } : n))
      );
      await load().catch(() => undefined);
    }
  }, [load]);

  const markAllRead = useCallback(async () => {
    if (!enabled) return;
    const previous = notificationsRef.current;

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await apiJson("/notifications/read-all", { method: "POST" });
    } catch (err) {
      console.error("Failed to mark all notifications read:", err);
      setNotifications(previous);
      await load().catch(() => undefined);
    }
  }, [enabled, load]);

  // Debounced resync for Realtime events: INSERT/UPDATE/DELETE payloads carry
  // raw columns (no joined actor), so a quiet refetch keeps rows complete and
  // the count exact even when reads happen on another device.
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSync = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null;
      void load().catch(() => undefined);
    }, SYNC_DEBOUNCE_MS);
  }, [load]);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    return onNotification(({ action, notification }) => {
      if (action === "INSERT") {
        const alreadyKnown = notificationsRef.current.some(
          (n) => n.id === notification.id
        );
        if (!alreadyKnown) {
          // Realtime payloads carry raw columns only; the debounced sync below
          // fills in the joined actor. Seed the row so the badge reacts now.
          const inserted: NotificationItem = {
            ...notification,
            department: null,
            actor: null,
          };
          setNotifications((prev) => [inserted, ...prev].slice(0, PAGE_SIZE));
          if (!notification.is_read) setUnreadCount((count) => count + 1);
        }
      } else if (action === "UPDATE") {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, ...notification } : n))
        );
      } else if (action === "DELETE") {
        const removed = notificationsRef.current.find(
          (n) => n.id === notification.id
        );
        setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
        if (removed && !removed.is_read) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
      }

      scheduleSync();
    });
  }, [enabled, scheduleSync]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      refreshing,
      refresh,
      markAllRead,
      markRead,
    }),
    [notifications, unreadCount, loading, refreshing, refresh, markAllRead, markRead]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);
