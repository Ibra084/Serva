"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getLiveSessionsForRestaurant,
  loadTables,
  subscribeToRestaurantRealtime,
  subscribeToSessionsChanged,
  type TableSession,
} from "@/lib/session-store";
import type { RestaurantTable } from "@/lib/types";

const POLL_MS = 15_000;

/** Owner live view's single data source: the full table registry, plus every non-closed session (already bundled with its own orders/payments/participants/bill). Pass `enabled: false` to skip fetching/polling/subscriptions until needed (e.g. a lazily-opened panel). */
export function useLiveSessions(restaurantSlug: string, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const [nextTables, nextSessions] = await Promise.all([
      loadTables(restaurantSlug),
      getLiveSessionsForRestaurant(restaurantSlug),
    ]);
    setTables(nextTables);
    setSessions(nextSessions);
    setLoading(false);
    loadingRef.current = false;
  }, [restaurantSlug]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const unsubscribeRealtime = subscribeToRestaurantRealtime(restaurantSlug, refresh);
    const unsubscribeSync = subscribeToSessionsChanged(refresh);
    const interval = setInterval(refresh, POLL_MS);
    return () => {
      unsubscribeRealtime();
      unsubscribeSync();
      clearInterval(interval);
    };
  }, [restaurantSlug, refresh, enabled]);

  return { tables, sessions, loading, refresh };
}
