import { createClient } from "@/lib/supabase/client";
import { computeBill, loadPaymentsForSession, processDemoPayment } from "@/lib/payment-store";
import { loadSessionById, updateSessionPaymentStatus, updateSessionStatus, updateSessionTotal } from "@/lib/live-store";
import { loadSessionOrders } from "@/lib/qr-store";
import type { Bill, Payment, SplitMode, TableParticipant } from "@/lib/types";
import type { TableSessionState } from "@/lib/table-session-store";

export interface SessionBill {
  bill: Bill;
  paid: number;
  remaining: number;
}

/** The table's full bill (all active orders, no split applied) plus how much of it has already been paid. */
export async function calculateBill(session: TableSessionState): Promise<SessionBill> {
  const activeItems = session.submittedOrders
    .filter((order) => order.status !== "cancelled")
    .flatMap((order) => order.items);
  const bill = computeBill({ items: activeItems, splitType: "full" });

  if (!session.dbSessionId) return { bill, paid: 0, remaining: bill.total };

  const payments = await loadPaymentsForSession(session.restaurantSlug, session.dbSessionId);
  const paid = Math.round(payments.reduce((sum, payment) => sum + payment.amount, 0) * 100) / 100;
  const remaining = Math.max(0, Math.round((bill.total - paid) * 100) / 100);
  return { bill, paid, remaining };
}

/** Splits whatever remains equally across the given participants (recalculated live, not a fixed pre-assigned share). */
export function calculateEqualSplit(remaining: number, participantCount: number): number {
  if (participantCount <= 0) return remaining;
  return Math.round((remaining / participantCount) * 100) / 100;
}

/** Validates custom per-participant amounts against the remaining balance; returns the balance left after them. */
export function calculateCustomRemaining(
  remaining: number,
  customAmounts: number[]
): { remainingAfter: number; valid: boolean } {
  const total = customAmounts.reduce((sum, amount) => sum + (Number.isFinite(amount) ? amount : 0), 0);
  const remainingAfter = Math.round((remaining - total) * 100) / 100;
  return { remainingAfter, valid: total <= remaining + 0.01 };
}

export interface CreateDemoPaymentInput {
  restaurantSlug: string;
  dbSessionId: string;
  tableRowId: string | null;
  orderId: string | null;
  participantId: string;
  amount: number;
  splitMode: SplitMode;
}

/** Records one participant's demo payment, bumps their running total, then reconciles the session's paid/remaining state. */
export async function createDemoPayment(input: CreateDemoPaymentInput): Promise<Payment | null> {
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

  await markSessionPaidIfComplete(input.restaurantSlug, input.dbSessionId);
  return payment;
}

/** Sums paid payments against the full bill and flips the session/table to paid once fully covered; otherwise marks it partial. */
export async function markSessionPaidIfComplete(restaurantSlug: string, dbSessionId: string): Promise<boolean> {
  const [orders, payments] = await Promise.all([
    loadSessionOrders(restaurantSlug, dbSessionId),
    loadPaymentsForSession(restaurantSlug, dbSessionId),
  ]);
  const activeItems = orders.filter((order) => order.status !== "cancelled").flatMap((order) => order.items);
  const bill = computeBill({ items: activeItems, splitType: "full" });
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);

  await updateSessionTotal(restaurantSlug, dbSessionId, bill.total);

  if (bill.total > 0 && paid + 0.01 >= bill.total) {
    await updateSessionStatus(restaurantSlug, dbSessionId, "paid");
    await updateSessionPaymentStatus(restaurantSlug, dbSessionId, "paid");
    return true;
  }

  const session = await loadSessionById(dbSessionId);
  if (session && session.paymentStatus !== "paid") {
    await updateSessionPaymentStatus(restaurantSlug, dbSessionId, paid > 0 ? "partial" : "unpaid");
  }
  return false;
}

export function connectedGuestLabel(participants: TableParticipant[]): string {
  const count = participants.length;
  return `${count} guest${count === 1 ? "" : "s"} viewing this table`;
}
