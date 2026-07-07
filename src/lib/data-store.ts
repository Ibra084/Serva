import { createClient } from "@/lib/supabase/client";
import { parseCsv, toNumber, toStrictNumber, type CsvRow } from "@/lib/csv-parser";
import { computeDataQuality, detectFileKind, previewRows } from "@/lib/data-quality";
import { getField } from "@/lib/field-mapping";
import type {
  DataQualityReport,
  MenuItem,
  Order,
  OrderItem,
  RestaurantData,
  Review,
  TableSession,
  UploadBatch,
  UploadedFileMeta,
  UploadFileKind,
} from "@/lib/types";

export type { UploadFileKind };
export { detectFileKind };

function toRecordString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/** Accepts parsed JSON rows (unknown value types) and coerces them into CsvRow-shaped string records. */
function jsonRowsToCsvRows(rows: unknown[]): CsvRow[] {
  return rows
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row) => {
      const record: CsvRow = {};
      for (const [key, value] of Object.entries(row)) {
        record[key] = toRecordString(value);
      }
      return record;
    });
}

export function normalizeOrderRows(rows: CsvRow[]): Order[] {
  const orderMap = new Map<string, Order>();

  for (const row of rows) {
    const orderId = getField(row, "orders", "order_id");
    const dish = getField(row, "orders", "dish");
    if (!orderId || !dish) continue;

    const quantity = toStrictNumber(getField(row, "orders", "quantity")) ?? 1;
    const unitPrice = toStrictNumber(getField(row, "orders", "unit_price")) ?? 0;
    const csvTotal = toStrictNumber(getField(row, "orders", "total"));
    const csvRevenue = toStrictNumber(getField(row, "orders", "revenue"));
    const csvCost = toStrictNumber(getField(row, "orders", "cost"));

    // Falls back through total -> revenue -> computed, since real-world exports vary in which column they include.
    const lineTotal = csvTotal ?? csvRevenue ?? quantity * unitPrice;

    const item: OrderItem = {
      dish,
      category: getField(row, "orders", "category") || "Uncategorized",
      quantity,
      price: unitPrice,
      total: lineTotal,
      revenue: csvRevenue ?? lineTotal,
      cost: csvCost ?? 0,
    };

    const existing = orderMap.get(orderId);
    if (existing) {
      existing.items.push(item);
      existing.total += item.total;
    } else {
      orderMap.set(orderId, {
        orderId,
        date: getField(row, "orders", "date") || "",
        time: getField(row, "orders", "time") || "",
        customerId: getField(row, "orders", "customer_id"),
        tableId: getField(row, "orders", "table_id"),
        items: [item],
        total: lineTotal,
      });
    }
  }

  return Array.from(orderMap.values());
}

export function normalizeMenuRows(rows: CsvRow[]): MenuItem[] {
  return rows
    .filter((row) => getField(row, "menu", "dish"))
    .map((row) => ({
      dish: getField(row, "menu", "dish") as string,
      category: getField(row, "menu", "category") || "Uncategorized",
      price: toNumber(getField(row, "menu", "price")),
      cost: toNumber(getField(row, "menu", "cost")),
    }));
}

export function normalizeReviewRows(rows: CsvRow[]): Review[] {
  return rows
    .filter((row) => getField(row, "reviews", "review_id"))
    .map((row) => ({
      reviewId: getField(row, "reviews", "review_id") as string,
      date: getField(row, "reviews", "date") || "",
      rating: toNumber(getField(row, "reviews", "rating")),
      text: getField(row, "reviews", "text") || "",
      guestName: getField(row, "reviews", "guest_name"),
    }));
}

export function normalizeTableRows(rows: CsvRow[]): TableSession[] {
  return rows
    .filter((row) => getField(row, "tables", "table_id"))
    .map((row) => ({
      tableId: getField(row, "tables", "table_id") as string,
      date: getField(row, "tables", "date") || "",
      seatedTime: getField(row, "tables", "seated_time") || "",
      clearedTime: getField(row, "tables", "cleared_time") || "",
      guests: toNumber(getField(row, "tables", "guests"), 1),
    }));
}

export function parseUploadedFile(
  kind: UploadFileKind,
  filename: string,
  text: string
): Order[] | MenuItem[] | Review[] | TableSession[] {
  const isJson = filename.toLowerCase().endsWith(".json");
  let rows: CsvRow[];

  if (isJson) {
    const parsed = JSON.parse(text);
    rows = jsonRowsToCsvRows(Array.isArray(parsed) ? parsed : []);
  } else {
    rows = parseCsv(text);
  }

  switch (kind) {
    case "orders":
      return normalizeOrderRows(rows);
    case "menu":
      return normalizeMenuRows(rows);
    case "reviews":
      return normalizeReviewRows(rows);
    case "tables":
      return normalizeTableRows(rows);
    case "restaurant":
      return [];
  }
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function emptyRestaurantData(): RestaurantData {
  return { orders: [], menu: [], reviews: [], tables: [], importedAt: new Date().toISOString() };
}

async function resolveRestaurantId(restaurantSlug: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.from("restaurants").select("id").eq("slug", restaurantSlug).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Reads the current combined state for a restaurant directly from Postgres — always fresh, always cross-device. */
export async function loadRestaurantData(restaurantSlug: string): Promise<RestaurantData | null> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return null;

  const supabase = createClient();
  const [menuRes, ordersRes, reviewsRes, tablesRes, latestBatchRes] = await Promise.all([
    supabase.from("menu_items").select("*").eq("restaurant_id", restaurantId),
    supabase.from("orders").select("*, order_items(*)").eq("restaurant_id", restaurantId),
    supabase.from("reviews").select("*").eq("restaurant_id", restaurantId),
    supabase.from("table_sessions").select("*").eq("restaurant_id", restaurantId),
    supabase
      .from("upload_batches")
      .select("imported_at")
      .eq("restaurant_id", restaurantId)
      .order("imported_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const menu: MenuItem[] = (menuRes.data ?? []).map((row) => ({
    dish: row.dish,
    category: row.category,
    price: num(row.price),
    cost: num(row.cost),
  }));

  const orders: Order[] = (ordersRes.data ?? []).map((row) => ({
    orderId: row.order_id,
    date: row.date ?? "",
    time: row.time ?? "",
    customerId: row.customer_id ?? undefined,
    tableId: row.table_id ?? undefined,
    total: num(row.total),
    items: ((row.order_items ?? []) as Record<string, unknown>[]).map((item) => ({
      dish: item.dish as string,
      category: item.category as string,
      quantity: num(item.quantity),
      price: num(item.price),
      total: num(item.total),
      revenue: num(item.revenue),
      cost: num(item.cost),
    })),
  }));

  const reviews: Review[] = (reviewsRes.data ?? []).map((row) => ({
    reviewId: row.review_id,
    date: row.date ?? "",
    rating: num(row.rating),
    text: row.text ?? "",
    guestName: row.guest_name ?? undefined,
  }));

  const tables: TableSession[] = (tablesRes.data ?? []).map((row) => ({
    tableId: row.table_id,
    date: row.date ?? "",
    seatedTime: row.seated_time ?? "",
    clearedTime: row.cleared_time ?? "",
    guests: num(row.guests),
  }));

  return {
    menu,
    orders,
    reviews,
    tables,
    importedAt: (latestBatchRes.data?.imported_at as string | undefined) ?? new Date().toISOString(),
  };
}

export async function clearRestaurantData(restaurantSlug: string): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;
  const supabase = createClient();
  await Promise.all([
    supabase.from("menu_items").delete().eq("restaurant_id", restaurantId),
    supabase.from("orders").delete().eq("restaurant_id", restaurantId),
    supabase.from("reviews").delete().eq("restaurant_id", restaurantId),
    supabase.from("table_sessions").delete().eq("restaurant_id", restaurantId),
  ]);
}

export async function hasRestaurantData(restaurantSlug: string): Promise<boolean> {
  const data = await loadRestaurantData(restaurantSlug);
  if (!data) return false;
  return data.orders.length > 0 || data.menu.length > 0 || data.reviews.length > 0;
}

function emptyQuality(): DataQualityReport {
  return { score: 100, missingValues: 0, duplicateRows: 0, invalidRows: 0, warnings: [], errors: [] };
}

export function aggregateQuality(files: UploadedFileMeta[]): DataQualityReport {
  if (files.length === 0) return emptyQuality();
  const score = Math.round(files.reduce((sum, file) => sum + file.quality.score, 0) / files.length);
  return {
    score,
    missingValues: files.reduce((sum, file) => sum + file.quality.missingValues, 0),
    duplicateRows: files.reduce((sum, file) => sum + file.quality.duplicateRows, 0),
    invalidRows: files.reduce((sum, file) => sum + file.quality.invalidRows, 0),
    warnings: files.flatMap((file) => file.quality.warnings),
    errors: files.flatMap((file) => file.quality.errors),
  };
}

/** Upload history for the "Uploads" tab — provenance only (files/quality/status), never the row data. */
export async function loadUploadBatches(restaurantSlug: string): Promise<UploadBatch[]> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from("upload_batches")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("imported_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    importedAt: row.imported_at,
    files: row.files as UploadedFileMeta[],
    status: row.status as UploadBatch["status"],
    quality: row.quality as DataQualityReport,
    data: { orders: [], menu: [], reviews: [], tables: [] },
  }));
}

export async function deleteUploadBatch(restaurantSlug: string, id: string): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;
  const supabase = createClient();
  await supabase.from("upload_batches").delete().eq("id", id).eq("restaurant_id", restaurantId);
}

/** Deletes a batch and every row it contributed, then returns the recombined current state. */
export async function removeUploadBatchAndRecombine(restaurantSlug: string, id: string): Promise<RestaurantData> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return emptyRestaurantData();

  const supabase = createClient();
  await Promise.all([
    supabase.from("menu_items").delete().eq("restaurant_id", restaurantId).eq("source_batch_id", id),
    supabase.from("orders").delete().eq("restaurant_id", restaurantId).eq("source_batch_id", id),
    supabase.from("reviews").delete().eq("restaurant_id", restaurantId).eq("source_batch_id", id),
    supabase.from("table_sessions").delete().eq("restaurant_id", restaurantId).eq("source_batch_id", id),
  ]);
  await supabase.from("upload_batches").delete().eq("id", id).eq("restaurant_id", restaurantId);

  return (await loadRestaurantData(restaurantSlug)) ?? emptyRestaurantData();
}

/** Removes upload history only — the underlying menu/order/review/table rows are untouched. */
export async function clearAllUploadBatches(restaurantSlug: string): Promise<void> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return;
  const supabase = createClient();
  await supabase.from("upload_batches").delete().eq("restaurant_id", restaurantId);
}

type SupabaseClient = ReturnType<typeof createClient>;

async function upsertMenuItems(
  supabase: SupabaseClient,
  restaurantId: string,
  menu: MenuItem[],
  batchId: string
) {
  if (menu.length === 0) return;
  const rows = menu.map((item) => ({
    restaurant_id: restaurantId,
    dish: item.dish,
    category: item.category,
    price: item.price,
    cost: item.cost,
    source_batch_id: batchId,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("menu_items").upsert(rows, { onConflict: "restaurant_id,dish" });
  if (error) throw error;
}

async function upsertOrders(supabase: SupabaseClient, restaurantId: string, orders: Order[], batchId: string) {
  if (orders.length === 0) return;

  const rows = orders.map((order) => ({
    restaurant_id: restaurantId,
    order_id: order.orderId,
    date: order.date,
    time: order.time,
    customer_id: order.customerId ?? null,
    table_id: order.tableId ?? null,
    total: order.total,
    source_batch_id: batchId,
  }));

  const { data, error } = await supabase
    .from("orders")
    .upsert(rows, { onConflict: "restaurant_id,order_id" })
    .select("id, order_id");
  if (error) throw error;

  const idByOrderId = new Map((data ?? []).map((row) => [row.order_id as string, row.id as string]));
  const orderDbIds = Array.from(idByOrderId.values());
  if (orderDbIds.length > 0) {
    const { error: deleteError } = await supabase.from("order_items").delete().in("order_id", orderDbIds);
    if (deleteError) throw deleteError;
  }

  const itemRows = orders.flatMap((order) => {
    const orderDbId = idByOrderId.get(order.orderId);
    if (!orderDbId) return [];
    return order.items.map((item) => ({
      order_id: orderDbId,
      restaurant_id: restaurantId,
      dish: item.dish,
      category: item.category,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
      revenue: item.revenue,
      cost: item.cost,
    }));
  });
  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase.from("order_items").insert(itemRows);
    if (itemsError) throw itemsError;
  }
}

async function upsertReviews(supabase: SupabaseClient, restaurantId: string, reviews: Review[], batchId: string) {
  if (reviews.length === 0) return;
  const rows = reviews.map((review) => ({
    restaurant_id: restaurantId,
    review_id: review.reviewId,
    date: review.date,
    rating: review.rating,
    text: review.text,
    guest_name: review.guestName ?? null,
    source_batch_id: batchId,
  }));
  const { error } = await supabase.from("reviews").upsert(rows, { onConflict: "restaurant_id,review_id" });
  if (error) throw error;
}

async function upsertTableSessions(
  supabase: SupabaseClient,
  restaurantId: string,
  tables: TableSession[],
  batchId: string
) {
  if (tables.length === 0) return;
  const rows = tables.map((table) => ({
    restaurant_id: restaurantId,
    table_id: table.tableId,
    date: table.date,
    seated_time: table.seatedTime,
    cleared_time: table.clearedTime,
    guests: table.guests,
    source_batch_id: batchId,
  }));
  const { error } = await supabase
    .from("table_sessions")
    .upsert(rows, { onConflict: "restaurant_id,table_id,date,seated_time" });
  if (error) throw error;
}

/** The core write path: records the batch, then upserts every row it contains, tagged with its batch id. */
export async function confirmUploadBatch(restaurantSlug: string, batch: UploadBatch): Promise<RestaurantData> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) throw new Error(`Unknown restaurant: ${restaurantSlug}`);

  const supabase = createClient();
  const { data: batchRow, error: batchError } = await supabase
    .from("upload_batches")
    .insert({
      restaurant_id: restaurantId,
      name: batch.name,
      status: batch.status,
      quality: batch.quality,
      files: batch.files,
      imported_at: batch.importedAt,
    })
    .select("id")
    .single();
  if (batchError) throw batchError;
  const batchId = batchRow.id as string;

  if (batch.status !== "failed") {
    await upsertMenuItems(supabase, restaurantId, batch.data.menu, batchId);
    await upsertOrders(supabase, restaurantId, batch.data.orders, batchId);
    await upsertReviews(supabase, restaurantId, batch.data.reviews, batchId);
    await upsertTableSessions(supabase, restaurantId, batch.data.tables, batchId);
  }

  return (await loadRestaurantData(restaurantSlug)) ?? emptyRestaurantData();
}

const SAMPLE_FILES: Record<"orders" | "menu" | "reviews" | "tables", string> = {
  orders: "/data/sample-orders.csv",
  menu: "/data/sample-menu.csv",
  reviews: "/data/sample-reviews.csv",
  tables: "/data/sample-tables.csv",
};

export async function loadSampleData(restaurantSlug: string): Promise<RestaurantData> {
  const [ordersText, menuText, reviewsText, tablesText] = await Promise.all([
    fetch(SAMPLE_FILES.orders).then((res) => res.text()),
    fetch(SAMPLE_FILES.menu).then((res) => res.text()),
    fetch(SAMPLE_FILES.reviews).then((res) => res.text()),
    fetch(SAMPLE_FILES.tables).then((res) => res.text()),
  ]);

  const ordersRows = parseCsv(ordersText);
  const menuRows = parseCsv(menuText);
  const reviewsRows = parseCsv(reviewsText);
  const tablesRows = parseCsv(tablesText);

  function buildFileMeta(
    filename: string,
    kind: UploadFileKind,
    rows: CsvRow[]
  ): UploadedFileMeta {
    return {
      filename,
      kind,
      fileType: "csv",
      rowCount: rows.length,
      detectedColumns: rows.length > 0 ? Object.keys(rows[0]) : [],
      preview: previewRows(rows),
      quality: computeDataQuality(rows, kind),
    };
  }

  const files = [
    buildFileMeta("sample-orders.csv", "orders", ordersRows),
    buildFileMeta("sample-menu.csv", "menu", menuRows),
    buildFileMeta("sample-reviews.csv", "reviews", reviewsRows),
    buildFileMeta("sample-tables.csv", "tables", tablesRows),
  ];

  const batch: UploadBatch = {
    id: `sample-${Date.now()}`,
    name: "Sample Data",
    importedAt: new Date().toISOString(),
    files,
    status: "processed",
    quality: aggregateQuality(files),
    data: {
      orders: normalizeOrderRows(ordersRows),
      menu: normalizeMenuRows(menuRows),
      reviews: normalizeReviewRows(reviewsRows),
      tables: normalizeTableRows(tablesRows),
    },
  };

  return confirmUploadBatch(restaurantSlug, batch);
}
