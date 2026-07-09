"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeToSessionOrders } from "@/lib/qr-store";
import { subscribeToSession } from "@/lib/live-store";
import { calculateBill, createDemoPayment, type SessionBill } from "@/lib/bill-splitting";
import type { SplitMode } from "@/lib/types";
import {
  applyAddToCart,
  applyClearCart,
  applyRemoveFromCart,
  applyUpdateCartQuantity,
  buildCartItemId,
  cancelSubmittedOrder as cancelSubmittedOrderRemote,
  canEditOrder,
  debugLog,
  editSubmittedOrder as editSubmittedOrderRemote,
  fetchRemotePatch,
  getActiveParticipants,
  getAnonymousGuestId,
  getOrCreateActiveSession,
  heartbeatParticipant,
  joinTableSession,
  patchLocalSession,
  PARTICIPANT_POLL_MS,
  prepareSubmitCart,
  persistSubmittedOrder,
  readLocalSession,
  REMOTE_POLL_MS,
  requestBillForSession,
  subscribeToParticipants,
  subscribeToTableSession,
  updateParticipantName,
  type SubmitCartOptions,
  type TableSessionState,
} from "@/lib/table-session-store";
import type { QRBasketItem, MenuItem, TableParticipant } from "@/lib/types";

export interface UseTableSessionResult {
  session: TableSessionState | null;
  participants: TableParticipant[];
  selfParticipantId: string | null;
  sessionBill: SessionBill | null;
  loading: boolean;
  error: string | null;
  addToCart: (item: MenuItem, quantity?: number) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  submitCart: (options?: SubmitCartOptions) => Promise<void>;
  editOrderItem: (orderId: string, dish: string, quantity: number) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  requestBill: () => Promise<void>;
  paySplit: (amount: number, splitMode: SplitMode) => Promise<void>;
  renameSelf: (name: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Single source of truth for the QR customer page: one active `TableSessionState`, its participants,
 * and the derived bill. Every mutation goes through a functional state update against the *current*
 * React state (never a re-read of localStorage mid-flight), and every background refresh (realtime,
 * polling, cross-tab storage events) merges only the remote-owned fields — it can never overwrite the
 * cart, which is the class of bug this hook exists to rule out structurally rather than by convention.
 */
export function useTableSession(restaurantSlug: string, tableId: string | null): UseTableSessionResult {
  const [session, setSession] = useState<TableSessionState | null>(null);
  const [participants, setParticipants] = useState<TableParticipant[]>([]);
  const [selfParticipantId, setSelfParticipantId] = useState<string | null>(null);
  const [sessionBill, setSessionBill] = useState<SessionBill | null>(null);
  const [loading, setLoading] = useState(Boolean(tableId));
  const [error, setError] = useState<string | null>(null);

  // Mirrors `session` for async orchestrators that need a synchronous read of "current" state
  // (e.g. to know which order id to patch after an insert). Never used to *compute* the next
  // state — every actual state transition goes through setSession's functional updater instead.
  const sessionRef = useRef<TableSessionState | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Strict Mode double-invokes effects in dev (mount → cleanup → mount again). A naive "ran already"
  // ref would make the second mount a no-op and — since the first mount's own cleanup marks its
  // result stale — the session would never actually load. Instead this shares one in-flight promise
  // per key across both invocations: the first mount kicks off the (idempotent, find-or-create)
  // fetch and gets cancelled before it resolves, the second mount reuses that same promise and is
  // the one that actually commits the result, and the network call itself only ever fires once.
  const inFlightRef = useRef<{ key: string; promise: Promise<TableSessionState> } | null>(null);

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
          entry = { key, promise: getOrCreateActiveSession(restaurantSlug, tableId) };
          inFlightRef.current = entry;
        }
        const state = await entry.promise;
        if (cancelled) return;
        setSession(state);
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

  /** Re-pulls the table's shared session/orders and merges only the remote-owned fields — cart is never touched. */
  const refresh = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    const patch = await fetchRemotePatch(current);
    setSession((prev) => {
      if (!prev) return prev;
      const next: TableSessionState = { ...prev, ...patch, updatedAt: new Date().toISOString() };
      patchLocalSession(next.sessionId, patch);
      debugLog("polling merge", next.sessionId, next.cartItems.length);
      return next;
    });
  }, []);

  // Realtime + poll fallback for orders/session status (staff marking preparing/served/paid, bill requests).
  useEffect(() => {
    if (!session?.dbSessionId) return;
    const dbSessionId = session.dbSessionId;
    refresh();
    const unsubscribeOrders = subscribeToSessionOrders(dbSessionId, refresh);
    const unsubscribeSession = subscribeToSession(dbSessionId, refresh);
    const interval = setInterval(refresh, REMOTE_POLL_MS);
    return () => {
      unsubscribeOrders();
      unsubscribeSession();
      clearInterval(interval);
    };
  }, [session?.dbSessionId, refresh]);

  // Cross-tab sync: another tab (same device) changed the shared session. Merge remote-owned fields
  // straight from what it just wrote to storage — never re-fetch, and never touch this tab's own cart.
  useEffect(() => {
    if (!session) return;
    const sessionId = session.sessionId;
    return subscribeToTableSession(sessionId, () => {
      const stored = readLocalSession(sessionId);
      if (!stored) return;
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tableRowId: stored.tableRowId,
          dbSessionId: stored.dbSessionId,
          orderStatus: stored.orderStatus,
          paymentStatus: stored.paymentStatus,
          submittedOrders: stored.submittedOrders,
          currentBillTotal: stored.currentBillTotal,
          updatedAt: new Date().toISOString(),
        };
      });
    });
  }, [session?.sessionId]);

  // Registers this device as a participant of the table's shared session once it exists.
  useEffect(() => {
    if (!session?.dbSessionId) return;
    const dbSessionId = session.dbSessionId;
    let cancelled = false;
    (async () => {
      const participant = await joinTableSession(restaurantSlug, dbSessionId, getAnonymousGuestId());
      if (!cancelled) setSelfParticipantId(participant?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantSlug, session?.dbSessionId]);

  // Keeps this device "connected" and picks up other guests joining/renaming — realtime plus a poll fallback.
  useEffect(() => {
    if (!session?.dbSessionId) {
      setParticipants([]);
      return;
    }
    const dbSessionId = session.dbSessionId;
    let cancelled = false;

    async function refreshParticipants() {
      const list = await getActiveParticipants(dbSessionId);
      if (!cancelled) setParticipants(list);
    }

    refreshParticipants();
    const interval = setInterval(() => {
      if (selfParticipantId) void heartbeatParticipant(selfParticipantId);
      void refreshParticipants();
    }, PARTICIPANT_POLL_MS);
    const unsubscribe = subscribeToParticipants(dbSessionId, refreshParticipants);
    return () => {
      cancelled = true;
      clearInterval(interval);
      unsubscribe();
    };
  }, [session?.dbSessionId, selfParticipantId]);

  // Recomputes the shared bill (and how much of it other guests have already paid).
  useEffect(() => {
    if (!session?.dbSessionId) {
      setSessionBill(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await calculateBill(session);
      if (!cancelled) setSessionBill(result);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.dbSessionId, session?.submittedOrders, session?.paymentStatus, participants]);

  const addToCart = useCallback((item: MenuItem, quantity = 1) => {
    const basketItem: QRBasketItem = { dish: item.dish, category: item.category, price: item.price, quantity };
    setSession((prev) => {
      if (!prev) return prev;
      const next = applyAddToCart(prev, basketItem);
      patchLocalSession(next.sessionId, { cartItems: next.cartItems });
      debugLog("cart item added", next.sessionId, next.cartItems.length);
      return next;
    });
  }, []);

  const updateCartQuantity = useCallback((cartItemId: string, quantity: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = applyUpdateCartQuantity(prev, cartItemId, quantity);
      patchLocalSession(next.sessionId, { cartItems: next.cartItems });
      debugLog("cart saved", next.sessionId, next.cartItems.length);
      return next;
    });
  }, []);

  const removeFromCart = useCallback((cartItemId: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = applyRemoveFromCart(prev, cartItemId);
      patchLocalSession(next.sessionId, { cartItems: next.cartItems });
      debugLog("cart saved", next.sessionId, next.cartItems.length);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = applyClearCart(prev);
      patchLocalSession(next.sessionId, { cartItems: next.cartItems });
      debugLog("cart saved", next.sessionId, next.cartItems.length);
      return next;
    });
  }, []);

  const submitCart = useCallback(async (options: SubmitCartOptions = {}) => {
    const current = sessionRef.current;
    if (!current || current.cartItems.length === 0) return;

    const { optimisticOrder } = prepareSubmitCart(current, options);

    setSession((prev) => {
      if (!prev) return prev;
      const next: TableSessionState = {
        ...prev,
        cartItems: [],
        submittedOrders: [optimisticOrder, ...prev.submittedOrders],
        currentBillTotal: prev.currentBillTotal + optimisticOrder.subtotal,
        orderStatus: "order_placed",
        updatedAt: new Date().toISOString(),
      };
      patchLocalSession(next.sessionId, {
        cartItems: next.cartItems,
        submittedOrders: next.submittedOrders,
        currentBillTotal: next.currentBillTotal,
        orderStatus: next.orderStatus,
      });
      debugLog("cart saved (submit)", next.sessionId, next.cartItems.length);
      return next;
    });

    const result = await persistSubmittedOrder(restaurantSlug, current, optimisticOrder);

    setSession((prev) => {
      if (!prev) return prev;
      const next: TableSessionState = {
        ...prev,
        tableRowId: result.tableRowId ?? prev.tableRowId,
        dbSessionId: result.dbSessionId ?? prev.dbSessionId,
        submittedOrders: prev.submittedOrders.map((order) =>
          order.orderId === optimisticOrder.orderId
            ? { ...order, id: result.orderRowId ?? undefined, sessionId: result.dbSessionId }
            : order
        ),
        updatedAt: new Date().toISOString(),
      };
      patchLocalSession(next.sessionId, {
        tableRowId: next.tableRowId,
        dbSessionId: next.dbSessionId,
        submittedOrders: next.submittedOrders,
      });
      return next;
    });
  }, [restaurantSlug]);

  const editOrderItem = useCallback(async (orderId: string, dish: string, quantity: number) => {
    const current = sessionRef.current;
    const order = current?.submittedOrders.find((entry) => entry.orderId === orderId);
    if (!current || !order) return;
    const updatedItems =
      quantity <= 0
        ? order.items.filter((entry) => entry.dish !== dish)
        : order.items.map((entry) => (entry.dish === dish ? { ...entry, quantity } : entry));

    const result = await editSubmittedOrderRemote(restaurantSlug, order, updatedItems);
    if (!result) return;

    setSession((prev) => {
      if (!prev) return prev;
      const next: TableSessionState = {
        ...prev,
        submittedOrders: prev.submittedOrders.map((entry) =>
          entry.orderId === orderId ? { ...entry, items: result.items, subtotal: result.subtotal } : entry
        ),
        currentBillTotal: prev.currentBillTotal + result.delta,
        updatedAt: new Date().toISOString(),
      };
      patchLocalSession(next.sessionId, { submittedOrders: next.submittedOrders, currentBillTotal: next.currentBillTotal });
      return next;
    });
  }, [restaurantSlug]);

  const cancelOrder = useCallback(async (orderId: string) => {
    const current = sessionRef.current;
    const order = current?.submittedOrders.find((entry) => entry.orderId === orderId);
    if (!current || !order) return;
    const ok = await cancelSubmittedOrderRemote(restaurantSlug, order);
    if (!ok) return;

    setSession((prev) => {
      if (!prev) return prev;
      const next: TableSessionState = {
        ...prev,
        submittedOrders: prev.submittedOrders.map((entry) =>
          entry.orderId === orderId ? { ...entry, status: "cancelled" } : entry
        ),
        currentBillTotal: Math.max(0, prev.currentBillTotal - order.subtotal),
        updatedAt: new Date().toISOString(),
      };
      patchLocalSession(next.sessionId, { submittedOrders: next.submittedOrders, currentBillTotal: next.currentBillTotal });
      return next;
    });
  }, [restaurantSlug]);

  const requestBill = useCallback(async () => {
    const current = sessionRef.current;
    if (!current?.dbSessionId) return;
    await requestBillForSession(restaurantSlug, current.dbSessionId);
    setSession((prev) => {
      if (!prev) return prev;
      const next: TableSessionState = { ...prev, orderStatus: "ready_to_pay", updatedAt: new Date().toISOString() };
      patchLocalSession(next.sessionId, { orderStatus: next.orderStatus });
      return next;
    });
  }, [restaurantSlug]);

  const paySplit = useCallback(async (amount: number, splitMode: SplitMode) => {
    const current = sessionRef.current;
    if (!current?.dbSessionId || !selfParticipantId || amount <= 0) return;

    await createDemoPayment({
      restaurantSlug,
      dbSessionId: current.dbSessionId,
      tableRowId: current.tableRowId,
      orderId: current.submittedOrders[0]?.id ?? null,
      participantId: selfParticipantId,
      amount,
      splitMode,
    });

    await refresh();
    const latest = sessionRef.current;
    if (latest) setSessionBill(await calculateBill(latest));
  }, [restaurantSlug, selfParticipantId, refresh]);

  const renameSelf = useCallback(async (name: string) => {
    if (!selfParticipantId) return;
    const updated = await updateParticipantName(selfParticipantId, name);
    if (!updated) return;
    setParticipants((prev) => prev.map((participant) => (participant.id === updated.id ? updated : participant)));
  }, [selfParticipantId]);

  return {
    session,
    participants,
    selfParticipantId,
    sessionBill,
    loading,
    error,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    submitCart,
    editOrderItem,
    cancelOrder,
    requestBill,
    paySplit,
    renameSelf,
    refresh,
  };
}

export { buildCartItemId, canEditOrder };
