"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadLiveOrders, loadLiveSessions, loadTables, subscribeToLiveFloor } from "@/lib/live-store";
import { loadParticipantsForSessions } from "@/lib/table-session-store";
import { loadPayments } from "@/lib/payment-store";
import type { LiveTableSession, Payment, QROrder, RestaurantTable, TableParticipant } from "@/lib/types";

const POLL_MS = 15_000;

/** Live restaurant floor: tables + active sessions + orders + participants + payments, kept fresh via Supabase Realtime with a polling fallback. */
export function useLiveFloor(restaurantSlug: string) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [sessions, setSessions] = useState<LiveTableSession[]>([]);
  const [orders, setOrders] = useState<QROrder[]>([]);
  const [participants, setParticipants] = useState<TableParticipant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const [nextTables, nextSessions, nextOrders, nextPayments] = await Promise.all([
      loadTables(restaurantSlug),
      loadLiveSessions(restaurantSlug),
      loadLiveOrders(restaurantSlug),
      loadPayments(restaurantSlug),
    ]);
    const nextParticipants = await loadParticipantsForSessions(nextSessions.map((session) => session.id));
    setTables(nextTables);
    setSessions(nextSessions);
    setOrders(nextOrders);
    setPayments(nextPayments);
    setParticipants(nextParticipants);
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

  return { tables, sessions, orders, participants, payments, loading, refresh };
}
