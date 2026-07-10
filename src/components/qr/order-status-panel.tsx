"use client";

import { CheckCircle2, ChefHat, ReceiptText, Star, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TableSession } from "@/lib/session-store";

const STATUS_STEPS = [
  { key: "placed", label: "Order placed", icon: ReceiptText },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "served", label: "Served", icon: Utensils },
  { key: "billed", label: "Ready to pay", icon: CheckCircle2 },
] as const;

/** Derives overall progress from the furthest-along active order, plus whether the bill's been requested. */
function currentStepIndex(session: TableSession): number {
  const activeOrders = session.orders.filter((order) => order.status !== "cancelled");
  if (session.status !== "active") return 3;
  if (activeOrders.some((order) => order.status === "served")) return 2;
  if (activeOrders.some((order) => order.status === "preparing")) return 1;
  return 0;
}

export function OrderStatusPanel({
  tableSession,
  onAddMore,
  onViewBill,
  onRequestBill,
  onPayBill,
  onLeaveReview,
}: {
  tableSession: TableSession;
  onAddMore: () => void;
  onViewBill: () => void;
  onRequestBill: () => void;
  onPayBill: () => void;
  onLeaveReview: () => void;
}) {
  const activeOrders = tableSession.orders.filter((order) => order.status !== "cancelled");
  const activeItems = activeOrders.flatMap((order) => order.items);
  const subtotal = activeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const currentStep = currentStepIndex(tableSession);
  const isPaid = tableSession.status === "paid";
  const billRequested = tableSession.status === "bill_requested" || tableSession.status === "partially_paid";

  if (isPaid) {
    return (
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-6">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/15 bg-card px-6 py-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <CheckCircle2 className="size-6" />
          </span>
          <p className="font-serif text-lg font-medium tracking-tight text-foreground">Payment received</p>
          <p className="text-sm text-muted-foreground">Thank you for dining with us.</p>
          <button
            onClick={onLeaveReview}
            className="mt-2 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Star className="size-3.5" />
            Leave a review
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-6">
      <div>
        <h2 className="font-serif text-xl font-medium tracking-tight text-foreground">Your order</h2>
        <p className="mt-1 text-sm text-muted-foreground">Table {tableSession.tableId} · Track your order in real time</p>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-4">
        {STATUS_STEPS.map((step, index) => {
          const reached = index <= currentStep;
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center gap-1.5 text-center">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full",
                  reached ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                )}
              >
                <step.icon className="size-3.5" />
              </span>
              <span className={cn("text-[11px] font-medium", reached ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {billRequested && (
        <div className="rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          Bill requested. A staff member will assist shortly.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {activeOrders.map((order, orderIndex) => (
          <div key={order.orderId} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Order {activeOrders.length - orderIndex}</p>
              <span className="text-xs font-medium text-muted-foreground">
                {order.status === "new" && "Order sent to kitchen"}
                {order.status === "preparing" && "Preparing"}
                {order.status === "served" && "Served"}
              </span>
            </div>
            <div className="mt-2 flex flex-col divide-y divide-border">
              {order.items.map((item) => (
                <div key={`${order.orderId}-${item.dish}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-foreground">{item.dish}</span>
                  <span className="text-muted-foreground">
                    {item.quantity}× AED {(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {activeItems.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Current bill</p>
            <button onClick={onViewBill} className="text-xs font-medium text-primary hover:underline">
              View full bill
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-medium text-foreground">Subtotal</span>
            <span className="font-serif text-lg font-medium text-primary">AED {subtotal.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2.5">
        <button
          onClick={onAddMore}
          className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <Utensils className="size-4" />
          Add more items
        </button>
        <button
          onClick={onViewBill}
          className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <ReceiptText className="size-4" />
          View bill
        </button>
        {tableSession.status === "active" ? (
          <button
            onClick={onRequestBill}
            className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <ReceiptText className="size-4" />
            Request bill
          </button>
        ) : (
          <button
            onClick={onPayBill}
            className="flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
          >
            <CheckCircle2 className="size-4" />
            Pay Demo Bill
          </button>
        )}
      </div>
    </div>
  );
}
