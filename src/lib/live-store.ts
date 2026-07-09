import { createClient } from "@/lib/supabase/client";
import { num } from "@/lib/db-utils";
import type { LiveTableSession, LiveTableStatus, QROrder, QROrderStatus, RestaurantTable } from "@/lib/types";

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

function rowToSession(row: Record<string, unknown>, restaurantSlug: string): LiveTableSession {
  return {
    id: row.id as string,
    restaurantId: restaurantSlug,
    tableId: row.table_id as string,
    status: row.status as LiveTableStatus,
    guestCount: num(row.guest_count, 1),
    startedAt: row.started_at as string,
    closedAt: (row.closed_at as string | null) ?? null,
    currentTotal: num(row.current_total),
    paymentStatus: row.payment_status as LiveTableSession["paymentStatus"],
  };
}

function rowToOrder(row: Record<string, unknown>, restaurantSlug: string): QROrder {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    restaurantId: restaurantSlug,
    tableId: (row.table_id as string | null) ?? null,
    sessionId: (row.session_id as string | null) ?? null,
    timestamp: row.created_at as string,
    subtotal: num(row.subtotal),
    source: "qr" as const,
    aiRecommendedItems: (row.ai_recommended_items as string[] | null) ?? [],
    specialRequests: (row.special_requests as string | null) ?? "",
    status: row.status as QROrderStatus,
    items: ((row.qr_order_items ?? []) as Record<string, unknown>[]).map((item) => ({
      dish: item.dish as string,
      category: item.category as string,
      price: num(item.price),
      quantity: num(item.quantity),
    })),
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

/** Anonymous-safe: finds a table by its number, resolving the restaurant's table registry (seeding if needed). */
export async function findTableByNumber(restaurantSlug: string, tableNumber: string): Promise<RestaurantTable | null> {
  const tables = await loadTables(restaurantSlug);
  return tables.find((table) => table.tableNumber === tableNumber) ?? null;
}

/** Owner-portal read of the live floor — every session not yet closed (includes "paid" ones, which stay visible until staff closes the table). */
export async function loadLiveSessions(restaurantSlug: string): Promise<LiveTableSession[]> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from("live_table_sessions")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .is("closed_at", null)
    .order("started_at", { ascending: false });

  return (data ?? []).map((row) => rowToSession(row, restaurantSlug));
}

/** Read-only lookup of a table's currently open session, if any — used to restore the customer's bill view without creating a session just from a page visit. */
export async function findActiveSessionForTable(restaurantSlug: string, tableId: string): Promise<LiveTableSession | null> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return null;

  const supabase = createClient();
  const { data } = await supabase
    .from("live_table_sessions")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("table_id", tableId)
    .is("closed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? rowToSession(data, restaurantSlug) : null;
}

/** Finds an open (not closed/paid) session for a table, or starts a new one — called when a QR customer's first order lands. */
export async function getOrCreateActiveSession(
  restaurantSlug: string,
  tableId: string,
  guestCount = 1
): Promise<LiveTableSession | null> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return null;

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("live_table_sessions")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("table_id", tableId)
    .is("closed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return rowToSession(existing, restaurantSlug);

  const { data: created, error } = await supabase
    .from("live_table_sessions")
    .insert({ restaurant_id: restaurantId, table_id: tableId, status: "seated", guest_count: guestCount })
    .select("*")
    .maybeSingle();
  if (error || !created) return null;
  return rowToSession(created, restaurantSlug);
}

/** Anonymous-safe: re-reads one session row by id, for the customer's status screen to pick up staff-driven changes. */
export async function loadSessionById(sessionId: string): Promise<LiveTableSession | null> {
  const supabase = createClient();
  const { data } = await supabase.from("live_table_sessions").select("*").eq("id", sessionId).maybeSingle();
  return data ? rowToSession(data, "") : null;
}

/** Subscribes to realtime changes on one session row (customer-side status screen). Returns an unsubscribe fn. */
export function subscribeToSession(sessionId: string, onChange: () => void): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`session-${sessionId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "live_table_sessions", filter: `id=eq.${sessionId}` },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Plain status setter — deliberately has no side effects on `payment_status` or `closed_at`. "Paid" and
 * "closed" are different things: a paid table must stay visible on the live floor until staff explicitly
 * close it (see `closeSession`/`markSessionFullyPaid`), otherwise marking paid instantly hides the session.
 */
export async function updateSessionStatus(
  restaurantSlug: string,
  sessionId: string,
  status: LiveTableStatus
): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;

  const supabase = createClient();
  await supabase.from("live_table_sessions").update({ status }).eq("id", sessionId).eq("restaurant_id", restaurantId);
}

/** The one place `status` and `payment_status` flip to "paid" together — never touches `closed_at`, so the session stays on the live floor. */
export async function markSessionFullyPaid(restaurantSlug: string, sessionId: string): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;
  const supabase = createClient();
  await supabase
    .from("live_table_sessions")
    .update({ status: "paid", payment_status: "paid" })
    .eq("id", sessionId)
    .eq("restaurant_id", restaurantId);
}

/** The only function that sets `closed_at` — archives a table off the active live view. */
export async function closeSession(restaurantSlug: string, sessionId: string): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;
  const supabase = createClient();
  await supabase
    .from("live_table_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("restaurant_id", restaurantId);
}

export async function updateSessionPaymentStatus(
  restaurantSlug: string,
  sessionId: string,
  paymentStatus: LiveTableSession["paymentStatus"]
): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;
  const supabase = createClient();
  await supabase
    .from("live_table_sessions")
    .update({ payment_status: paymentStatus })
    .eq("id", sessionId)
    .eq("restaurant_id", restaurantId);
}

export async function updateSessionTotal(restaurantSlug: string, sessionId: string, currentTotal: number): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;
  const supabase = createClient();
  await supabase
    .from("live_table_sessions")
    .update({ current_total: currentTotal })
    .eq("id", sessionId)
    .eq("restaurant_id", restaurantId);
}

/** Owner-portal read of live (non-terminal) QR orders, newest first, with line items. */
export async function loadLiveOrders(restaurantSlug: string): Promise<QROrder[]> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from("qr_orders")
    .select("*, qr_order_items(*)")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => rowToOrder(row, restaurantSlug));
}

export async function updateOrderStatus(restaurantSlug: string, orderRowId: string, status: QROrderStatus): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;
  const supabase = createClient();
  await supabase.from("qr_orders").update({ status }).eq("id", orderRowId).eq("restaurant_id", restaurantId);
}

export async function cancelOrder(restaurantSlug: string, orderRowId: string): Promise<void> {
  await updateOrderStatus(restaurantSlug, orderRowId, "cancelled");
}

/**
 * Subscribes to realtime changes on the live floor (sessions + orders + order items) for one restaurant.
 * Calls `onChange` on any insert/update/delete; the caller is expected to refetch rather than patch
 * piecemeal, since a single order-item change can affect a session's derived total. Returns an unsubscribe fn.
 */
export function subscribeToLiveFloor(restaurantSlug: string, onChange: () => void): () => void {
  let unsubscribed = false;
  let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

  (async () => {
    const restaurantId = await resolveRestaurantId(restaurantSlug);
    if (!restaurantId || unsubscribed) return;

    const supabase = createClient();
    channel = supabase
      .channel(`live-floor-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_table_sessions", filter: `restaurant_id=eq.${restaurantId}` },
        onChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qr_orders", filter: `restaurant_id=eq.${restaurantId}` },
        onChange
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "qr_order_items" }, onChange)
      .subscribe();
  })();

  return () => {
    unsubscribed = true;
    if (channel) createClient().removeChannel(channel);
  };
}
