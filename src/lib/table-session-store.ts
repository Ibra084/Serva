"use client";

import { newId, num } from "@/lib/db-utils";
import { createClient } from "@/lib/supabase/client";
import {
  findActiveSessionForTable,
  findTableByNumber,
  getOrCreateActiveSession as getOrCreateDbSession,
  loadSessionById,
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

export { parseSessionId, writeLocalSession, debugLog };
