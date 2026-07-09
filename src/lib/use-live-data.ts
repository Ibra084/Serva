"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadTables, subscribeToLiveFloor } from "@/lib/live-store";
import { loadActiveSessionsForRestaurant, type ActiveSessionSummary } from "@/lib/table-session-store";
import type { RestaurantTable } from "@/lib/types";

const POLL_MS = 15_000;

/** Live restaurant floor: the full table registry, plus every active session (with its own orders/participants/payments/bill), kept fresh via Supabase Realtime with a polling fallback. */
export function useLiveFloor(restaurantSlug: string) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [sessions, setSessions] = useState<ActiveSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const [nextTables, nextSessions] = await Promise.all([
      loadTables(restaurantSlug),
      loadActiveSessionsForRestaurant(restaurantSlug),
    ]);
    setTables(nextTables);
    setSessions(nextSessions);
    setLoading(false);
    loadingRef.current = false;
  }, [restaurantSlug]);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribeToLiveFloor(restaurantSlug, refresh);
    const interval = setInterval(refresh, POLL_MS);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [restaurantSlug, refresh]);

  return { tables, sessions, loading, refresh };
}
