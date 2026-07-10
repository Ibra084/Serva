"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addOrder,
  addPayment,
  addToCartDraft,
  calculateBill,
  clearCartDraft,
  getActiveSession,
  getAnonymousGuestId,
  getOrCreateSession,
  heartbeatParticipant,
  isParticipantConnected,
  joinSession,
  readCartDraft,
  requestBill,
  SESSION_POLL_MS,
  startNewVisit,
  subscribeToSessionRealtime,
  subscribeToSessionsChanged,
  updateCartDraftQuantity,
  updateParticipantName,
  type AddOrderOptions,
  type Bill,
  type SplitMode,
  type TableSession,
} from "@/lib/session-store";
import type { MenuItem, QRBasketItem } from "@/lib/types";

export interface UseSessionResult {
  session: TableSession | null;
  cart: QRBasketItem[];
  bill: Bill | null;
  selfParticipantId: string | null;
  connectedUnpaidParticipantCount: number;
  loading: boolean;
  error: string | null;
  addToCart: (item: MenuItem, quantity?: number) => void;
  updateCartQuantity: (dish: string, quantity: number) => void;
  clearCart: () => void;
  submitCart: (options?: AddOrderOptions) => Promise<boolean>;
  requestBillAction: () => Promise<void>;
  paySplit: (amount: number, splitMode: SplitMode) => Promise<boolean>;
  renameSelf: (name: string) => Promise<void>;
  startNewVisitAction: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * The QR customer page's single source of truth. `getOrCreateSession` returns the table's current
 * session whatever its status — including paid/closed, so the page can show the right one of the
 * four welcome states — but only `submitCart` (via `addOrder`) ever adds to it, and that call is
 * refused server-side once the session is paid or closed. The cart is a local, per-session draft
 * that lives in this hook's state and a small localStorage mirror; it is never part of the session
 * itself and is never copied across sessions, so `startNewVisitAction` always starts empty.
 */
export function useSession(restaurantSlug: string, tableId: string | null): UseSessionResult {
  const [session, setSession] = useState<TableSession | null>(null);
  const [cart, setCart] = useState<QRBasketItem[]>([]);
  const [selfParticipantId, setSelfParticipantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(tableId));
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<TableSession | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const cartRef = useRef<QRBasketItem[]>([]);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  // Strict Mode double-invokes effects in dev; a shared in-flight promise per key means the
  // (idempotent, find-or-create) fetch only actually runs once, while both invocations still
  // resolve correctly — see the equivalent comment in the previous iteration of this hook.
  const inFlightRef = useRef<{ key: string; promise: Promise<TableSession | null> } | null>(null);

  useEffect(() => {
    if (!tableId) {
      setLoading(false);
      return;
    }
    const key = `${restaurantSlug}|${tableId}`;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        let entry = inFlightRef.current;
        if (!entry || entry.key !== key) {
          entry = { key, promise: getOrCreateSession(restaurantSlug, tableId) };
          inFlightRef.current = entry;
        }
        const result = await entry.promise;
        if (cancelled) return;
        setSession(result);
        setCart(result ? readCartDraft(result.sessionId) : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load table session");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantSlug, tableId]);

  /** Re-reads the table's current session (whatever its latest status is) — never creates one. */
  const refresh = useCallback(async () => {
    if (!tableId) return;
    const result = await getActiveSession(restaurantSlug, tableId);
    setSession(result);
  }, [restaurantSlug, tableId]);

  // Realtime + poll fallback, plus same-browser cross-tab sync (custom event / storage ping).
  useEffect(() => {
    if (!session?.sessionId) return;
    const sessionId = session.sessionId;
    const unsubscribeRealtime = subscribeToSessionRealtime(sessionId, refresh);
    const unsubscribeSync = subscribeToSessionsChanged(refresh);
    const interval = setInterval(() => {
      if (selfParticipantId) void heartbeatParticipant(selfParticipantId);
      void refresh();
    }, SESSION_POLL_MS);
    return () => {
      unsubscribeRealtime();
      unsubscribeSync();
      clearInterval(interval);
    };
  }, [session?.sessionId, selfParticipantId, refresh]);

  // Registers this device as a participant of the session once it exists.
  useEffect(() => {
    if (!session?.sessionId || session.status === "closed") {
      setSelfParticipantId(null);
      return;
    }
    const sessionId = session.sessionId;
    let cancelled = false;
    (async () => {
      const participant = await joinSession(sessionId, getAnonymousGuestId());
      if (!cancelled) setSelfParticipantId(participant?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.sessionId, session?.status]);

  const addToCart = useCallback((item: MenuItem, quantity = 1) => {
    const sessionId = sessionRef.current?.sessionId;
    if (!sessionId) return;
    setCart(addToCartDraft(sessionId, item, quantity));
  }, []);

  const updateCartQuantity = useCallback((dish: string, quantity: number) => {
    const sessionId = sessionRef.current?.sessionId;
    if (!sessionId) return;
    setCart(updateCartDraftQuantity(sessionId, dish, quantity));
  }, []);

  const clearCart = useCallback(() => {
    const sessionId = sessionRef.current?.sessionId;
    if (!sessionId) return;
    setCart(clearCartDraft(sessionId));
  }, []);

  const submitCart = useCallback(async (options: AddOrderOptions = {}): Promise<boolean> => {
    const current = sessionRef.current;
    const items = cartRef.current;
    if (!current || items.length === 0) return false;
    const order = await addOrder(current.sessionId, items, options);
    if (!order) return false;
    clearCartDraft(current.sessionId);
    setCart([]);
    await refresh();
    return true;
  }, [refresh]);

  const requestBillAction = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    await requestBill(current.sessionId);
    await refresh();
  }, [refresh]);

  const paySplit = useCallback(async (amount: number, splitMode: SplitMode): Promise<boolean> => {
    const current = sessionRef.current;
    if (!current || !selfParticipantId || amount <= 0) return false;
    const payment = await addPayment(current.sessionId, { participantId: selfParticipantId, amount, splitMode });
    await refresh();
    return payment !== null;
  }, [selfParticipantId, refresh]);

  const renameSelf = useCallback(async (name: string) => {
    if (!selfParticipantId) return;
    await updateParticipantName(selfParticipantId, name);
    await refresh();
  }, [selfParticipantId, refresh]);

  const startNewVisitAction = useCallback(async () => {
    if (!tableId) return;
    const fresh = await startNewVisit(restaurantSlug, tableId);
    setSession(fresh);
    setSelfParticipantId(null);
    setCart(fresh ? readCartDraft(fresh.sessionId) : []);
  }, [restaurantSlug, tableId]);

  const bill = session ? calculateBill(session) : null;
  const connectedUnpaidParticipantCount =
    session?.participants.filter((participant) => isParticipantConnected(participant) && participant.amountPaid <= 0).length ?? 0;

  return {
    session,
    cart,
    bill,
    selfParticipantId,
    connectedUnpaidParticipantCount,
    loading,
    error,
    addToCart,
    updateCartQuantity,
    clearCart,
    submitCart,
    requestBillAction,
    paySplit,
    renameSelf,
    startNewVisitAction,
    refresh,
  };
}
