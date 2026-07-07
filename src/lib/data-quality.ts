import type { CsvRow } from "@/lib/csv-parser";
import { getField } from "@/lib/field-mapping";
import type { DataQualityReport, UploadFileKind } from "@/lib/types";

function field(row: CsvRow, kind: UploadFileKind, canonical: string): string {
  return getField(row, kind, canonical) ?? "";
}

const FILENAME_HINTS: { kind: UploadFileKind; keywords: string[] }[] = [
  { kind: "orders", keywords: ["order"] },
  { kind: "menu", keywords: ["menu"] },
  { kind: "reviews", keywords: ["review"] },
  { kind: "tables", keywords: ["table"] },
  { kind: "restaurant", keywords: ["restaurant", "profile", "settings"] },
];

const HEADER_HINTS: { kind: UploadFileKind; requiredAny: string[][] }[] = [
  { kind: "orders", requiredAny: [["order_id", "orderid"], ["dish"]] },
  { kind: "menu", requiredAny: [["dish"], ["price"]] },
  { kind: "reviews", requiredAny: [["review_id", "reviewid"], ["rating"]] },
  { kind: "tables", requiredAny: [["table_id", "tableid"]] },
];

/** Detects a file's data kind from its filename first, falling back to header shape. */
export function detectFileKind(filename: string, headers: string[]): UploadFileKind | "unknown" {
  const name = filename.toLowerCase();
  for (const hint of FILENAME_HINTS) {
    if (hint.keywords.some((keyword) => name.includes(keyword))) return hint.kind;
  }

  const normalizedHeaders = headers.map((header) => header.toLowerCase());
  for (const hint of HEADER_HINTS) {
    const matchesAll = hint.requiredAny.every((group) =>
      group.some((column) => normalizedHeaders.includes(column))
    );
    if (matchesAll) return hint.kind;
  }

  return "unknown";
}

export function previewRows(rows: CsvRow[], n = 10): CsvRow[] {
  return rows.slice(0, n);
}

function isValidNumber(value: string): boolean {
  if (!value) return false;
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed);
}

const REQUIRED_FIELDS: Record<UploadFileKind, string[]> = {
  orders: ["order_id", "dish", "quantity", "unit_price"],
  menu: ["dish", "price"],
  reviews: ["review_id", "rating"],
  tables: ["table_id"],
  restaurant: [],
};

/** Numeric fields checked for parseability when present, without requiring the column to exist. */
const OPTIONAL_NUMERIC_FIELDS: Record<UploadFileKind, string[]> = {
  orders: ["total", "revenue", "cost"],
  menu: [],
  reviews: [],
  tables: ["guests"],
  restaurant: [],
};

function duplicateKey(row: CsvRow, kind: UploadFileKind): string {
  switch (kind) {
    case "orders":
      return `${field(row, kind, "order_id")}::${field(row, kind, "dish")}`;
    case "menu":
      return field(row, kind, "dish");
    case "reviews":
      return field(row, kind, "review_id");
    case "tables":
      return `${field(row, kind, "table_id")}::${field(row, kind, "date")}::${field(row, kind, "seated_time")}`;
    case "restaurant":
      return JSON.stringify(row);
  }
}

const NUMERIC_FIELDS_BY_KIND: Record<UploadFileKind, string[]> = {
  orders: ["quantity", "unit_price", "total", "revenue", "cost"],
  menu: ["price", "cost"],
  reviews: ["rating"],
  tables: ["guests"],
  restaurant: [],
};

function isInvalidRow(row: CsvRow, kind: UploadFileKind): boolean {
  for (const canonical of REQUIRED_FIELDS[kind]) {
    if (!NUMERIC_FIELDS_BY_KIND[kind].includes(canonical)) continue;
    const value = field(row, kind, canonical);
    if (value !== "" && !isValidNumber(value)) return true;
  }
  for (const canonical of OPTIONAL_NUMERIC_FIELDS[kind]) {
    const value = field(row, kind, canonical);
    if (value !== "" && !isValidNumber(value)) return true;
  }

  if (kind === "reviews") {
    const rating = field(row, kind, "rating");
    if (rating === "" || !isValidNumber(rating)) return true;
    const value = Number.parseFloat(rating);
    return value < 1 || value > 5;
  }

  return false;
}

export function computeDataQuality(rows: CsvRow[], kind: UploadFileKind): DataQualityReport {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (rows.length === 0) {
    errors.push("No rows could be parsed from this file.");
    return { score: 0, missingValues: 0, duplicateRows: 0, invalidRows: 0, warnings, errors };
  }

  const requiredFields = REQUIRED_FIELDS[kind];
  let missingValues = 0;
  for (const row of rows) {
    for (const canonical of requiredFields) {
      if (!field(row, kind, canonical)) missingValues += 1;
    }
  }

  const seen = new Set<string>();
  let duplicateRows = 0;
  for (const row of rows) {
    const key = duplicateKey(row, kind);
    if (!key) continue;
    if (seen.has(key)) duplicateRows += 1;
    else seen.add(key);
  }

  const invalidRows = rows.filter((row) => isInvalidRow(row, kind)).length;

  if (missingValues > 0) {
    warnings.push(`${missingValues} missing required value${missingValues === 1 ? "" : "s"}.`);
  }
  if (duplicateRows > 0) {
    warnings.push(`${duplicateRows} duplicate row${duplicateRows === 1 ? "" : "s"} detected.`);
  }
  if (invalidRows > 0) {
    errors.push(`${invalidRows} row${invalidRows === 1 ? "" : "s"} with invalid numeric values.`);
  }

  const penalty = missingValues * 4 + duplicateRows * 3 + invalidRows * 6;
  const score = Math.max(0, Math.min(100, Math.round(100 - (penalty / rows.length) * 10)));

  return { score, missingValues, duplicateRows, invalidRows, warnings, errors };
}
