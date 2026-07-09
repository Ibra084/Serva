"use client";

import { newId, num } from "@/lib/db-utils";
import { createClient } from "@/lib/supabase/client";
import {
  closeSession as closeSessionRemote,
  findActiveSessionForTable,
  findTableByNumber,
  getOrCreateActiveSession as getOrCreateDbSession,
  loadLiveOrders,
  loadLiveSessions,
  loadSessionById,
  loadTables,
  markSessionFullyPaid,
  updateOrderStatus as updateOrderStatusRemote,
  updateSessionPaymentStatus,
  updateSessionStatus,
  updateSessionTotal,
} from "@/lib/live-store";
import { loadSessionOrders, saveQROrder, updateQROrderItems, updateQROrderStatus } from "@/lib/qr-store";
import { computeBill, loadPayments, loadPaymentsForSession, processDemoPayment } from "@/lib/payment-store";
import type {
  Bill,
  LivePaymentStatus,
  LiveTableSession,
  LiveTableStatus,
  Payment,
  QRBasketItem,
  QROrder,
  QROrderStatus,
  RestaurantTable,
  SplitMode,
  TableParticipant,
} from "@/lib/types";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const GUEST_ID_KEY = "serva_guest_id";
const STORAGE_PREFIX = "serva:table-session:";
const CHANGE_EVENT = "serva:table-session-changed";

/** A participant is considered connected if it has heartbeated within this window (3x the poll interval). */
export const PARTICIPANT_ACTIVE_WINDOW_MS = 15_000;
export const PARTICIPANT_POLL_MS = 4_000;

/** How often the hook re-pulls the table's shared session/orders as a realtime fallback. */
export const REMOTE_POLL_MS = 5_000;

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
  /** Private to this guest/device — never shared with other guests at the table, and never touched by remote merges. */
  cartItems: QRBasketItem[];
  /** Table-wide — hydrated from Supabase so every guest at the table sees the same bill. */
  submittedOrders: QROrder[];
  currentBillTotal: number;
  orderStatus: LiveTableStatus | "none";
  paymentStatus: LivePaymentStatus;
  createdAt: string;
  updatedAt: string;
}

/** Fields owned by the remote (Supabase) side of the session — safe to merge in from a background refresh without ever touching the cart. */
export type RemoteSessionPatch = Pick<
  TableSessionState,
  "tableRowId" | "dbSessionId" | "orderStatus" | "paymentStatus" | "submittedOrders" | "currentBillTotal"
>;

const DEBUG = process.env.NODE_ENV !== "production";
function debugLog(event: string, sessionId: string, cartCount: number) {
  if (DEBUG) console.debug(`[table-session] ${event}`, { sessionId, cartCount });
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

export function readLocalSession(sessionId: string): TableSessionState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_PREFIX + sessionId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TableSessionState;
  } catch {
    return null;
  }
}

function touch(state: TableSessionState): TableSessionState {
  return { ...state, updatedAt: new Date().toISOString() };
}

/**
 * Overwrites the entire stored session — only safe to use right after reading (session bootstrap)
 * or when a single user action intentionally changes both cart and order state together (submit).
 * Everywhere else, use `patchLocalSession`, which re-reads before merging so a slow background
 * write can never clobber a field it doesn't own (see module docs below).
 */
function writeLocalSession(state: TableSessionState): TableSessionState {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_PREFIX + state.sessionId, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { sessionId: state.sessionId } }));
  }
  return state;
}

/**
 * Read-patch-write: always re-reads the current stored session and merges only the given fields
 * onto it before writing back. This is the key to avoiding lost updates — a background remote
 * refresh that takes 500ms can only ever overwrite the fields it explicitly patches (e.g. orders,
 * payment status), never a cart item the user added while that refresh was in flight, because it
 * never touches cartItems, and it merges onto whatever is on disk *now*, not a stale snapshot.
 */
export function patchLocalSession(sessionId: string, patch: Partial<TableSessionState>): TableSessionState | null {
  const current = readLocalSession(sessionId);
  if (!current) return null;
  return writeLocalSession(touch({ ...current, ...patch }));
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
 * Pulls the table's shared session/orders down from Supabase and returns the remote-owned patch.
 * Never returns/touches `cartItems` — callers merge this patch onto whatever the current in-memory
 * (or on-disk) cart is, so a slow fetch can't resurrect a stale cart.
 */
export async function fetchRemotePatch(
  state: Pick<TableSessionState, "restaurantSlug" | "tableId" | "tableRowId" | "dbSessionId">
): Promise<RemoteSessionPatch> {
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

  let orderStatus: LiveTableStatus | "none" = "none";
  let paymentStatus: LivePaymentStatus = "unpaid";
  let submittedOrders: QROrder[] = [];

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

  return {
    tableRowId,
    dbSessionId,
    orderStatus,
    paymentStatus,
    submittedOrders,
    currentBillTotal: computeBillTotal(submittedOrders),
  };
}

/**
 * Loads (and hydrates) the active session for this restaurant/table on this device, creating a fresh
 * local one if none exists yet. Called once on mount by `useTableSession` (guarded against Strict
 * Mode's double-invoke there); the remote `getOrCreateActiveSession` in `live-store` is itself
 * find-then-create, so re-running this is also safe — it never creates a second shared session.
 */
export async function getOrCreateActiveSession(restaurantSlug: string, tableId: string): Promise<TableSessionState> {
  const guestId = getAnonymousGuestId();
  const sessionId = buildSessionId(restaurantSlug, tableId, guestId);
  const local = readLocalSession(sessionId) ?? newState(restaurantSlug, tableId, guestId);
  const patch = await fetchRemotePatch(local);
  const hydrated = touch({ ...local, ...patch });
  debugLog("session loaded", hydrated.sessionId, hydrated.cartItems.length);
  return writeLocalSession(hydrated);
}

/** Read-only alias for call sites that only ever expect an existing session, never create one. */
export async function loadActiveSession(restaurantSlug: string, tableId: string): Promise<TableSessionState> {
  return getOrCreateActiveSession(restaurantSlug, tableId);
}

/** Explicit whole-state persist — only for callers that already hold a fully up-to-date state (e.g. after `getOrCreateActiveSession`). Everyday mutations should go through `patchLocalSession` instead. */
export function saveSession(session: TableSessionState): TableSessionState {
  return writeLocalSession(touch(session));
}

// ============================================================================
// Pure cart reducers — no I/O. Callers (the `useTableSession` hook) apply these
// via functional state updates and persist the result themselves, so cart edits
// always compose against the freshest in-memory state rather than a re-read
// that could race with an in-flight remote refresh.
// ============================================================================

/** Stable identity for a cart line. Customizations aren't modeled yet, so this is just the dish name — the same item never gets a second line unless a customization hash is later added. */
export function buildCartItemId(dish: string, customizationHash = ""): string {
  return customizationHash ? `${dish}::${customizationHash}` : dish;
}

export function applyAddToCart(state: TableSessionState, item: QRBasketItem, customizationHash = ""): TableSessionState {
  const cartItemId = buildCartItemId(item.dish, customizationHash);
  const existingIndex = state.cartItems.findIndex((entry) => buildCartItemId(entry.dish) === cartItemId);
  const cartItems =
    existingIndex >= 0
      ? state.cartItems.map((entry, index) =>
          index === existingIndex ? { ...entry, quantity: entry.quantity + item.quantity } : entry
        )
      : [...state.cartItems, item];
  return touch({ ...state, cartItems });
}

export function applyUpdateCartQuantity(state: TableSessionState, cartItemId: string, quantity: number): TableSessionState {
  const cartItems =
    quantity <= 0
      ? state.cartItems.filter((entry) => buildCartItemId(entry.dish) !== cartItemId)
      : state.cartItems.map((entry) => (buildCartItemId(entry.dish) === cartItemId ? { ...entry, quantity } : entry));
  return touch({ ...state, cartItems });
}

export function applyRemoveFromCart(state: TableSessionState, cartItemId: string): TableSessionState {
  return applyUpdateCartQuantity(state, cartItemId, 0);
}

export function applyClearCart(state: TableSessionState): TableSessionState {
  return touch({ ...state, cartItems: [] });
}

export interface SubmitCartOptions {
  specialRequests?: string;
  aiRecommendedItems?: string[];
}

export interface SubmitCartPreparation {
  /** Optimistic order to show immediately — items/subtotal are a snapshot of the cart at submit time. */
  optimisticOrder: QROrder;
}

/** Builds the optimistic order for a cart snapshot. Pure — no I/O, no state mutation. */
export function prepareSubmitCart(
  state: Pick<TableSessionState, "restaurantSlug" | "tableId" | "cartItems" | "dbSessionId">,
  options: SubmitCartOptions = {}
): SubmitCartPreparation {
  const subtotal = state.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return {
    optimisticOrder: {
      orderId: newId(),
      restaurantId: state.restaurantSlug,
      tableId: state.tableId,
      sessionId: state.dbSessionId,
      timestamp: new Date().toISOString(),
      items: state.cartItems,
      subtotal,
      source: "qr",
      aiRecommendedItems: options.aiRecommendedItems ?? [],
      specialRequests: options.specialRequests?.trim() ?? "",
      status: "new",
    },
  };
}

export interface SubmitCartResult {
  tableRowId: string | null;
  dbSessionId: string | null;
  orderRowId: string | null;
}

/** The network half of submitting an order: resolves table/session rows and inserts the order. No local state/storage side effects. */
export async function persistSubmittedOrder(
  restaurantSlug: string,
  state: Pick<TableSessionState, "tableId" | "tableRowId" | "dbSessionId" | "currentBillTotal">,
  order: QROrder
): Promise<SubmitCartResult> {
  let tableRowId = state.tableRowId;
  if (!tableRowId) {
    const table = await findTableByNumber(restaurantSlug, state.tableId);
    tableRowId = table?.id ?? null;
  }

  let dbSessionId = state.dbSessionId;
  if (tableRowId && !dbSessionId) {
    const dbSession = await getOrCreateDbSession(restaurantSlug, tableRowId);
    dbSessionId = dbSession?.id ?? null;
  }

  const orderRowId = await saveQROrder(restaurantSlug, { ...order, sessionId: dbSessionId });
  if (dbSessionId) {
    await updateSessionStatus(restaurantSlug, dbSessionId, "order_placed");
    await updateSessionTotal(restaurantSlug, dbSessionId, state.currentBillTotal + order.subtotal);
  }

  return { tableRowId, dbSessionId, orderRowId };
}

export function editWindowRemainingMs(order: QROrder): number {
  if (order.status !== "new") return 0;
  const elapsed = Date.now() - new Date(order.timestamp).getTime();
  return Math.max(0, EDIT_WINDOW_MS - elapsed);
}

export function canEditOrder(order: QROrder): boolean {
  return order.status === "new" && editWindowRemainingMs(order) > 0;
}

/** Edits/resubmits a not-yet-locked order's items in place. No-ops once the edit window has closed or the order isn't "new". Network + pure result only — no storage side effects. */
export async function editSubmittedOrder(
  restaurantSlug: string,
  order: QROrder,
  updatedItems: QRBasketItem[]
): Promise<{ items: QRBasketItem[]; subtotal: number; delta: number } | null> {
  if (!order.id || !canEditOrder(order)) return null;
  const subtotal = updatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const ok = await updateQROrderItems(restaurantSlug, order.id, updatedItems, subtotal);
  if (!ok) return null;
  return { items: updatedItems, subtotal, delta: subtotal - order.subtotal };
}

/** Cancels a not-yet-locked order. No-ops once the edit window has closed or the order isn't "new". */
export async function cancelSubmittedOrder(restaurantSlug: string, order: QROrder): Promise<boolean> {
  if (!order.id || !canEditOrder(order)) return false;
  await updateQROrderStatus(restaurantSlug, order.orderId, "cancelled");
  return true;
}

export async function requestBillForSession(restaurantSlug: string, dbSessionId: string): Promise<void> {
  await updateSessionStatus(restaurantSlug, dbSessionId, "ready_to_pay");
}

/** Staff-facing order status update (preparing/served/cancelled) — the one entry point the owner live view uses, so it shares this module's logic instead of calling `live-store` directly. */
export async function updateOrderStatus(restaurantSlug: string, orderRowId: string, status: QROrderStatus): Promise<void> {
  await updateOrderStatusRemote(restaurantSlug, orderRowId, status);
}

/**
 * Cross-tab local demo sync: fires when another tab/window writes this same session (e.g. a second
 * device-tab open at the same table). Deliberately only listens to the native `storage` event, which
 * browsers never fire back at the tab that made the write. Callers should merge only the remote-owned
 * fields from the freshly-read stored session — never its `cartItems` — so one tab's draft cart is
 * never overwritten by another tab's activity.
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

// ============================================================================
// Bill, payments, and session lifecycle. The table session is the source of
// truth: orders and payments are always read *through* a session, never used
// to replace or infer one, and only `closeSession` archives a session — every
// other transition (including "paid") keeps it visible on the live floor.
// ============================================================================

export interface SessionBill {
  bill: Bill;
  paid: number;
  remaining: number;
}

/** Derives the remaining balance from a bill total and what's already been paid. Pure. */
export function calculateRemainingBalance(bill: Pick<Bill, "total">, paid: number): number {
  return Math.max(0, round2(bill.total - paid));
}

/** Derives payment status from paid/remaining amounts. Pure — matches the DB's `payment_status` values. */
export function getSessionPaymentStatus(remaining: number, paid: number): LivePaymentStatus {
  if (remaining <= 0.01) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

/** The table's full bill (all active orders, no split applied) plus how much of it has already been paid. */
export async function calculateBill(session: TableSessionState): Promise<SessionBill> {
  const activeItems = session.submittedOrders.filter((order) => order.status !== "cancelled").flatMap((order) => order.items);
  const bill = computeBill({ items: activeItems, splitType: "full" });
  if (!session.dbSessionId) return { bill, paid: 0, remaining: bill.total };

  const payments = await loadPaymentsForSession(session.restaurantSlug, session.dbSessionId);
  const paid = round2(payments.reduce((sum, payment) => sum + payment.amount, 0));
  return { bill, paid, remaining: calculateRemainingBalance(bill, paid) };
}

/** Splits whatever remains equally across the given participants (recalculated live, not a fixed pre-assigned share). */
export function calculateEqualSplit(remaining: number, participantCount: number): number {
  if (participantCount <= 0) return remaining;
  return round2(remaining / participantCount);
}

/** Validates custom per-participant amounts against the remaining balance; returns the balance left after them. */
export function calculateCustomRemaining(
  remaining: number,
  customAmounts: number[]
): { remainingAfter: number; valid: boolean } {
  const total = customAmounts.reduce((sum, amount) => sum + (Number.isFinite(amount) ? amount : 0), 0);
  return { remainingAfter: round2(remaining - total), valid: total <= remaining + 0.01 };
}

/** Re-sums orders/payments fresh from the DB and reconciles `payment_status`/`status` — never downgrades a session already marked "paid". */
async function reconcileSessionPaymentStatus(restaurantSlug: string, dbSessionId: string): Promise<boolean> {
  const [orders, payments] = await Promise.all([
    loadSessionOrders(restaurantSlug, dbSessionId),
    loadPaymentsForSession(restaurantSlug, dbSessionId),
  ]);
  const activeItems = orders.filter((order) => order.status !== "cancelled").flatMap((order) => order.items);
  const bill = computeBill({ items: activeItems, splitType: "full" });
  const paid = round2(payments.reduce((sum, payment) => sum + payment.amount, 0));
  await updateSessionTotal(restaurantSlug, dbSessionId, bill.total);

  if (bill.total > 0 && paid + 0.01 >= bill.total) {
    await markSessionFullyPaid(restaurantSlug, dbSessionId);
    return true;
  }

  const session = await loadSessionById(dbSessionId);
  if (session && session.paymentStatus !== "paid") {
    await updateSessionPaymentStatus(restaurantSlug, dbSessionId, paid > 0 ? "partial" : "unpaid");
  }
  return false;
}

export interface CreatePaymentInput {
  restaurantSlug: string;
  dbSessionId: string;
  tableRowId: string | null;
  orderId: string | null;
  /** Null for a staff-confirmed payment not attributed to a specific guest (see `markSessionPaid`). */
  participantId: string | null;
  amount: number;
  splitMode: SplitMode;
}

/** Records one payment against the session (guest split payment, or a staff-confirmed settlement), then reconciles paid/remaining state. */
export async function createPayment(input: CreatePaymentInput): Promise<Payment | null> {
  const payment = await processDemoPayment({
    restaurantSlug: input.restaurantSlug,
    tableId: input.tableRowId,
    sessionId: input.dbSessionId,
    orderId: input.orderId,
    participantId: input.participantId,
    bill: { subtotal: 0, serviceCharge: 0, vat: 0, tip: 0, total: input.amount },
    splitType: input.splitMode,
    amount: input.amount,
  });
  if (!payment) return null;

  if (input.participantId) {
    const supabase = createClient();
    const { data: participant } = await supabase
      .from("table_participants")
      .select("amount_paid")
      .eq("id", input.participantId)
      .maybeSingle();
    const currentPaid = Number(participant?.amount_paid ?? 0);
    await supabase
      .from("table_participants")
      .update({ amount_paid: currentPaid + input.amount })
      .eq("id", input.participantId);
  }

  await reconcileSessionPaymentStatus(input.restaurantSlug, input.dbSessionId);
  return payment;
}

/**
 * Owner "Mark Paid" action. Never just flips a status flag: it covers whatever remains with a
 * staff-confirmed payment record first, so the bill's paid/remaining math stays consistent with
 * the payments table, then marks the session paid. Orders are left untouched. Does not close the
 * table — it stays visible on the live floor (with a "Paid" badge) until `closeSession`.
 */
export async function markSessionPaid(restaurantSlug: string, dbSessionId: string): Promise<void> {
  const [orders, payments] = await Promise.all([
    loadSessionOrders(restaurantSlug, dbSessionId),
    loadPaymentsForSession(restaurantSlug, dbSessionId),
  ]);
  const activeItems = orders.filter((order) => order.status !== "cancelled").flatMap((order) => order.items);
  const bill = computeBill({ items: activeItems, splitType: "full" });
  const paid = round2(payments.reduce((sum, payment) => sum + payment.amount, 0));
  const remaining = calculateRemainingBalance(bill, paid);

  if (remaining > 0.01) {
    await processDemoPayment({
      restaurantSlug,
      tableId: null,
      sessionId: dbSessionId,
      orderId: null,
      participantId: null,
      bill: { subtotal: 0, serviceCharge: 0, vat: 0, tip: 0, total: remaining },
      splitType: "full",
      amount: remaining,
    });
  }

  await updateSessionTotal(restaurantSlug, dbSessionId, bill.total);
  await markSessionFullyPaid(restaurantSlug, dbSessionId);
}

/** The only function that archives a table off the active live view — orders/payments/participants are untouched and remain queryable by session id. */
export async function closeSession(restaurantSlug: string, dbSessionId: string): Promise<void> {
  await closeSessionRemote(restaurantSlug, dbSessionId);
}

export interface ActiveSessionSummary {
  table: RestaurantTable;
  session: LiveTableSession;
  orders: QROrder[];
  participants: TableParticipant[];
  payments: Payment[];
  bill: Bill;
  paid: number;
  remaining: number;
}

/**
 * The owner live view's single data source: every active (non-closed) session, joined with its own
 * table, orders, participants, and payments, plus a computed bill/paid/remaining — so the portal never
 * has to reassemble a session's state from four separately-fetched, separately-filtered arrays.
 */
export async function loadActiveSessionsForRestaurant(restaurantSlug: string): Promise<ActiveSessionSummary[]> {
  const [tables, sessions, orders, payments] = await Promise.all([
    loadTables(restaurantSlug),
    loadLiveSessions(restaurantSlug),
    loadLiveOrders(restaurantSlug),
    loadPayments(restaurantSlug),
  ]);
  if (sessions.length === 0) return [];

  const participants = await loadParticipantsForSessions(sessions.map((session) => session.id));

  const tablesById = new Map(tables.map((table) => [table.id, table]));
  const ordersBySession = new Map<string, QROrder[]>();
  for (const order of orders) {
    if (!order.sessionId) continue;
    const list = ordersBySession.get(order.sessionId) ?? [];
    list.push(order);
    ordersBySession.set(order.sessionId, list);
  }
  const paymentsBySession = new Map<string, Payment[]>();
  for (const payment of payments) {
    if (!payment.sessionId || payment.status !== "paid") continue;
    const list = paymentsBySession.get(payment.sessionId) ?? [];
    list.push(payment);
    paymentsBySession.set(payment.sessionId, list);
  }
  const participantsBySession = new Map<string, TableParticipant[]>();
  for (const participant of participants) {
    const list = participantsBySession.get(participant.sessionId) ?? [];
    list.push(participant);
    participantsBySession.set(participant.sessionId, list);
  }

  const summaries: ActiveSessionSummary[] = [];
  for (const session of sessions) {
    const table = tablesById.get(session.tableId);
    if (!table) continue;
    const sessionOrders = ordersBySession.get(session.id) ?? [];
    const sessionPayments = paymentsBySession.get(session.id) ?? [];
    const activeItems = sessionOrders.filter((order) => order.status !== "cancelled").flatMap((order) => order.items);
    const bill = computeBill({ items: activeItems, splitType: "full" });
    const paid = round2(sessionPayments.reduce((sum, payment) => sum + payment.amount, 0));
    summaries.push({
      table,
      session,
      orders: sessionOrders,
      participants: participantsBySession.get(session.id) ?? [],
      payments: sessionPayments,
      bill,
      paid,
      remaining: calculateRemainingBalance(bill, paid),
    });
  }
  return summaries;
}

export function connectedGuestLabel(participants: TableParticipant[]): string {
  const count = participants.length;
  return `${count} guest${count === 1 ? "" : "s"} viewing this table`;
}

export { parseSessionId, writeLocalSession, debugLog };
