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

const STORAGE_PREFIX = "serva_restaurant_data";
const BATCHES_PREFIX = "serva_upload_batches";

function storageKey(restaurantSlug: string) {
  return `${STORAGE_PREFIX}_${restaurantSlug}`;
}

function batchesKey(restaurantSlug: string) {
  return `${BATCHES_PREFIX}_${restaurantSlug}`;
}

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

export function saveRestaurantData(restaurantSlug: string, data: RestaurantData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(restaurantSlug), JSON.stringify(data));
}

export function loadRestaurantData(restaurantSlug: string): RestaurantData | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(restaurantSlug));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as RestaurantData;
  } catch {
    return null;
  }
}

export function clearRestaurantData(restaurantSlug: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(restaurantSlug));
}

export function hasRestaurantData(restaurantSlug: string): boolean {
  const data = loadRestaurantData(restaurantSlug);
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

export function loadUploadBatches(restaurantSlug: string): UploadBatch[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(batchesKey(restaurantSlug));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UploadBatch[]) : [];
  } catch {
    return [];
  }
}

function persistBatches(restaurantSlug: string, batches: UploadBatch[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(batchesKey(restaurantSlug), JSON.stringify(batches));
}

export function saveUploadBatch(restaurantSlug: string, batch: UploadBatch) {
  const batches = loadUploadBatches(restaurantSlug).filter((existing) => existing.id !== batch.id);
  persistBatches(restaurantSlug, [batch, ...batches]);
}

export function deleteUploadBatch(restaurantSlug: string, id: string) {
  persistBatches(restaurantSlug, loadUploadBatches(restaurantSlug).filter((batch) => batch.id !== id));
}

export function removeUploadBatchAndRecombine(restaurantSlug: string, id: string): RestaurantData {
  deleteUploadBatch(restaurantSlug, id);
  const combined = combineBatches(loadUploadBatches(restaurantSlug));
  saveRestaurantData(restaurantSlug, combined);
  return combined;
}

export function clearAllUploadBatches(restaurantSlug: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(batchesKey(restaurantSlug));
}

export function combineBatches(batches: UploadBatch[]): RestaurantData {
  const usable = batches.filter((batch) => batch.status !== "failed");

  const orders = new Map<string, Order>();
  const menu = new Map<string, MenuItem>();
  const reviews = new Map<string, Review>();
  const tables = new Map<string, TableSession>();
  let latestImportedAt = "";

  for (const batch of usable) {
    if (batch.importedAt > latestImportedAt) latestImportedAt = batch.importedAt;
    for (const order of batch.data.orders) orders.set(order.orderId, order);
    for (const item of batch.data.menu) menu.set(item.dish, item);
    for (const review of batch.data.reviews) reviews.set(review.reviewId, review);
    for (const table of batch.data.tables) {
      tables.set(`${table.tableId}::${table.date}::${table.seatedTime}`, table);
    }
  }

  return {
    orders: Array.from(orders.values()),
    menu: Array.from(menu.values()),
    reviews: Array.from(reviews.values()),
    tables: Array.from(tables.values()),
    importedAt: latestImportedAt || new Date().toISOString(),
  };
}

export function confirmUploadBatch(restaurantSlug: string, batch: UploadBatch): RestaurantData {
  saveUploadBatch(restaurantSlug, batch);
  const combined = combineBatches(loadUploadBatches(restaurantSlug));
  saveRestaurantData(restaurantSlug, combined);
  return combined;
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
