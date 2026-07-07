import type { CsvRow } from "@/lib/csv-parser";
import type { UploadFileKind } from "@/lib/types";

export interface FieldDefinition {
  /** Canonical internal name, e.g. "unit_price". */
  canonical: string;
  /** Human-readable label for the Import Preview screen, e.g. "Unit Price". */
  label: string;
  /** Header spellings (case/spacing-insensitive) that map to this field. */
  aliases: string[];
  required?: boolean;
}

export function normalizeHeaderName(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export const ORDER_FIELDS: FieldDefinition[] = [
  { canonical: "order_id", label: "Order ID", aliases: ["order_id", "orderid"], required: true },
  { canonical: "customer_id", label: "Customer ID", aliases: ["customer_id", "customerid"] },
  { canonical: "table_id", label: "Table ID", aliases: ["table_id", "tableid"] },
  { canonical: "date", label: "Date", aliases: ["date"] },
  { canonical: "time", label: "Time", aliases: ["time"] },
  { canonical: "dish", label: "Dish", aliases: ["dish", "item", "item_name", "product"], required: true },
  { canonical: "category", label: "Category", aliases: ["category", "type"] },
  { canonical: "quantity", label: "Quantity", aliases: ["quantity", "qty"], required: true },
  {
    canonical: "unit_price",
    label: "Unit Price",
    aliases: ["unit_price", "unitprice", "price"],
    required: true,
  },
  { canonical: "total", label: "Total", aliases: ["total", "total_price", "line_total", "amount"] },
  { canonical: "revenue", label: "Revenue", aliases: ["revenue", "net_revenue"] },
  { canonical: "cost", label: "Cost", aliases: ["cost", "unit_cost", "cogs"] },
];

export const MENU_FIELDS: FieldDefinition[] = [
  { canonical: "dish", label: "Dish", aliases: ["dish", "item", "item_name"], required: true },
  { canonical: "category", label: "Category", aliases: ["category", "type"] },
  { canonical: "price", label: "Price", aliases: ["price", "unit_price"], required: true },
  { canonical: "cost", label: "Cost", aliases: ["cost", "unit_cost"] },
];

export const REVIEW_FIELDS: FieldDefinition[] = [
  { canonical: "review_id", label: "Review ID", aliases: ["review_id", "reviewid"], required: true },
  { canonical: "date", label: "Date", aliases: ["date"] },
  { canonical: "rating", label: "Rating", aliases: ["rating"], required: true },
  { canonical: "text", label: "Text", aliases: ["text", "review", "comment"] },
  { canonical: "guest_name", label: "Guest Name", aliases: ["guest_name", "guestname"] },
];

export const TABLE_FIELDS: FieldDefinition[] = [
  { canonical: "table_id", label: "Table ID", aliases: ["table_id", "tableid"], required: true },
  { canonical: "date", label: "Date", aliases: ["date"] },
  { canonical: "seated_time", label: "Seated Time", aliases: ["seated_time", "seatedtime"] },
  { canonical: "cleared_time", label: "Cleared Time", aliases: ["cleared_time", "clearedtime"] },
  { canonical: "guests", label: "Guests", aliases: ["guests"] },
];

export const FIELD_DEFINITIONS: Record<UploadFileKind, FieldDefinition[]> = {
  orders: ORDER_FIELDS,
  menu: MENU_FIELDS,
  reviews: REVIEW_FIELDS,
  tables: TABLE_FIELDS,
  restaurant: [],
};

/** Finds the actual header in `headers` that matches one of `def`'s aliases, or null. */
export function findHeader(headers: string[], def: FieldDefinition): string | null {
  for (const alias of def.aliases) {
    const normalizedAlias = normalizeHeaderName(alias);
    const match = headers.find((header) => normalizeHeaderName(header) === normalizedAlias);
    if (match) return match;
  }
  return null;
}

/** Returns the raw string value for a canonical field on a row, or undefined if the column is absent/blank. */
export function getField(row: CsvRow, kind: UploadFileKind, canonical: string): string | undefined {
  const def = FIELD_DEFINITIONS[kind].find((d) => d.canonical === canonical);
  if (!def) return undefined;
  const header = findHeader(Object.keys(row), def);
  if (!header) return undefined;
  const value = row[header];
  return value === "" ? undefined : value;
}

export interface HeaderMappingEntry {
  header: string;
  canonical: string | null;
  label: string | null;
  mapped: boolean;
}

/** Builds a per-header mapping summary for the Import Preview screen. */
export function buildHeaderMapping(headers: string[], kind: UploadFileKind): HeaderMappingEntry[] {
  const defs = FIELD_DEFINITIONS[kind];
  return headers.map((header) => {
    const def = defs.find((candidate) => findHeader([header], candidate) !== null);
    return {
      header,
      canonical: def?.canonical ?? null,
      label: def?.label ?? null,
      mapped: Boolean(def),
    };
  });
}
