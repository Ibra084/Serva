"use client";

// ============================================================================
// The one table-session store. Every QR/live/dashboard/insights page reads and
// writes sessions exclusively through this file — there is no other place in
// the app that talks to `live_table_sessions`, `qr_orders`, `payments`, or
// `table_participants`.
//
// Core rule: a table always has at most one *addable* session — the most
// recent one, if it isn't paid or closed. Paid/closed sessions are terminal:
// they stay reachable for viewing (receipt, live-view history) but `addOrder`
// refuses to attach anything new to them. The only way forward from a paid or
// closed session is `startNewVisit`, which always creates a brand new session
// with empty orders/payments/participants — never copies anything over.
//
// Storage: Supabase is the real, cross-device source of truth (this is a
// multi-device product — a customer's phone and the owner's tablet must see
// the same session). `localStorage` is used only for two purely-local things
// that must never leave this device: the anonymous guest/device id, and the
// draft cart before it's submitted as an order.
// ============================================================================

import { createClient } from "@/lib/supabase/client";
import { newId, num } from "@/lib/db-utils";
import type { MenuItem, QRBasketItem, RestaurantTable } from "@/lib/types";

const GUEST_ID_KEY = "serva_guest_id";
const CART_PREFIX = "serva:cart:";
const SYNC_EVENT = "serva:sessions-updated";
const SYNC_PING_KEY = "serva:sessions-ping";

export const PARTICIPANT_ACTIVE_WINDOW_MS = 15_000;
export const PARTICIPANT_POLL_MS = 4_000;
export const SESSION_POLL_MS = 5_000;

/** Placeholder rates — not restaurant-configurable yet. */
export const SERVICE_CHARGE_PCT = 0.1;
export const VAT_PCT = 0.05;

const DEBUG = process.env.NODE_ENV !== "production";
export function debugLog(event: string, detail: Record<string, unknown>) {
  if (DEBUG) console.debug(`[session-store] ${event}`, detail);
}

// ============================================================================
// Types
// ============================================================================

export type SessionStatus = "active" | "bill_requested" | "partially_paid" | "paid" | "closed";
export type SessionOrderStatus = "new" | "preparing" | "served" | "cancelled";
export type SessionPaymentStatus = "unpaid" | "partially_paid" | "paid";
export type SplitMode = "full" | "equal" | "custom";

export interface SessionOrderItem {
  dish: string;
  category: string;
  price: number;
  quantity: number;
}

export interface SessionOrder {
  orderId: string;
  sessionId: string;
  tableId: string;
  status: SessionOrderStatus;
  items: SessionOrderItem[];
  subtotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionPayment {
  paymentId: string;
  sessionId: string;
  participantId: string | null;
  amount: number;
  tipAmount: number;
  splitMode: SplitMode;
  status: "paid";
  createdAt: string;
}

export interface SessionParticipant {
  id: string;
  sessionId: string;
  deviceId: string;
  displayName: string;
  joinedAt: string;
  lastSeenAt: string;
  isActive: boolean;
  amountPaid: number;
}

export interface Bill {
  subtotal: number;
  serviceCharge: number;
  vat: number;
  tip: number;
  total: number;
  amountPaid: number;
  remaining: number;
}

export interface TableSession {
  sessionId: string;
  restaurantSlug: string;
  tableId: string;
  /** Internal FK to `restaurant_tables.id` — needed to attach new orders, not part of the display model. */
  tableRowId: string;
  status: SessionStatus;
  paymentStatus: SessionPaymentStatus;
  orders: SessionOrder[];
  payments: SessionPayment[];
  participants: SessionParticipant[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function notifySessionsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  // A same-browser second tab doesn't see the CustomEvent above (it's document-local), so also
  // bump a throwaway localStorage key purely to trigger the native `storage` event there —
  // that tab then refetches from Supabase instead of waiting for its next poll tick.
  window.localStorage.setItem(SYNC_PING_KEY, String(Date.now()));
}

/** Pages call this once to reload their sessions whenever anything changes — this tab's own writes, another tab's writes, realtime, or the poll fallback. */
export function subscribeToSessionsChanged(onChange: () => void): () => void {
  function handleStorage(event: StorageEvent) {
    if (event.key === SYNC_PING_KEY) onChange();
  }
  window.addEventListener(SYNC_EVENT, onChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(SYNC_EVENT, onChange);
    window.removeEventListener("storage", handleStorage);
  };
}

// ============================================================================
// Restaurant/table registry
// ============================================================================

export const DEFAULT_TABLE_NUMBERS = ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08"];

async function resolveRestaurantId(restaurantSlug: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.from("restaurants").select("id").eq("slug", restaurantSlug).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

function rowToTable(row: Record<string, unknown>, restaurantSlug: string): RestaurantTable {
  return {
    id: row.id as string,
    restaurantId: restaurantSlug,
    tableNumber: row.table_number as string,
    seats: num(row.seats, 2),
    zone: (row.zone as string | null) ?? null,
    displayOrder: num(row.display_order, 0),
  };
}

/** Reads the table registry, lazily seeding the default T01–T08 set the first time a restaurant is loaded. */
export async function loadTables(restaurantSlug: string): Promise<RestaurantTable[]> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from("restaurant_tables")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("display_order", { ascending: true });

  if (data && data.length > 0) return data.map((row) => rowToTable(row, restaurantSlug));

  const seedRows = DEFAULT_TABLE_NUMBERS.map((tableNumber, index) => ({
    restaurant_id: restaurantId,
    table_number: tableNumber,
    seats: 2,
    display_order: index,
  }));
  const { data: inserted } = await supabase.from("restaurant_tables").insert(seedRows).select("*");
  return (inserted ?? []).map((row) => rowToTable(row, restaurantSlug));
}

async function findTableByNumber(restaurantSlug: string, tableNumber: string): Promise<RestaurantTable | null> {
  const tables = await loadTables(restaurantSlug);
  return tables.find((table) => table.tableNumber === tableNumber) ?? null;
}

// ============================================================================
// Row <-> domain-type mapping
// ============================================================================

function rowToOrder(row: Record<string, unknown>, tableId: string): SessionOrder {
  return {
    orderId: row.id as string,
    sessionId: (row.session_id as string | null) ?? "",
    tableId,
    status: row.status as SessionOrderStatus,
    subtotal: num(row.subtotal),
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string | null) ?? (row.created_at as string),
    items: ((row.qr_order_items ?? []) as Record<string, unknown>[]).map((item) => ({
      dish: item.dish as string,
      category: item.category as string,
      price: num(item.price),
      quantity: num(item.quantity),
    })),
  };
}

function rowToPayment(row: Record<string, unknown>): SessionPayment {
  return {
    paymentId: row.id as string,
    sessionId: (row.session_id as string | null) ?? "",
    participantId: (row.participant_id as string | null) ?? null,
    amount: num(row.amount),
    tipAmount: num(row.tip_amount),
    splitMode: row.split_type as SplitMode,
    status: "paid",
    createdAt: row.created_at as string,
  };
}

function rowToParticipant(row: Record<string, unknown>): SessionParticipant {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    deviceId: row.device_id as string,
    displayName: row.display_name as string,
    joinedAt: row.joined_at as string,
    lastSeenAt: row.last_seen_at as string,
    isActive: Boolean(row.is_active),
    amountPaid: num(row.amount_paid),
  };
}

/** Deterministic bill: fixed placeholder service charge/VAT, no hidden state — same inputs always produce the same output. */
export function calculateBill(session: Pick<TableSession, "orders" | "payments">, tipAmount = 0): Bill {
  const activeItems = session.orders.filter((order) => order.status !== "cancelled").flatMap((order) => order.items);
  const subtotal = round2(activeItems.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const serviceCharge = round2(subtotal * SERVICE_CHARGE_PCT);
  const vat = round2((subtotal + serviceCharge) * VAT_PCT);
  const tip = round2(tipAmount);
  const total = round2(subtotal + serviceCharge + vat + tip);
  const amountPaid = round2(session.payments.reduce((sum, payment) => sum + payment.amount, 0));
  const remaining = Math.max(0, round2(total - amountPaid));
  return { subtotal, serviceCharge, vat, tip, total, amountPaid, remaining };
}

/** Splits whatever remains equally across active, not-yet-paid participants (recalculated live, not a fixed pre-assigned share). */
export function calculateEqualSplit(remaining: number, activeUnpaidParticipantCount: number): number {
  if (activeUnpaidParticipantCount <= 0) return remaining;
  return round2(remaining / activeUnpaidParticipantCount);
}

/** Validates a custom payment amount against the remaining balance. */
export function validateCustomAmount(remaining: number, amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= remaining + 0.01;
}

export function isParticipantConnected(participant: SessionParticipant): boolean {
  return participant.isActive && Date.now() - new Date(participant.lastSeenAt).getTime() < PARTICIPANT_ACTIVE_WINDOW_MS;
}

// ============================================================================
// Assembling raw Supabase rows into one TableSession. Orders/payments/participants
// are separate normalized tables under the hood (for RLS + realtime granularity),
// but every consumer of this module only ever sees the bundled shape below.
// ============================================================================

interface RawSessionRow {
  id: string;
  restaurant_id: string;
  table_id: string;
  status: SessionStatus;
  payment_status: SessionPaymentStatus;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

async function fetchOrdersForSessions(restaurantId: string, sessionIds: string[]): Promise<Map<string, SessionOrder[]>> {
  const map = new Map<string, SessionOrder[]>();
  if (sessionIds.length === 0) return map;
  const supabase = createClient();
  const { data } = await supabase
    .from("qr_orders")
    .select("*, qr_order_items(*)")
    .eq("restaurant_id", restaurantId)
    .in("session_id", sessionIds)
    .order("created_at", { ascending: false });
  for (const row of data ?? []) {
    const sessionId = row.session_id as string;
    const order = rowToOrder(row, row.table_id as string);
    const list = map.get(sessionId) ?? [];
    list.push(order);
    map.set(sessionId, list);
  }
  return map;
}

async function fetchPaymentsForSessions(sessionIds: string[]): Promise<Map<string, SessionPayment[]>> {
  const map = new Map<string, SessionPayment[]>();
  if (sessionIds.length === 0) return map;
  const supabase = createClient();
  const { data } = await supabase
    .from("payments")
    .select("*")
    .in("session_id", sessionIds)
    .eq("status", "paid")
    .order("created_at", { ascending: false });
  for (const row of data ?? []) {
    const sessionId = row.session_id as string;
    const list = map.get(sessionId) ?? [];
    list.push(rowToPayment(row));
    map.set(sessionId, list);
  }
  return map;
}

async function fetchParticipantsForSessions(sessionIds: string[]): Promise<Map<string, SessionParticipant[]>> {
  const map = new Map<string, SessionParticipant[]>();
  if (sessionIds.length === 0) return map;
  const supabase = createClient();
  const { data } = await supabase.from("table_participants").select("*").in("session_id", sessionIds);
  for (const row of data ?? []) {
    const participant = rowToParticipant(row);
    const list = map.get(participant.sessionId) ?? [];
    list.push(participant);
    map.set(participant.sessionId, list);
  }
  return map;
}

function assemble(
  restaurantSlug: string,
  tableNumber: string,
  row: RawSessionRow,
  orders: SessionOrder[],
  payments: SessionPayment[],
  participants: SessionParticipant[]
): TableSession {
  return {
    sessionId: row.id,
    restaurantSlug,
    tableId: tableNumber,
    tableRowId: row.table_id,
    status: row.status,
    paymentStatus: row.payment_status,
    orders,
    payments,
    participants,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  };
}

/** Fetches everything needed to assemble one session by its raw row, in three batched queries. */
async function hydrateSession(restaurantSlug: string, restaurantId: string, tableNumber: string, row: RawSessionRow): Promise<TableSession> {
  const [ordersBySession, paymentsBySession, participantsBySession] = await Promise.all([
    fetchOrdersForSessions(restaurantId, [row.id]),
    fetchPaymentsForSessions([row.id]),
    fetchParticipantsForSessions([row.id]),
  ]);
  return assemble(
    restaurantSlug,
    tableNumber,
    row,
    ordersBySession.get(row.id) ?? [],
    paymentsBySession.get(row.id) ?? [],
    participantsBySession.get(row.id) ?? []
  );
}

async function assembleMany(restaurantSlug: string, restaurantId: string, rows: Record<string, unknown>[]): Promise<TableSession[]> {
  if (rows.length === 0) return [];
  const sessionIds = rows.map((row) => row.id as string);
  const [ordersBySession, paymentsBySession, participantsBySession] = await Promise.all([
    fetchOrdersForSessions(restaurantId, sessionIds),
    fetchPaymentsForSessions(sessionIds),
    fetchParticipantsForSessions(sessionIds),
  ]);
  return rows.map((row) => {
    const tableNumber = (row.restaurant_tables as { table_number: string } | null)?.table_number ?? "";
    const sessionId = row.id as string;
    return assemble(
      restaurantSlug,
      tableNumber,
      row as unknown as RawSessionRow,
      ordersBySession.get(sessionId) ?? [],
      paymentsBySession.get(sessionId) ?? [],
      participantsBySession.get(sessionId) ?? []
    );
  });
}

// ============================================================================
// Session lifecycle
// ============================================================================

/**
 * The most recent session for this table, whatever its status — or null if none has ever existed.
 * This is deliberately *not* filtered to "addable" sessions: the QR page needs to see a paid or
 * closed session too, to show "Payment received" / "Start New Visit" instead of an empty menu.
 */
export async function getActiveSession(restaurantSlug: string, tableId: string): Promise<TableSession | null> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return null;
  const table = await findTableByNumber(restaurantSlug, tableId);
  if (!table) return null;

  const supabase = createClient();
  const { data } = await supabase
    .from("live_table_sessions")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("table_id", table.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  return hydrateSession(restaurantSlug, restaurantId, tableId, data as RawSessionRow);
}

/** Always creates a brand-new session — fresh id, empty orders/payments/participants. Never copies anything from a previous session. */
export async function createSession(restaurantSlug: string, tableId: string): Promise<TableSession | null> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return null;
  const table = await findTableByNumber(restaurantSlug, tableId);
  if (!table) return null;

  const supabase = createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("live_table_sessions")
    .insert({
      restaurant_id: restaurantId,
      table_id: table.id,
      status: "active",
      payment_status: "unpaid",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .maybeSingle();
  if (error || !data) return null;

  debugLog("session created", { sessionId: data.id, restaurantSlug, tableId });
  notifySessionsChanged();
  return assemble(restaurantSlug, tableId, data as RawSessionRow, [], [], []);
}

/** Returns the table's current session if one exists (of any status), otherwise creates a fresh one. Never creates a second session while one is already open. */
export async function getOrCreateSession(restaurantSlug: string, tableId: string): Promise<TableSession | null> {
  const existing = await getActiveSession(restaurantSlug, tableId);
  if (existing) return existing;
  return createSession(restaurantSlug, tableId);
}

/** The explicit escape hatch from a paid/closed session: always starts a genuinely fresh session. */
export async function startNewVisit(restaurantSlug: string, tableId: string): Promise<TableSession | null> {
  return createSession(restaurantSlug, tableId);
}

export interface AddOrderOptions {
  specialRequests?: string;
  aiRecommendedItems?: string[];
}

/** Adds an order to a session. Refuses (returns null) if the session is paid or closed — the only way to order again is `startNewVisit`. */
export async function addOrder(sessionId: string, items: SessionOrderItem[], options: AddOrderOptions = {}): Promise<SessionOrder | null> {
  if (items.length === 0) return null;
  const supabase = createClient();
  const { data: sessionRow } = await supabase
    .from("live_table_sessions")
    .select("*, restaurant_tables(table_number)")
    .eq("id", sessionId)
    .maybeSingle();
  if (!sessionRow) return null;
  if (sessionRow.status === "paid" || sessionRow.status === "closed") {
    debugLog("addOrder rejected — session not open for ordering", { sessionId, status: sessionRow.status });
    return null;
  }

  const tableNumber = (sessionRow.restaurant_tables as { table_number: string } | null)?.table_number ?? "";
  const orderRowId = newId();
  const subtotal = round2(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const now = new Date().toISOString();

  const { error } = await supabase.from("qr_orders").insert({
    id: orderRowId,
    restaurant_id: sessionRow.restaurant_id,
    order_id: newId(),
    table_id: tableNumber,
    session_id: sessionId,
    subtotal,
    ai_recommended_items: options.aiRecommendedItems ?? [],
    special_requests: options.specialRequests?.trim() ?? "",
    status: "new",
    created_at: now,
    updated_at: now,
  });
  if (error) return null;

  await supabase.from("qr_order_items").insert(
    items.map((item) => ({ qr_order_id: orderRowId, dish: item.dish, category: item.category, price: item.price, quantity: item.quantity }))
  );

  debugLog("order added", { sessionId, orderRowId, itemCount: items.length });
  notifySessionsChanged();

  return { orderId: orderRowId, sessionId, tableId: tableNumber, status: "new", items, subtotal, createdAt: now, updatedAt: now };
}

/** Staff-facing kitchen-progress update (preparing/served/cancelled) — scoped to the session so an order can only be touched through its own session. */
export async function updateOrderStatus(sessionId: string, orderId: string, status: SessionOrderStatus): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("qr_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("session_id", sessionId);
  notifySessionsChanged();
}

/** Customer requests the bill. No-ops unless the session is currently "active", so it can't downgrade a session already further along (or paid/closed). */
export async function requestBill(sessionId: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("live_table_sessions")
    .update({ status: "bill_requested", updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("status", "active");
  notifySessionsChanged();
}

/** Re-sums orders/payments fresh from the DB and reconciles status/paymentStatus. Never touches an already paid or closed session. */
async function reconcilePaymentStatus(sessionId: string): Promise<void> {
  const supabase = createClient();
  const { data: sessionRow } = await supabase.from("live_table_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!sessionRow || sessionRow.status === "paid" || sessionRow.status === "closed") return;

  const [ordersBySession, paymentsBySession] = await Promise.all([
    fetchOrdersForSessions(sessionRow.restaurant_id, [sessionId]),
    fetchPaymentsForSessions([sessionId]),
  ]);
  const bill = calculateBill({ orders: ordersBySession.get(sessionId) ?? [], payments: paymentsBySession.get(sessionId) ?? [] });
  const now = new Date().toISOString();

  if (bill.total > 0 && bill.remaining <= 0.01) {
    await supabase.from("live_table_sessions").update({ status: "paid", payment_status: "paid", updated_at: now }).eq("id", sessionId);
  } else if (bill.amountPaid > 0) {
    await supabase.from("live_table_sessions").update({ status: "partially_paid", payment_status: "partially_paid", updated_at: now }).eq("id", sessionId);
  }
}

export interface AddPaymentInput {
  /** Null for a staff-confirmed settlement not attributed to a specific guest (see `markPaid`). */
  participantId: string | null;
  amount: number;
  tipAmount?: number;
  splitMode: SplitMode;
}

/** Records a payment (guest split payment, or a staff-confirmed settlement), then reconciles the session's paid/remaining state. */
export async function addPayment(sessionId: string, payment: AddPaymentInput): Promise<SessionPayment | null> {
  if (payment.amount <= 0) return null;
  const supabase = createClient();
  const { data: sessionRow } = await supabase.from("live_table_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!sessionRow) return null;

  const { data, error } = await supabase
    .from("payments")
    .insert({
      restaurant_id: sessionRow.restaurant_id,
      table_id: sessionRow.table_id,
      session_id: sessionId,
      order_id: null,
      participant_id: payment.participantId,
      amount: payment.amount,
      tip_amount: payment.tipAmount ?? 0,
      method: "demo",
      status: "paid",
      split_type: payment.splitMode,
    })
    .select("*")
    .maybeSingle();
  if (error || !data) return null;

  if (payment.participantId) {
    const { data: participant } = await supabase
      .from("table_participants")
      .select("amount_paid")
      .eq("id", payment.participantId)
      .maybeSingle();
    const currentPaid = Number(participant?.amount_paid ?? 0);
    await supabase.from("table_participants").update({ amount_paid: currentPaid + payment.amount }).eq("id", payment.participantId);
  }

  await reconcilePaymentStatus(sessionId);
  debugLog("payment added", { sessionId, amount: payment.amount });
  notifySessionsChanged();
  return rowToPayment(data);
}

/**
 * Owner "Mark Paid" action. Never just flips a status flag: it covers whatever remains with a
 * staff-confirmed payment first, so the bill's paid/remaining math stays consistent with the
 * payments table, then marks the session paid. Orders are untouched. Does not close the table —
 * it stays visible on the live view (with a "Paid" badge) until `closeSession`.
 */
export async function markPaid(sessionId: string): Promise<void> {
  const supabase = createClient();
  const { data: sessionRow } = await supabase.from("live_table_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!sessionRow || sessionRow.status === "closed") return;

  const [ordersBySession, paymentsBySession] = await Promise.all([
    fetchOrdersForSessions(sessionRow.restaurant_id, [sessionId]),
    fetchPaymentsForSessions([sessionId]),
  ]);
  const bill = calculateBill({ orders: ordersBySession.get(sessionId) ?? [], payments: paymentsBySession.get(sessionId) ?? [] });
  const now = new Date().toISOString();

  if (bill.remaining > 0.01) {
    await supabase.from("payments").insert({
      restaurant_id: sessionRow.restaurant_id,
      table_id: sessionRow.table_id,
      session_id: sessionId,
      order_id: null,
      participant_id: null,
      amount: bill.remaining,
      tip_amount: 0,
      method: "demo",
      status: "paid",
      split_type: "full",
    });
  }

  await supabase.from("live_table_sessions").update({ status: "paid", payment_status: "paid", updated_at: now }).eq("id", sessionId);
  debugLog("session marked paid by staff", { sessionId, coveredRemaining: bill.remaining });
  notifySessionsChanged();
}

/** The only function that archives a session off the live view. Orders/payments/participants remain queryable by session id, just no longer "live". */
export async function closeSession(sessionId: string): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();
  await supabase.from("live_table_sessions").update({ status: "closed", closed_at: now, updated_at: now }).eq("id", sessionId);
  debugLog("session closed", { sessionId });
  notifySessionsChanged();
}

/** Every session for the restaurant, any status — history/insights/dashboard use. */
export async function getSessionsForRestaurant(restaurantSlug: string): Promise<TableSession[]> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("live_table_sessions")
    .select("*, restaurant_tables(table_number)")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  return assembleMany(restaurantSlug, restaurantId, data ?? []);
}

/** Every non-closed session — active, bill_requested, partially_paid, and paid all stay on the owner's live view until explicitly closed. */
export async function getLiveSessionsForRestaurant(restaurantSlug: string): Promise<TableSession[]> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("live_table_sessions")
    .select("*, restaurant_tables(table_number)")
    .eq("restaurant_id", restaurantId)
    .neq("status", "closed")
    .order("created_at", { ascending: false });
  return assembleMany(restaurantSlug, restaurantId, data ?? []);
}

/** Development-only full reset: deletes every session/order/payment for the restaurant. The table registry itself is untouched. */
export async function clearAllSessionsForRestaurant(restaurantSlug: string): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;
  const supabase = createClient();
  await supabase.from("payments").delete().eq("restaurant_id", restaurantId);
  await supabase.from("qr_orders").delete().eq("restaurant_id", restaurantId);
  await supabase.from("live_table_sessions").delete().eq("restaurant_id", restaurantId);
  debugLog("all sessions cleared", { restaurantSlug });
  notifySessionsChanged();
}

// ============================================================================
// Participants
// ============================================================================

/** Registers this device as a participant of the session (creating the row on first visit, refreshing `lastSeenAt` on repeat visits). */
export async function joinSession(sessionId: string, deviceId: string): Promise<SessionParticipant | null> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("table_participants")
    .select("*")
    .eq("session_id", sessionId)
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

  const { count } = await supabase.from("table_participants").select("id", { count: "exact", head: true }).eq("session_id", sessionId);
  const { data: created, error } = await supabase
    .from("table_participants")
    .insert({ session_id: sessionId, device_id: deviceId, display_name: `Guest ${(count ?? 0) + 1}` })
    .select("*")
    .maybeSingle();
  if (error || !created) return null;
  notifySessionsChanged();
  return rowToParticipant(created);
}

export async function updateParticipantName(participantId: string, name: string): Promise<SessionParticipant | null> {
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
  notifySessionsChanged();
  return rowToParticipant(data);
}

/** Call on a timer while a device is on the QR page, so other devices see it as connected. */
export async function heartbeatParticipant(participantId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("table_participants").update({ last_seen_at: new Date().toISOString(), is_active: true }).eq("id", participantId);
}

// ============================================================================
// Realtime — cross-device sync. Every page also polls as a fallback.
// ============================================================================

export function subscribeToSessionRealtime(sessionId: string, onChange: () => void): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`session-${sessionId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "live_table_sessions", filter: `id=eq.${sessionId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "qr_orders", filter: `session_id=eq.${sessionId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "qr_order_items" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `session_id=eq.${sessionId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "table_participants", filter: `session_id=eq.${sessionId}` }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToRestaurantRealtime(restaurantSlug: string, onChange: () => void): () => void {
  let unsubscribed = false;
  let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

  (async () => {
    const restaurantId = await resolveRestaurantId(restaurantSlug);
    if (!restaurantId || unsubscribed) return;
    const supabase = createClient();
    channel = supabase
      .channel(`restaurant-sessions-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_table_sessions", filter: `restaurant_id=eq.${restaurantId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "qr_orders", filter: `restaurant_id=eq.${restaurantId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "qr_order_items" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `restaurant_id=eq.${restaurantId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_participants" }, onChange)
      .subscribe();
  })();

  return () => {
    unsubscribed = true;
    if (channel) createClient().removeChannel(channel);
  };
}

// ============================================================================
// Cart draft — local-only, per session. Never synced, never part of `TableSession`.
// Keyed by sessionId, so a brand-new session (from `startNewVisit`) always starts
// with an empty cart; there is no code path that copies a draft between sessions.
// ============================================================================

export function getAnonymousGuestId(): string {
  if (typeof window === "undefined") return newId();
  const existing = window.localStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const id = newId();
  window.localStorage.setItem(GUEST_ID_KEY, id);
  return id;
}

export function readCartDraft(sessionId: string): QRBasketItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(CART_PREFIX + sessionId);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QRBasketItem[];
  } catch {
    return [];
  }
}

function writeCartDraft(sessionId: string, items: QRBasketItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_PREFIX + sessionId, JSON.stringify(items));
}

export function addToCartDraft(sessionId: string, menuItem: Pick<MenuItem, "dish" | "category" | "price">, quantity = 1): QRBasketItem[] {
  const current = readCartDraft(sessionId);
  const existingIndex = current.findIndex((entry) => entry.dish === menuItem.dish);
  const next =
    existingIndex >= 0
      ? current.map((entry, index) => (index === existingIndex ? { ...entry, quantity: entry.quantity + quantity } : entry))
      : [...current, { dish: menuItem.dish, category: menuItem.category, price: menuItem.price, quantity }];
  writeCartDraft(sessionId, next);
  debugLog("cart item added", { sessionId, cartCount: next.length });
  return next;
}

export function updateCartDraftQuantity(sessionId: string, dish: string, quantity: number): QRBasketItem[] {
  const current = readCartDraft(sessionId);
  const next =
    quantity <= 0 ? current.filter((entry) => entry.dish !== dish) : current.map((entry) => (entry.dish === dish ? { ...entry, quantity } : entry));
  writeCartDraft(sessionId, next);
  debugLog("cart saved", { sessionId, cartCount: next.length });
  return next;
}

export function clearCartDraft(sessionId: string): QRBasketItem[] {
  writeCartDraft(sessionId, []);
  return [];
}
