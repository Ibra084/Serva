"use client";

import { newId, num } from "@/lib/db-utils";
import { createClient } from "@/lib/supabase/client";
import {
  findActiveSessionForTable,
  findTableByNumber,
  getOrCreateActiveSession as getOrCreateDbSession,
  loadSessionById,
  updateSessionPaymentStatus,
  updateSessionStatus,
  updateSessionTotal,
} from "@/lib/live-store";
import { loadSessionOrders, saveQROrder, updateQROrderItems, updateQROrderStatus } from "@/lib/qr-store";
import type { LivePaymentStatus, LiveTableStatus, QRBasketItem, QROrder, TableParticipant } from "@/lib/types";

const GUEST_ID_KEY = "serva_guest_id";
const STORAGE_PREFIX = "serva:table-session:";
const CHANGE_EVENT = "serva:table-session-changed";

/** A participant is considered connected if it has heartbeated within this window (3x the poll interval). */
export const PARTICIPANT_ACTIVE_WINDOW_MS = 15_000;
export const PARTICIPANT_POLL_MS = 4_000;

/** Customers may edit or cancel a freshly submitted order for this long, while it's still "new". */
export const EDIT_WINDOW_MS = 2 * 60 * 1000;

export interface TableSessionState {
  restaurantSlug: string;
  tableId: string;
  /** Composite local identity (`restaurantSlug|tableId|guestId`) — what every store function addresses. */
  sessionId: string;
  guestId: string;
  /** Resolved `restaurant_tables.id`, once known. */
  tableRowId: string | null;
  /** Resolved `live_table_sessions.id` — the shared, table-wide session in Supabase. */
  dbSessionId: string | null;
  /** Private to this guest/device — never shared with other guests at the table. */
  cartItems: QRBasketItem[];
  /** Table-wide — hydrated from Supabase so every guest at the table sees the same bill. */
  submittedOrders: QROrder[];
  currentBillTotal: number;
  orderStatus: LiveTableStatus | "none";
  paymentStatus: LivePaymentStatus;
  createdAt: string;
  updatedAt: string;
}

function buildSessionId(restaurantSlug: string, tableId: string, guestId: string): string {
  return `${restaurantSlug}|${tableId}|${guestId}`;
}

function parseSessionId(sessionId: string): { restaurantSlug: string; tableId: string; guestId: string } {
  const [restaurantSlug, tableId, guestId] = sessionId.split("|");
  return { restaurantSlug, tableId, guestId };
}

/** Stable per-device anonymous id, reused across visits/tables at the same restaurant. */
export function getAnonymousGuestId(): string {
  if (typeof window === "undefined") return newId();
  const existing = window.localStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const id = newId();
  window.localStorage.setItem(GUEST_ID_KEY, id);
  return id;
}

function readLocal(sessionId: string): TableSessionState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_PREFIX + sessionId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TableSessionState;
  } catch {
    return null;
  }
}

function writeLocal(state: TableSessionState): TableSessionState {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_PREFIX + state.sessionId, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { sessionId: state.sessionId } }));
  }
  return state;
}

function touch(state: TableSessionState): TableSessionState {
  return { ...state, updatedAt: new Date().toISOString() };
}

function newState(restaurantSlug: string, tableId: string, guestId: string): TableSessionState {
  const now = new Date().toISOString();
  return {
    restaurantSlug,
    tableId,
    sessionId: buildSessionId(restaurantSlug, tableId, guestId),
    guestId,
    tableRowId: null,
    dbSessionId: null,
    cartItems: [],
    submittedOrders: [],
    currentBillTotal: 0,
    orderStatus: "none",
    paymentStatus: "unpaid",
    createdAt: now,
    updatedAt: now,
  };
}

function computeBillTotal(orders: QROrder[]): number {
  return orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + order.subtotal, 0);
}

/**
 * Pulls the table's shared session/orders down from Supabase and mirrors them onto local state.
 * Table-wide fields (submittedOrders/status/bill) are resolved by table, not by guest, so every
 * guest at the same table sees the same bill; `cartItems` is left untouched since it's private.
 */
async function hydrateFromRemote(state: TableSessionState): Promise<TableSessionState> {
  let tableRowId = state.tableRowId;
  if (!tableRowId) {
    const table = await findTableByNumber(state.restaurantSlug, state.tableId);
    tableRowId = table?.id ?? null;
  }

  let dbSessionId = state.dbSessionId;
  if (!dbSessionId && tableRowId) {
    const active = await findActiveSessionForTable(state.restaurantSlug, tableRowId);
    dbSessionId = active?.id ?? null;
  }

  let orderStatus = state.orderStatus;
  let paymentStatus = state.paymentStatus;
  let submittedOrders = state.submittedOrders;

  if (dbSessionId) {
    const [session, orders] = await Promise.all([
      loadSessionById(dbSessionId),
      loadSessionOrders(state.restaurantSlug, dbSessionId),
    ]);
    if (session) {
      orderStatus = session.status;
      paymentStatus = session.paymentStatus;
    }
    submittedOrders = orders;
  }

  return touch({
    ...state,
    tableRowId,
    dbSessionId,
    orderStatus,
    paymentStatus,
    submittedOrders,
    currentBillTotal: computeBillTotal(submittedOrders),
  });
}

/** Loads (and hydrates) the active session for this restaurant/table on this device, creating a fresh local one if none exists yet. */
export async function getOrCreateActiveSession(restaurantSlug: string, tableId: string): Promise<TableSessionState> {
  const guestId = getAnonymousGuestId();
  const sessionId = buildSessionId(restaurantSlug, tableId, guestId);
  const local = readLocal(sessionId) ?? newState(restaurantSlug, tableId, guestId);
  const hydrated = await hydrateFromRemote(local);
  return writeLocal(hydrated);
}

/** Same as `getOrCreateActiveSession` — kept as a distinct name to match read-only call sites. */
export async function loadActiveSession(restaurantSlug: string, tableId: string): Promise<TableSessionState> {
  return getOrCreateActiveSession(restaurantSlug, tableId);
}

export function saveSession(state: TableSessionState): TableSessionState {
  return writeLocal(touch(state));
}

function requireState(sessionId: string): TableSessionState {
  const state = readLocal(sessionId);
  if (!state) throw new Error(`No table session found for ${sessionId}`);
  return state;
}

export function addCartItem(sessionId: string, item: QRBasketItem): TableSessionState {
  const state = requireState(sessionId);
  const existing = state.cartItems.find((entry) => entry.dish === item.dish);
  const cartItems = existing
    ? state.cartItems.map((entry) =>
        entry.dish === item.dish ? { ...entry, quantity: entry.quantity + item.quantity } : entry
      )
    : [...state.cartItems, item];
  return saveSession({ ...state, cartItems });
}

export function updateCartItem(sessionId: string, dish: string, quantity: number): TableSessionState {
  const state = requireState(sessionId);
  const cartItems =
    quantity <= 0
      ? state.cartItems.filter((entry) => entry.dish !== dish)
      : state.cartItems.map((entry) => (entry.dish === dish ? { ...entry, quantity } : entry));
  return saveSession({ ...state, cartItems });
}

export function removeCartItem(sessionId: string, dish: string): TableSessionState {
  return updateCartItem(sessionId, dish, 0);
}

export function clearCart(sessionId: string): TableSessionState {
  const state = requireState(sessionId);
  return saveSession({ ...state, cartItems: [] });
}

export interface SubmitCartOptions {
  specialRequests?: string;
  aiRecommendedItems?: string[];
}

/** Submits the current cart as a new order under the table's shared session, without touching any prior orders. */
export async function submitCartAsOrder(sessionId: string, options: SubmitCartOptions = {}): Promise<TableSessionState> {
  const state = requireState(sessionId);
  if (state.cartItems.length === 0) return state;

  let tableRowId = state.tableRowId;
  if (!tableRowId) {
    const table = await findTableByNumber(state.restaurantSlug, state.tableId);
    tableRowId = table?.id ?? null;
  }

  let dbSessionId = state.dbSessionId;
  if (tableRowId && !dbSessionId) {
    const dbSession = await getOrCreateDbSession(state.restaurantSlug, tableRowId);
    dbSessionId = dbSession?.id ?? null;
  }

  const subtotal = state.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const order: QROrder = {
    orderId: newId(),
    restaurantId: state.restaurantSlug,
    tableId: state.tableId,
    sessionId: dbSessionId,
    timestamp: new Date().toISOString(),
    items: state.cartItems,
    subtotal,
    source: "qr",
    aiRecommendedItems: options.aiRecommendedItems ?? [],
    specialRequests: options.specialRequests?.trim() ?? "",
    status: "new",
  };

  const orderRowId = await saveQROrder(state.restaurantSlug, order);
  if (dbSessionId) {
    await updateSessionStatus(state.restaurantSlug, dbSessionId, "order_placed");
    await updateSessionTotal(state.restaurantSlug, dbSessionId, state.currentBillTotal + subtotal);
  }

  const submittedOrder: QROrder = { ...order, id: orderRowId ?? undefined };
  return saveSession({
    ...state,
    tableRowId,
    dbSessionId,
    cartItems: [],
    submittedOrders: [submittedOrder, ...state.submittedOrders],
    currentBillTotal: state.currentBillTotal + subtotal,
    orderStatus: "order_placed",
  });
}

export function editWindowRemainingMs(order: QROrder): number {
  if (order.status !== "new") return 0;
  const elapsed = Date.now() - new Date(order.timestamp).getTime();
  return Math.max(0, EDIT_WINDOW_MS - elapsed);
}

export function canEditOrder(order: QROrder): boolean {
  return order.status === "new" && editWindowRemainingMs(order) > 0;
}

/** Edits/resubmits a not-yet-locked order's items in place. No-ops once the edit window has closed or the order isn't "new". */
export async function editSubmittedOrder(
  sessionId: string,
  orderId: string,
  updatedItems: QRBasketItem[]
): Promise<TableSessionState> {
  const state = requireState(sessionId);
  const order = state.submittedOrders.find((entry) => entry.orderId === orderId);
  if (!order?.id || !canEditOrder(order)) return state;

  const subtotal = updatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const ok = await updateQROrderItems(state.restaurantSlug, order.id, updatedItems, subtotal);
  if (!ok) return state;

  const delta = subtotal - order.subtotal;
  if (state.dbSessionId) {
    await updateSessionTotal(state.restaurantSlug, state.dbSessionId, state.currentBillTotal + delta);
  }

  return saveSession({
    ...state,
    submittedOrders: state.submittedOrders.map((entry) =>
      entry.orderId === orderId ? { ...entry, items: updatedItems, subtotal } : entry
    ),
    currentBillTotal: state.currentBillTotal + delta,
  });
}

/** Cancels a not-yet-locked order. No-ops once the edit window has closed or the order isn't "new". */
export async function cancelSubmittedOrder(sessionId: string, orderId: string): Promise<TableSessionState> {
  const state = requireState(sessionId);
  const order = state.submittedOrders.find((entry) => entry.orderId === orderId);
  if (!order?.id || !canEditOrder(order)) return state;

  await updateQROrderStatus(state.restaurantSlug, orderId, "cancelled");
  if (state.dbSessionId) {
    await updateSessionTotal(
      state.restaurantSlug,
      state.dbSessionId,
      Math.max(0, state.currentBillTotal - order.subtotal)
    );
  }

  return saveSession({
    ...state,
    submittedOrders: state.submittedOrders.map((entry) =>
      entry.orderId === orderId ? { ...entry, status: "cancelled" } : entry
    ),
    currentBillTotal: Math.max(0, state.currentBillTotal - order.subtotal),
  });
}

export async function requestBill(sessionId: string): Promise<TableSessionState> {
  const state = requireState(sessionId);
  if (!state.dbSessionId) return state;
  await updateSessionStatus(state.restaurantSlug, state.dbSessionId, "ready_to_pay");
  return saveSession({ ...state, orderStatus: "ready_to_pay" });
}

export async function markPaid(sessionId: string): Promise<TableSessionState> {
  const state = requireState(sessionId);
  if (!state.dbSessionId) return state;
  await updateSessionStatus(state.restaurantSlug, state.dbSessionId, "paid");
  await updateSessionPaymentStatus(state.restaurantSlug, state.dbSessionId, "paid");
  return saveSession({ ...state, orderStatus: "paid", paymentStatus: "paid" });
}

/** Re-pulls the table's shared session/orders from Supabase — call on a timer to notice staff-driven changes (preparing, paid, etc). */
export async function refreshSession(sessionId: string): Promise<TableSessionState> {
  const state = requireState(sessionId);
  const hydrated = await hydrateFromRemote(state);
  return writeLocal(hydrated);
}

/**
 * Cross-tab local demo sync: fires when another tab/window writes this same session (e.g. a second
 * device-tab open at the same table). Deliberately only listens to the native `storage` event, which
 * browsers never fire back at the tab that made the write — callers already update their own state
 * directly after each mutation, so echoing same-tab writes here would just recurse into `writeLocal`.
 */
export function subscribeToTableSession(sessionId: string, onChange: () => void): () => void {
  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_PREFIX + sessionId) onChange();
  }
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

// ============================================================================
// Participants: multiple devices joined to the same table's shared session.
// ============================================================================

function rowToParticipant(row: Record<string, unknown>): TableParticipant {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    deviceId: row.device_id as string,
    displayName: row.display_name as string,
    joinedAt: row.joined_at as string,
    lastSeenAt: row.last_seen_at as string,
    isActive: Boolean(row.is_active),
    amountPaid: num(row.amount_paid),
    assignedItems: (row.assigned_items as string[] | null) ?? undefined,
  };
}

export function isParticipantConnected(participant: TableParticipant): boolean {
  return participant.isActive && Date.now() - new Date(participant.lastSeenAt).getTime() < PARTICIPANT_ACTIVE_WINDOW_MS;
}

/**
 * Registers this device as a participant of the table's shared DB session (creating the row on first
 * visit, refreshing `lastSeenAt` on repeat visits), defaulting its display name to "Guest N" by join order.
 * No-ops (returns null) until the table has a resolved shared session — i.e. before any order exists.
 */
export async function joinTableSession(
  restaurantSlug: string,
  dbSessionId: string,
  deviceId: string
): Promise<TableParticipant | null> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("table_participants")
    .select("*")
    .eq("session_id", dbSessionId)
    .eq("device_id", deviceId)
    .maybeSingle();

  if (existing) {
    const { data: touched } = await supabase
      .from("table_participants")
      .update({ last_seen_at: new Date().toISOString(), is_active: true })
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
    return rowToParticipant(touched ?? existing);
  }

  const { count } = await supabase
    .from("table_participants")
    .select("id", { count: "exact", head: true })
    .eq("session_id", dbSessionId);

  const { data: created, error } = await supabase
    .from("table_participants")
    .insert({
      session_id: dbSessionId,
      device_id: deviceId,
      display_name: `Guest ${(count ?? 0) + 1}`,
    })
    .select("*")
    .maybeSingle();
  if (error || !created) return null;
  return rowToParticipant(created);
}

export async function updateParticipantName(participantId: string, name: string): Promise<TableParticipant | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("table_participants")
    .update({ display_name: trimmed })
    .eq("id", participantId)
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return rowToParticipant(data);
}

/** Call on a timer while a device is on the QR page, so other devices see it as connected. */
export async function heartbeatParticipant(participantId: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("table_participants")
    .update({ last_seen_at: new Date().toISOString(), is_active: true })
    .eq("id", participantId);
}

/** All participants for the table's shared session, connected ones first. */
export async function getActiveParticipants(dbSessionId: string): Promise<TableParticipant[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("table_participants")
    .select("*")
    .eq("session_id", dbSessionId)
    .order("joined_at", { ascending: true });
  return (data ?? []).map(rowToParticipant);
}

/** Owner-portal read: participants across several sessions at once (e.g. the whole live floor). */
export async function loadParticipantsForSessions(sessionIds: string[]): Promise<TableParticipant[]> {
  if (sessionIds.length === 0) return [];
  const supabase = createClient();
  const { data } = await supabase.from("table_participants").select("*").in("session_id", sessionIds);
  return (data ?? []).map(rowToParticipant);
}

/** Subscribes to realtime participant changes for one session; caller should also poll as a fallback. Returns an unsubscribe fn. */
export function subscribeToParticipants(dbSessionId: string, onChange: () => void): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`participants-${dbSessionId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "table_participants", filter: `session_id=eq.${dbSessionId}` },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export { parseSessionId };
