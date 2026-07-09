import { createClient } from "@/lib/supabase/client";
import { num } from "@/lib/db-utils";
import type { Bill, Payment, QRBasketItem, SplitType } from "@/lib/types";

/** Placeholder rates — not restaurant-configurable yet, matches the spec's "placeholder" requirement. */
export const SERVICE_CHARGE_PCT = 0.1;
export const VAT_PCT = 0.05;

export interface ComputeBillInput {
  items: QRBasketItem[];
  splitType: SplitType;
  /** Number of guests splitting equally, when splitType === "equal". */
  splitCount?: number;
  /** Item indices (by position in `items`) included, when splitType === "items". */
  selectedItemIndexes?: number[];
  tipPct?: number;
  tipAmount?: number;
}

export function computeBill(input: ComputeBillInput): Bill {
  const relevantItems =
    input.splitType === "items" && input.selectedItemIndexes
      ? input.items.filter((_, index) => input.selectedItemIndexes!.includes(index))
      : input.items;

  let subtotal = relevantItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (input.splitType === "equal" && input.splitCount && input.splitCount > 1) {
    subtotal = subtotal / input.splitCount;
  }

  const serviceCharge = subtotal * SERVICE_CHARGE_PCT;
  const vat = (subtotal + serviceCharge) * VAT_PCT;
  const tip = input.tipAmount ?? subtotal * (input.tipPct ?? 0);
  const total = subtotal + serviceCharge + vat + tip;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    serviceCharge: Math.round(serviceCharge * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    tip: Math.round(tip * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

async function resolveRestaurantId(restaurantSlug: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.from("restaurants").select("id").eq("slug", restaurantSlug).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export interface DemoPaymentInput {
  restaurantSlug: string;
  tableId: string | null;
  sessionId: string | null;
  orderId: string | null;
  bill: Bill;
  splitType: SplitType;
}

/**
 * The single seam for payment processing — swapping in a real gateway later means
 * replacing this function's body with a charge call, keeping the same signature/return shape.
 */
export async function processDemoPayment(input: DemoPaymentInput): Promise<Payment | null> {
  const restaurantId = await resolveRestaurantId(input.restaurantSlug);
  if (!restaurantId) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("payments")
    .insert({
      restaurant_id: restaurantId,
      table_id: input.tableId,
      session_id: input.sessionId,
      order_id: input.orderId,
      amount: input.bill.total,
      tip_amount: input.bill.tip,
      method: "demo",
      status: "paid",
      split_type: input.splitType,
    })
    .select("*")
    .maybeSingle();
  if (error || !data) return null;

  return rowToPayment(data, input.restaurantSlug);
}

function rowToPayment(row: Record<string, unknown>, restaurantSlug: string): Payment {
  return {
    id: row.id as string,
    restaurantId: restaurantSlug,
    tableId: (row.table_id as string | null) ?? null,
    sessionId: (row.session_id as string | null) ?? null,
    orderId: (row.order_id as string | null) ?? null,
    amount: num(row.amount),
    tipAmount: num(row.tip_amount),
    method: row.method as string,
    status: row.status as Payment["status"],
    splitType: row.split_type as SplitType,
    createdAt: row.created_at as string,
  };
}

/** Owner-portal read — restricted to restaurant members by RLS. */
export async function loadPayments(restaurantSlug: string): Promise<Payment[]> {
  const restaurantId = await resolveRestaurantId(restaurantSlug);
  if (!restaurantId) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => rowToPayment(row, restaurantSlug));
}
