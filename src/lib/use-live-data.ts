"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadLiveOrders, loadLiveSessions, loadTables, subscribeToLiveFloor } from "@/lib/live-store";
import type { LiveTableSession, QROrder, RestaurantTable } from "@/lib/types";

const POLL_MS = 15_000;

/** Live restaurant floor: tables + active sessions + orders, kept fresh via Supabase Realtime with a polling fallback. */
export function useLiveFloor(restaurantSlug: string) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [sessions, setSessions] = useState<LiveTableSession[]>([]);
  const [orders, setOrders] = useState<QROrder[]>([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const [nextTables, nextSessions, nextOrders] = await Promise.all([
      loadTables(restaurantSlug),
      loadLiveSessions(restaurantSlug),
      loadLiveOrders(restaurantSlug),
    ]);
    setTables(nextTables);
    setSessions(nextSessions);
    setOrders(nextOrders);
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

  return { tables, sessions, orders, loading, refresh };
}
